"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, X, Eye, Loader2, FileText, CheckCircle2,
    ChevronLeft, ChevronRight, AlertTriangle, Pencil,
    Lock, Trophy, XCircle, Save, Plus, Trash2, Sparkles,
    ShieldCheck, Clock, SlidersHorizontal,
} from "lucide-react";
import {
    fetchComiteResponses, submitJuryGrade,
    setFinalDecision as apiSetFinalDecision, generateCertified, API_URL,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ─── Constantes ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 10;

const APPRECIATIONS = [
    { label: "Insuffisant",  value: "Insuffisant",  color: "#c62828", bg: "#ffebee" },
    { label: "Passable",     value: "Passable",     color: "#e65100", bg: "#fff3e0" },
    { label: "Satisfaisant", value: "Satisfaisant", color: "#1565c0", bg: "#e3f2fd" },
    { label: "Bien",         value: "Bien",         color: "#2e7d32", bg: "#e8f5e9" },
    { label: "Très bien",    value: "Très bien",    color: "#1a237e", bg: "#e8eaf6" },
];

const REJECTION_REASONS = [
    "Note insuffisante",
    "Dossier incomplet",
    "Compétences insuffisantes",
    "Résultats non conformes aux exigences",
    "Autre",
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenderedPage { dataUrl: string; width: number; height: number; }

interface JuryAnnotation {
    id: string;
    pageIndex: number;
    x: number;
    y: number;
    points_earned: string;
    max_points: string;
    label: string;
}

interface Pending {
    pageIndex: number;
    x: number; y: number;
    pxX: number; pxY: number;
}

function uid() { return Math.random().toString(36).slice(2, 9); }

function resolveUrl(u: string) {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    return `${API_URL.replace("/api", "")}${u}`;
}

function generateId(r: any) {
    return r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;
}

function formatDate(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PREDEFINED_FORMATIONS = [
    "Implementor ISO/IEC17025:2017",
    "Lead Implementor ISO/IEC17025:2017",
    "Junior Implementor ISO 9001:2015",
    "Implementor ISO 9001:2015",
    "Lead Implementor ISO 9001:2015",
    "Junior Implementor ISO 14001:2015",
    "Implementor ISO 14001:2015",
    "Lead Implementor ISO 14001:2015",
];

export default function ComitePage() {
    const { user, isLoading: isAuthLoading } = useAuth();

    const [responses, setResponses]       = useState<any[]>([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [searchQuery, setSearchQuery]   = useState("");
    const [selectedFormation, setSelectedFormation] = useState("");
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [currentPage, setCurrentPage]   = useState(1);
    const [selected, setSelected]         = useState<any>(null);

    // Init formation filter from URL (?formation=...)
    useEffect(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const f = params.get("formation");
            if (f) setSelectedFormation(f);
        }
    }, []);

    // PDF.js
    const [pdfjsReady, setPdfjsReady]         = useState(false);
    const [renderedPages, setRenderedPages]   = useState<RenderedPage[]>([]);
    const [isRenderingPdf, setIsRenderingPdf] = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);
    const [totalPdfPages, setTotalPdfPages]   = useState(0);

    // Mode annotation jury
    const [annotateMode, setAnnotateMode]     = useState(false);
    const [juryAnnotations, setJuryAnnotations] = useState<JuryAnnotation[]>([]);
    const [pending, setPending]               = useState<Pending | null>(null);
    const [pendingLabel, setPendingLabel]     = useState("");
    const [pendingEarned, setPendingEarned]   = useState("");
    const [pendingMax, setPendingMax]         = useState("20");
    const [editingId, setEditingId]           = useState<string | null>(null);
    const pendingRef = useRef<HTMLInputElement>(null);

    // Note jury
    const [juryGrade, setJuryGrade]           = useState("");
    const [juryAppreciation, setJuryAppreciation] = useState("");
    const [juryComments, setJuryComments]     = useState("");
    const [useManualJury, setUseManualJury]   = useState(false);
    const [manualJury, setManualJury]         = useState("");

    // Décision finale
    const [finalDecision, setFinalDecision]   = useState<"certified" | "rejected" | "">("");
    const [finalGrade, setFinalGrade]         = useState("");
    const [finalAppreciation, setFinalAppreciation] = useState("");
    const [rejectionReason, setRejectionReason] = useState("");
    const [customReason, setCustomReason]     = useState("");

    // Soumissions
    const [isSubmittingJury, setIsSubmittingJury]     = useState(false);
    const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
    const [isGenerating, setIsGenerating]             = useState(false);
    const [generateResult, setGenerateResult]         = useState<{ generated: number; total_certified: number } | null>(null);

    // ── Chargement données ───────────────────────────────────────────────────
    useEffect(() => {
        if (user) load();
    }, [user]);

    const load = async () => {
        setIsLoading(true);
        try {
            const data = await fetchComiteResponses();
            setResponses(data);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    };

    // ── PDF.js CDN ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ((window as any).pdfjsLib) { setPdfjsReady(true); return; }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            setPdfjsReady(true);
        };
        document.head.appendChild(script);
    }, []);

    // ── Rendu PDF ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!pdfjsReady || !selected?.exam_document) return;
        const docUrl = resolveUrl(selected.exam_document);
        if (!docUrl) return;
        let cancelled = false;
        setIsRenderingPdf(true);
        setRenderedPages([]);
        setRenderProgress(0);
        setTotalPdfPages(0);
        (async () => {
            try {
                const res = await fetch(docUrl, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const ab   = await blob.arrayBuffer();
                const lib  = (window as any).pdfjsLib;
                const pdf  = await lib.getDocument({ data: ab }).promise;
                if (cancelled) return;
                setTotalPdfPages(pdf.numPages);
                for (let i = 1; i <= pdf.numPages; i++) {
                    if (cancelled) break;
                    const page     = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.8 });
                    const canvas   = document.createElement("canvas");
                    canvas.width   = viewport.width;
                    canvas.height  = viewport.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) continue;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    if (cancelled) break;
                    setRenderedPages(prev => [...prev, {
                        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
                        width: viewport.width,
                        height: viewport.height,
                    }]);
                    setRenderProgress(i);
                }
            } catch (e) { console.error("PDF render error:", e); }
            finally { if (!cancelled) setIsRenderingPdf(false); }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfjsReady, selected?._id ?? null]);

    // ── Ouverture modal ──────────────────────────────────────────────────────
    const openModal = (r: any) => {
        setSelected(r);
        setAnnotateMode(false);
        setPending(null);
        setEditingId(null);
        // Annotations jury existantes
        setJuryAnnotations((r.jury_answer_grades || []).map((g: any) => ({
            id: g.question_id || uid(),
            pageIndex: g.page_index ?? 0,
            x: g.x ?? 10,
            y: g.y ?? 10,
            points_earned: String(g.points_earned ?? ""),
            max_points: String(g.max_points ?? "20"),
            label: g.label || "Q",
        })));
        setJuryGrade(r.jury_grade || "");
        setJuryAppreciation(r.jury_appreciation || "");
        setJuryComments(r.jury_comments || "");
        setManualJury(r.jury_grade || "");
        setUseManualJury(false);
        setFinalDecision(r.final_decision || "");
        setFinalGrade(r.final_grade || "");
        setFinalAppreciation(r.final_appreciation || "");
        setRejectionReason(r.rejection_reason || "");
        setCustomReason("");
    };

    const closeModal = () => {
        setSelected(null);
        setRenderedPages([]);
        setAnnotateMode(false);
        setPending(null);
    };

    // ── Annotations jury ─────────────────────────────────────────────────────
    const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
        if (!annotateMode) return;
        if (editingId) { setEditingId(null); return; }
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setPendingLabel(`Q${juryAnnotations.length + 1}`);
        setPendingEarned(""); setPendingMax("20");
        setPending({ pageIndex: pageIdx, x, y, pxX: e.clientX - rect.left, pxY: e.clientY - rect.top });
        setTimeout(() => pendingRef.current?.focus(), 40);
    };

    const confirmPending = () => {
        if (!pending) return;
        setJuryAnnotations(prev => [...prev, {
            id: uid(), pageIndex: pending.pageIndex,
            x: pending.x, y: pending.y,
            points_earned: pendingEarned,
            max_points: pendingMax || "20",
            label: pendingLabel || `Q${juryAnnotations.length + 1}`,
        }]);
        setPending(null);
    };

    const updateJuryAnnotation = (id: string, field: keyof JuryAnnotation, value: string) =>
        setJuryAnnotations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

    const removeJuryAnnotation = (id: string) =>
        setJuryAnnotations(prev => prev.filter(a => a.id !== id));

    // ── Note jury calculée ────────────────────────────────────────────────────
    const computedJury = useCallback(() => ({
        earned: juryAnnotations.reduce((s, a) => s + (parseFloat(a.points_earned) || 0), 0),
        max:    juryAnnotations.reduce((s, a) => s + (parseFloat(a.max_points)    || 0), 0),
    }), [juryAnnotations]);

    const effectiveJuryGrade = useCallback(() => {
        if (useManualJury && manualJury.trim()) return manualJury.trim();
        const { earned, max } = computedJury();
        if (juryAnnotations.length === 0) return "";
        return `${earned}/${max}`;
    }, [useManualJury, manualJury, computedJury, juryAnnotations]);

    // ── Soumission note jury ──────────────────────────────────────────────────
    const handleSubmitJury = async () => {
        if (!selected) return;
        const grade = effectiveJuryGrade();
        if (!grade) { alert("Saisissez une note jury ou posez des annotations."); return; }
        setIsSubmittingJury(true);
        try {
            const updated = await submitJuryGrade(selected._id, {
                jury_grade: grade,
                jury_appreciation: juryAppreciation || undefined,
                jury_comments: juryComments || undefined,
                jury_answer_grades: juryAnnotations.map(a => ({
                    question_id: a.id,
                    label: a.label,
                    points_earned: parseFloat(a.points_earned) || 0,
                    max_points: parseFloat(a.max_points) || 0,
                    x: a.x, y: a.y, page_index: a.pageIndex,
                })),
            });
            setResponses(prev => prev.map(r => r._id === updated._id ? updated : r));
            setSelected(updated);
            setAnnotateMode(false);
        } catch (e: any) { alert(e.message || "Erreur"); }
        finally { setIsSubmittingJury(false); }
    };

    // ── Décision finale ───────────────────────────────────────────────────────
    const handleSubmitDecision = async () => {
        if (!selected || !finalDecision) { alert("Choisissez une décision (Certifié / Non certifié)."); return; }
        if (finalDecision === "rejected" && !rejectionReason) { alert("Indiquez un motif de rejet."); return; }
        setIsSubmittingDecision(true);
        try {
            const reason = rejectionReason === "Autre" ? customReason : rejectionReason;
            const updated = await apiSetFinalDecision(selected._id, {
                final_decision: finalDecision,
                final_grade: finalGrade || effectiveJuryGrade() || selected.exam_grade,
                final_appreciation: finalAppreciation || undefined,
                rejection_reason: finalDecision === "rejected" ? reason : undefined,
            });
            setResponses(prev => prev.map(r => r._id === updated._id ? updated : r));
            setSelected(updated);
        } catch (e: any) { alert(e.message || "Erreur"); }
        finally { setIsSubmittingDecision(false); }
    };

    // ── Génération des certifiés ──────────────────────────────────────────────
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const result = await generateCertified();
            setGenerateResult(result);
            await load();
        } catch (e: any) { alert(e.message || "Erreur"); }
        finally { setIsGenerating(false); }
    };

    // ── Filtrage + pagination ─────────────────────────────────────────────────
    // Count per formation (0 if no copies in that formation)
    const formationCounts = useMemo(() => {
        const map = new Map<string, number>();
        for (const f of PREDEFINED_FORMATIONS) map.set(f, 0);
        for (const r of responses) {
            const f = (r.answers?.["Certification souhaitée"] || "").trim();
            if (map.has(f)) map.set(f, (map.get(f) || 0) + 1);
        }
        return map;
    }, [responses]);

    const filtered = responses.filter(r => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = generateId(r).toLowerCase().includes(q) ||
            (r.answers?.["Certification souhaitée"] || "").toLowerCase().includes(q) ||
            (r.assigned_examiner_email || "").toLowerCase().includes(q);
        const matchesFormation = !selectedFormation ||
            (r.answers?.["Certification souhaitée"] || "").trim() === selectedFormation;
        return matchesSearch && matchesFormation;
    });
    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const certified = responses.filter(r => r.final_decision === "certified").length;

    // ── Calcul totaux annotations jury ────────────────────────────────────────
    const { earned: juryEarned, max: juryMax } = computedJury();

    if (isAuthLoading || !user) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="animate-spin h-8 w-8" style={{ color: "#1a237e" }} />
        </div>
    );

    return (
        <div className="space-y-6">

            {/* ── En-tête ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
                        Comité de Validation
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Vérifiez les corrections, ajoutez la note jury et décidez de la certification.
                    </p>
                </div>
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || certified === 0}
                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 transition-all disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: "#2e7d32" }}
                >
                    {isGenerating
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Génération…</>
                        : <><Sparkles className="h-4 w-4" /> Générer les certifiés ({certified})</>}
                </button>
            </div>

            {/* Résultat génération */}
            <AnimatePresence>
                {generateResult && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border-2 text-sm font-semibold"
                        style={{ backgroundColor: "#e8f5e9", borderColor: "#a5d6a7", color: "#2e7d32" }}>
                        <Trophy className="h-4 w-4 shrink-0" />
                        {generateResult.generated > 0
                            ? `${generateResult.generated} candidat(s) certifié(s) — Total : ${generateResult.total_certified}`
                            : `Aucun nouveau certifié — Total déjà certifiés : ${generateResult.total_certified}`}
                        <button onClick={() => setGenerateResult(null)} className="ml-auto"><X className="h-4 w-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Barre de recherche + filtre ── */}
            <div className="flex items-center gap-2">
                <div className="flex-1 bg-white p-3.5 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#e8eaf6" }}>
                    <Search className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                    <input type="text" placeholder="Rechercher par matricule, certification, correcteur…"
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400"
                        value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Bouton filtre */}
                <button
                    onClick={() => setShowFilterModal(true)}
                    className="relative flex items-center gap-2 px-4 py-3.5 rounded-xl border text-sm font-bold transition-all hover:shadow-sm shrink-0"
                    style={{
                        borderColor: selectedFormation ? "#1a237e" : "#e8eaf6",
                        backgroundColor: selectedFormation ? "#1a237e" : "white",
                        color: selectedFormation ? "white" : "#555",
                    }}
                >
                    <SlidersHorizontal className="h-4 w-4" />
                    Filtrer
                    {selectedFormation && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full text-[9px] font-black flex items-center justify-center text-white"
                            style={{ backgroundColor: "#c62828" }}>1</span>
                    )}
                </button>
            </div>

            {/* Badge certification active */}
            {selectedFormation && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Filtre actif :</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-2"
                        style={{ borderColor: "#1a237e", color: "#1a237e", backgroundColor: "#e8eaf6" }}>
                        {selectedFormation}
                        <button onClick={() => { setSelectedFormation(""); setCurrentPage(1); }}
                            className="ml-0.5 hover:opacity-70">
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                </div>
            )}

            {/* ══ Modal filtre ══ */}
            <AnimatePresence>
                {showFilterModal && (
                    <>
                        <motion.div key="filter-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowFilterModal(false)} />
                        <motion.div key="filter-modal"
                            initial={{ opacity: 0, scale: 0.93, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 12 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                                style={{ border: "2px solid #e8eaf6" }}>

                                {/* Header */}
                                <div className="px-6 py-4 flex items-center justify-between"
                                    style={{ backgroundColor: "#1a237e" }}>
                                    <div className="flex items-center gap-2">
                                        <SlidersHorizontal className="h-4 w-4 text-white/80" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-white">
                                            Filtrer par certification
                                        </span>
                                    </div>
                                    <button onClick={() => setShowFilterModal(false)}
                                        className="text-white/60 hover:text-white transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Corps */}
                                <div className="px-6 py-5 space-y-2 overflow-y-auto" style={{ maxHeight: "60vh" }}>
                                    {/* Option "Toutes" */}
                                    <button
                                        onClick={() => { setSelectedFormation(""); setCurrentPage(1); setShowFilterModal(false); }}
                                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all text-left"
                                        style={{
                                            borderColor: !selectedFormation ? "#1a237e" : "#e8eaf6",
                                            backgroundColor: !selectedFormation ? "#e8eaf6" : "white",
                                            color: !selectedFormation ? "#1a237e" : "#374151",
                                        }}
                                    >
                                        <span>Toutes les certifications</span>
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: !selectedFormation ? "#1a237e" : "#f3f4f6", color: !selectedFormation ? "white" : "#374151" }}>
                                            {responses.length}
                                        </span>
                                    </button>

                                    {/* Séparateur */}
                                    <div className="pt-1 pb-0.5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-1">
                                            Certifications
                                        </p>
                                    </div>

                                    {/* Toutes les certifications prédéfinies */}
                                    {PREDEFINED_FORMATIONS.map(f => {
                                        const count = formationCounts.get(f) || 0;
                                        const isActive = selectedFormation === f;
                                        return (
                                            <button
                                                key={f}
                                                onClick={() => { setSelectedFormation(f); setCurrentPage(1); setShowFilterModal(false); }}
                                                className="w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all text-left"
                                                style={{
                                                    borderColor: isActive ? "#1a237e" : "#e8eaf6",
                                                    backgroundColor: isActive ? "#e8eaf6" : "white",
                                                    color: isActive ? "#1a237e" : "#374151",
                                                }}
                                            >
                                                <span className="leading-snug">{f}</span>
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ml-2"
                                                    style={{
                                                        backgroundColor: isActive ? "#1a237e" : count > 0 ? "#f3f4f6" : "#fafafa",
                                                        color: isActive ? "white" : count > 0 ? "#374151" : "#d1d5db",
                                                    }}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Footer */}
                                <div className="px-6 pb-5">
                                    <button
                                        onClick={() => setShowFilterModal(false)}
                                        className="w-full py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                                        Fermer
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Tableau ── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24" style={{ color: "#1a237e" }}>
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm font-bold animate-pulse">Chargement…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border shadow-sm" style={{ borderColor: "#e8eaf6" }}>
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-20" style={{ color: "#1a237e" }} />
                    <p className="text-sm font-medium text-gray-400">Aucune copie corrigée trouvée.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase font-bold border-b" style={{ backgroundColor: "#f4f6f9", borderColor: "#e8eaf6", color: "#1a237e" }}>
                            <tr>
                                <th className="px-5 py-3.5">Candidat</th>
                                <th className="px-5 py-3.5 hidden sm:table-cell">Certification</th>
                                <th className="px-5 py-3.5 text-center">Note correcteur</th>
                                <th className="px-5 py-3.5 text-center">Note jury</th>
                                <th className="px-5 py-3.5 text-center">Décision</th>
                                <th className="px-5 py-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "#f0f2f5" }}>
                            {paginated.map((r, idx) => {
                                const id = generateId(r);
                                const decision = r.final_decision;
                                return (
                                    <motion.tr key={r._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
                                        className="hover:bg-gray-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 text-white"
                                                    style={{ backgroundColor: "#1a237e" }}>
                                                    {id.slice(-4)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-xs font-mono">{id}</p>
                                                    <p className="text-[10px] text-gray-400">{formatDate(r.submitted_at)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell">
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">
                                                {r.answers?.["Certification souhaitée"] || "—"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                                                style={{ background: "#fff5f5", color: "#c62828", borderColor: "#fecaca" }}>
                                                {r.exam_grade}
                                            </span>
                                            {r.exam_appreciation && (
                                                <p className="text-[9px] text-gray-400 mt-0.5">{r.exam_appreciation}</p>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            {r.jury_grade ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                                                    style={{ background: "#e3f2fd", color: "#1a237e", borderColor: "#90caf9" }}>
                                                    {r.jury_grade}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">—</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            {decision === "certified" ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                                                    style={{ background: "#e8f5e9", color: "#2e7d32", borderColor: "#c8e6c9" }}>
                                                    <Trophy className="h-3 w-3" /> Certifié
                                                </span>
                                            ) : decision === "rejected" ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                                                    style={{ background: "#ffebee", color: "#c62828", borderColor: "#ffcdd2" }}>
                                                    <XCircle className="h-3 w-3" /> Rejeté
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border"
                                                    style={{ background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }}>
                                                    <Clock className="h-3 w-3" /> En attente
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button onClick={() => openModal(r)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:-translate-y-0.5"
                                                style={{ borderColor: "#1a237e", color: "#1a237e", backgroundColor: "#e3f2fd" }}>
                                                <Eye className="h-3.5 w-3.5" /> Valider
                                            </button>
                                        </td>
                                    </motion.tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-5 py-3.5 border-t flex items-center justify-between bg-[#f4f6f9]" style={{ borderColor: "#e8eaf6" }}>
                            <p className="text-xs text-gray-500">
                                Page <span className="font-bold" style={{ color: "#1a237e" }}>{currentPage}</span> / {totalPages} · {filtered.length} copie{filtered.length > 1 ? "s" : ""}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-[#e3f2fd] disabled:opacity-40 transition-colors" style={{ color: "#1a237e" }}>
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .reduce<(number | string)[]>((acc, p, i, arr) => {
                                        if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("...");
                                        acc.push(p); return acc;
                                    }, [])
                                    .map((p, i) => p === "..." ? (
                                        <span key={`e-${i}`} className="text-gray-400 text-sm px-1">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setCurrentPage(p as number)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold ${currentPage === p ? "text-white" : "border border-gray-200 text-gray-600 hover:bg-[#e3f2fd]"}`}
                                            style={currentPage === p ? { backgroundColor: "#1a237e" } : {}}>
                                            {p}
                                        </button>
                                    ))}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-[#e3f2fd] disabled:opacity-40 transition-colors" style={{ color: "#1a237e" }}>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════════
                MODAL VALIDATION
            ═══════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selected && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
                        <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => !isSubmittingJury && !isSubmittingDecision && closeModal()} />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            onClick={e => e.stopPropagation()}
                            className="relative bg-white rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden"
                            style={{ width: "98vw", height: "96vh" }}
                        >
                            {/* Header */}
                            <div className="px-5 py-3.5 flex items-center justify-between shrink-0" style={{ backgroundColor: "#1a237e" }}>
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-1.5 rounded-lg"><ShieldCheck className="h-4 w-4 text-white" /></div>
                                    <div>
                                        <h2 className="text-sm font-bold uppercase tracking-widest text-white">Validation — Comité</h2>
                                        <p className="text-xs text-white/50 font-mono">{generateId(selected)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!selected.final_decision && (
                                        <button onClick={() => { setAnnotateMode(m => !m); setPending(null); setEditingId(null); }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                                            style={{ backgroundColor: annotateMode ? "#ef4444" : "rgba(255,255,255,0.12)", border: annotateMode ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.2)" }}>
                                            <Pencil className="h-3.5 w-3.5" /> {annotateMode ? "Arrêter" : "Annoter (jury)"}
                                        </button>
                                    )}
                                    <button onClick={closeModal} disabled={isSubmittingJury || isSubmittingDecision}
                                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {annotateMode && (
                                <div className="bg-blue-50 border-b border-blue-200 px-5 py-1.5 flex items-center gap-2 text-blue-800 text-xs shrink-0">
                                    <Pencil className="h-3 w-3 shrink-0" />
                                    Mode annotation jury — cliquez sur la copie pour poser une note bleue.
                                </div>
                            )}

                            {/* Corps : PDF + panneau droite */}
                            <div className="flex-1 flex overflow-hidden">

                                {/* ── PDF ── */}
                                <div className="flex-1 overflow-y-auto bg-gray-700 relative">
                                    {(isRenderingPdf || renderedPages.length === 0) && (
                                        <div className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-sm px-5 py-2 flex items-center gap-3">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span className="text-white text-xs font-medium">
                                                {totalPdfPages > 0 ? `Chargement… ${renderProgress}/${totalPdfPages}` : "Chargement de la copie…"}
                                            </span>
                                            {totalPdfPages > 0 && (
                                                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(renderProgress / totalPdfPages) * 100}%` }} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="py-4 flex flex-col items-center gap-4">
                                        {renderedPages.map((page, pageIdx) => (
                                            <div key={pageIdx} className="relative shadow-2xl select-none" style={{ width: "min(100%, 860px)" }}>
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={page.dataUrl} alt={`Page ${pageIdx + 1}`} className="w-full block" draggable={false} />

                                                <div className="absolute inset-0"
                                                    style={{ cursor: annotateMode ? "crosshair" : "default" }}
                                                    onClick={e => handlePageClick(e, pageIdx)}>

                                                    {/* Annotations du CORRECTEUR (rouge) */}
                                                    {(selected.answer_grades || [])
                                                        .filter((g: any) => (g.page_index ?? 0) === pageIdx)
                                                        .map((g: any, i: number) => (
                                                            <div key={`c-${i}`} className="absolute pointer-events-none"
                                                                style={{ left: `${g.x ?? 10}%`, top: `${g.y ?? 10}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}>
                                                                <div className="flex flex-col items-center gap-0.5">
                                                                    <div className="flex flex-col items-center justify-center rounded-full border-[3px]"
                                                                        style={{ width: 40, height: 40, borderColor: "#c62828", backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 2px 8px rgba(198,40,40,0.4)" }}>
                                                                        <span className="font-black leading-none" style={{ fontSize: 13, color: "#c62828" }}>{g.points_earned ?? "—"}</span>
                                                                        <span className="font-bold leading-none" style={{ fontSize: 6, color: "#c62828", opacity: 0.7 }}>/{g.max_points}</span>
                                                                    </div>
                                                                    <span className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-white/95 shadow-sm" style={{ color: "#c62828" }}>
                                                                        {g.label || `Q${i + 1}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}

                                                    {/* Annotations du JURY (bleu) */}
                                                    {juryAnnotations
                                                        .filter(a => a.pageIndex === pageIdx)
                                                        .map(ann => {
                                                            const isEditing = editingId === ann.id;
                                                            return (
                                                                <div key={ann.id} className="absolute"
                                                                    style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: "translate(-50%,-50%)", zIndex: 20 }}
                                                                    onClick={e => { e.stopPropagation(); if (annotateMode) setEditingId(isEditing ? null : ann.id); }}>
                                                                    {isEditing && annotateMode ? (
                                                                        <div className="bg-white rounded-2xl shadow-2xl p-3 border-2 flex flex-col gap-2"
                                                                            style={{ width: 170, borderColor: "#1565c0" }} onClick={e => e.stopPropagation()}>
                                                                            <input type="text" value={ann.label} onChange={e => updateJuryAnnotation(ann.id, "label", e.target.value)}
                                                                                className="text-xs font-bold text-center border border-gray-200 rounded-lg px-2 py-1 focus:outline-none" placeholder="Label" />
                                                                            <div className="flex items-center gap-1">
                                                                                <input type="text" inputMode="decimal" value={ann.points_earned}
                                                                                    onChange={e => updateJuryAnnotation(ann.id, "points_earned", e.target.value)}
                                                                                    className="w-14 text-center text-xl font-black border-2 rounded-xl py-1 focus:outline-none"
                                                                                    style={{ color: "#1565c0", borderColor: "#1565c0" }} placeholder="0" />
                                                                                <span className="font-black text-gray-400">/</span>
                                                                                <input type="text" inputMode="decimal" value={ann.max_points}
                                                                                    onChange={e => updateJuryAnnotation(ann.id, "max_points", e.target.value)}
                                                                                    className="w-12 text-center text-sm font-bold border border-gray-200 rounded-xl py-1 focus:outline-none text-gray-500" placeholder="20" />
                                                                            </div>
                                                                            <div className="flex gap-1.5">
                                                                                <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-xs font-bold rounded-lg text-white" style={{ backgroundColor: "#1565c0" }}>OK</button>
                                                                                <button onClick={() => { removeJuryAnnotation(ann.id); setEditingId(null); }} className="py-1.5 px-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" /></button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="flex flex-col items-center gap-0.5 cursor-pointer group/b">
                                                                            <div className="flex flex-col items-center justify-center rounded-full border-[3px] transition-transform group-hover/b:scale-110"
                                                                                style={{ width: 40, height: 40, borderColor: "#1565c0", backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 2px 8px rgba(21,101,192,0.4)" }}>
                                                                                <span className="font-black leading-none" style={{ fontSize: 13, color: "#1565c0" }}>{ann.points_earned || "—"}</span>
                                                                                <span className="font-bold leading-none" style={{ fontSize: 6, color: "#1565c0", opacity: 0.7 }}>/{ann.max_points}</span>
                                                                            </div>
                                                                            <span className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-white/95 shadow-sm" style={{ color: "#1565c0" }}>
                                                                                {ann.label}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                    {/* Popup nouvelle annotation jury */}
                                                    {pending?.pageIndex === pageIdx && (
                                                        <div className="absolute bg-white rounded-2xl shadow-2xl p-4 border-2 flex flex-col gap-2 z-30"
                                                            style={{ left: Math.min(pending.pxX + 8, 660), top: pending.pxY - 10, width: 178, borderColor: "#1565c0" }}
                                                            onClick={e => e.stopPropagation()}>
                                                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#1565c0" }}>Note jury</p>
                                                            <input type="text" value={pendingLabel} onChange={e => setPendingLabel(e.target.value)}
                                                                className="text-xs font-bold text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none" placeholder="Label (Q1, Q2…)" />
                                                            <div className="flex items-center gap-1">
                                                                <input ref={pendingRef} type="text" inputMode="decimal" value={pendingEarned}
                                                                    onChange={e => setPendingEarned(e.target.value)}
                                                                    onKeyDown={e => e.key === "Enter" && confirmPending()}
                                                                    className="w-16 text-center text-2xl font-black border-2 rounded-xl py-1 focus:outline-none"
                                                                    style={{ color: "#1565c0", borderColor: "#1565c0" }} placeholder="0" />
                                                                <span className="font-black text-gray-400">/</span>
                                                                <input type="text" inputMode="decimal" value={pendingMax}
                                                                    onChange={e => setPendingMax(e.target.value)}
                                                                    className="w-14 text-center text-base font-bold border border-gray-200 rounded-xl py-1 focus:outline-none text-gray-500" placeholder="20" />
                                                            </div>
                                                            <div className="flex gap-1.5">
                                                                <button onClick={confirmPending}
                                                                    className="flex-1 py-1.5 text-xs font-bold rounded-lg text-white flex items-center justify-center gap-1"
                                                                    style={{ backgroundColor: "#1565c0" }}>
                                                                    <Plus className="h-3 w-3" /> Poser
                                                                </button>
                                                                <button onClick={() => setPending(null)} className="py-1.5 px-2.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold hover:bg-gray-200">✕</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Tampon note finale (page 0) */}
                                                {pageIdx === 0 && selected.final_grade && (
                                                    <div className="absolute pointer-events-none" style={{ top: "2%", right: "2%", zIndex: 30 }}>
                                                        <div className="flex flex-col items-center gap-1" style={{ transform: "rotate(-8deg)" }}>
                                                            <div className="flex flex-col items-center justify-center rounded-full border-[4px]"
                                                                style={{ width: 88, height: 88, borderColor: "#1a237e", backgroundColor: "rgba(255,255,255,0.95)", boxShadow: "0 0 0 2px rgba(74,20,140,0.15), 0 4px 16px rgba(74,20,140,0.3)" }}>
                                                                <span className="font-black leading-tight text-center px-1"
                                                                    style={{ fontSize: selected.final_grade.length > 5 ? 14 : 20, color: "#1a237e", lineHeight: 1.1 }}>
                                                                    {selected.final_grade}
                                                                </span>
                                                                <span className="font-black uppercase tracking-widest" style={{ fontSize: 7, color: "#1a237e", opacity: 0.6 }}>FINAL</span>
                                                            </div>
                                                            {selected.final_decision === "certified" && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-100 text-green-800">Certifié</span>
                                                            )}
                                                            {selected.final_decision === "rejected" && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">Non certifié</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="absolute bottom-2 right-3 text-[10px] font-bold text-gray-400 bg-white/80 px-2 py-0.5 rounded-full pointer-events-none">
                                                    {pageIdx + 1} / {renderedPages.length}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ── Panneau droite ── */}
                                <div className="flex flex-col overflow-y-auto shrink-0 bg-gray-50 border-l gap-0" style={{ width: 300, borderColor: "#e8eaf6" }}>
                                    <div className="flex flex-col gap-4 p-4">

                                        {/* Légende */}
                                        <div className="flex items-center gap-4 text-xs font-bold">
                                            <span className="flex items-center gap-1.5" style={{ color: "#c62828" }}>
                                                <span className="w-3 h-3 rounded-full border-2 inline-block shrink-0" style={{ borderColor: "#c62828" }} />
                                                Correcteur
                                            </span>
                                            <span className="flex items-center gap-1.5" style={{ color: "#1565c0" }}>
                                                <span className="w-3 h-3 rounded-full border-2 inline-block shrink-0" style={{ borderColor: "#1565c0" }} />
                                                Jury
                                            </span>
                                        </div>

                                        {/* Notes côte à côte */}
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-white rounded-xl border-2 p-3 text-center" style={{ borderColor: "#c62828" }}>
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "#c62828" }}>Correcteur</p>
                                                <p className="text-xl font-black" style={{ color: "#c62828" }}>{selected.exam_grade}</p>
                                                {selected.exam_appreciation && (
                                                    <p className="text-[9px] text-gray-400 mt-0.5">{selected.exam_appreciation}</p>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-xl border-2 p-3 text-center" style={{ borderColor: "#1565c0" }}>
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: "#1565c0" }}>Jury</p>
                                                <p className="text-xl font-black" style={{ color: "#1565c0" }}>
                                                    {selected.jury_grade || (juryAnnotations.length > 0 ? `${juryEarned}/${juryMax}` : "—")}
                                                </p>
                                                {selected.jury_appreciation && (
                                                    <p className="text-[9px] text-gray-400 mt-0.5">{selected.jury_appreciation}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Note jury — saisie */}
                                        {!selected.final_decision && (
                                            <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Note jury</p>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={useManualJury} onChange={e => setUseManualJury(e.target.checked)} className="rounded" />
                                                    <span className="text-[11px] font-bold text-gray-600">Note manuelle</span>
                                                </label>
                                                {useManualJury ? (
                                                    <input type="text" value={manualJury} onChange={e => setManualJury(e.target.value)}
                                                        placeholder="Ex: 16/20" className="w-full px-3 py-2 bg-gray-50 border border-blue-200 rounded-lg text-sm font-mono font-bold focus:outline-none"
                                                        style={{ color: "#1565c0" }} />
                                                ) : (
                                                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-bold" style={{ color: "#1565c0" }}>
                                                        {effectiveJuryGrade() || <span className="text-gray-400 font-normal text-xs">Auto-calculée</span>}
                                                    </div>
                                                )}

                                                {/* Appréciation jury */}
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">Appréciation jury</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {APPRECIATIONS.map(a => (
                                                        <button key={a.value} type="button"
                                                            onClick={() => setJuryAppreciation(juryAppreciation === a.value ? "" : a.value)}
                                                            className="px-2 py-0.5 rounded-lg text-[10px] font-bold border-2 transition-all"
                                                            style={{ backgroundColor: juryAppreciation === a.value ? a.bg : "white", borderColor: juryAppreciation === a.value ? a.color : "#e8eaf6", color: juryAppreciation === a.value ? a.color : "#9ca3af" }}>
                                                            {a.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <textarea value={juryComments} onChange={e => setJuryComments(e.target.value)}
                                                    placeholder="Observations jury…" rows={2}
                                                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none resize-none" />

                                                <button onClick={handleSubmitJury} disabled={isSubmittingJury || !effectiveJuryGrade()}
                                                    className="w-full py-2.5 text-white rounded-xl text-xs font-bold flex justify-center items-center gap-2 disabled:opacity-40 hover:opacity-90"
                                                    style={{ backgroundColor: "#1565c0" }}>
                                                    {isSubmittingJury ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Envoi…</> : <><Save className="h-3.5 w-3.5" />Enregistrer note jury</>}
                                                </button>
                                            </div>
                                        )}

                                        {/* ── Décision finale ── */}
                                        <div className="bg-white rounded-xl border-2 p-3 space-y-3" style={{ borderColor: selected.final_decision ? (selected.final_decision === "certified" ? "#2e7d32" : "#c62828") : "#1a237e" }}>
                                            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>Décision finale</p>

                                            {selected.final_decision ? (
                                                /* Décision déjà prise */
                                                <div className="text-center space-y-2">
                                                    {selected.final_decision === "certified" ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Trophy className="h-8 w-8 text-green-600" />
                                                            <p className="font-black text-green-700">Certifié</p>
                                                            {selected.final_grade && <p className="text-sm font-bold text-gray-500">Note finale : {selected.final_grade}</p>}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <XCircle className="h-8 w-8 text-red-600" />
                                                            <p className="font-black text-red-700">Non certifié</p>
                                                            {selected.rejection_reason && <p className="text-xs text-gray-500">Motif : {selected.rejection_reason}</p>}
                                                        </div>
                                                    )}
                                                    <p className="text-[9px] text-gray-400">Décidé par {selected.decided_by}</p>
                                                    {!selected.is_certified && (
                                                        <button onClick={() => setSelected({ ...selected, final_decision: null })}
                                                            className="text-xs text-purple-600 underline underline-offset-2 hover:no-underline">
                                                            Modifier la décision
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                /* Formulaire décision */
                                                <div className="space-y-2">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button onClick={() => setFinalDecision("certified")}
                                                            className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-bold text-xs transition-all"
                                                            style={{ borderColor: finalDecision === "certified" ? "#2e7d32" : "#e8eaf6", backgroundColor: finalDecision === "certified" ? "#e8f5e9" : "white", color: finalDecision === "certified" ? "#2e7d32" : "#9ca3af" }}>
                                                            <Trophy className="h-5 w-5" />Certifié
                                                        </button>
                                                        <button onClick={() => setFinalDecision("rejected")}
                                                            className="flex flex-col items-center gap-1 py-3 rounded-xl border-2 font-bold text-xs transition-all"
                                                            style={{ borderColor: finalDecision === "rejected" ? "#c62828" : "#e8eaf6", backgroundColor: finalDecision === "rejected" ? "#ffebee" : "white", color: finalDecision === "rejected" ? "#c62828" : "#9ca3af" }}>
                                                            <XCircle className="h-5 w-5" />Non certifié
                                                        </button>
                                                    </div>

                                                    {/* Note finale */}
                                                    <div>
                                                        <p className="text-[10px] font-bold text-gray-500 mb-1">Note finale</p>
                                                        <input type="text" value={finalGrade} onChange={e => setFinalGrade(e.target.value)}
                                                            placeholder={selected.jury_grade || selected.exam_grade || "Ex: 15/20"}
                                                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-bold focus:outline-none"
                                                            style={{ color: "#1a237e" }} />
                                                    </div>

                                                    {/* Appréciation finale */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {APPRECIATIONS.map(a => (
                                                            <button key={a.value} type="button"
                                                                onClick={() => setFinalAppreciation(finalAppreciation === a.value ? "" : a.value)}
                                                                className="px-2 py-0.5 rounded-lg text-[10px] font-bold border-2 transition-all"
                                                                style={{ backgroundColor: finalAppreciation === a.value ? a.bg : "white", borderColor: finalAppreciation === a.value ? a.color : "#e8eaf6", color: finalAppreciation === a.value ? a.color : "#9ca3af" }}>
                                                                {a.label}
                                                            </button>
                                                        ))}
                                                    </div>

                                                    {/* Motif rejet */}
                                                    {finalDecision === "rejected" && (
                                                        <div className="space-y-1.5">
                                                            <p className="text-[10px] font-bold text-gray-500">Motif de rejet <span className="text-red-500">*</span></p>
                                                            {REJECTION_REASONS.map(reason => (
                                                                <label key={reason} className="flex items-center gap-2 cursor-pointer text-xs">
                                                                    <input type="radio" name="reason" checked={rejectionReason === reason}
                                                                        onChange={() => setRejectionReason(reason)} className="shrink-0" />
                                                                    {reason}
                                                                </label>
                                                            ))}
                                                            {rejectionReason === "Autre" && (
                                                                <input type="text" value={customReason} onChange={e => setCustomReason(e.target.value)}
                                                                    placeholder="Préciser le motif…"
                                                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none" />
                                                            )}
                                                        </div>
                                                    )}

                                                    <button onClick={handleSubmitDecision}
                                                        disabled={isSubmittingDecision || !finalDecision}
                                                        className="w-full py-2.5 rounded-xl text-xs font-bold text-white flex justify-center items-center gap-2 disabled:opacity-40 hover:opacity-90"
                                                        style={{ backgroundColor: finalDecision === "certified" ? "#2e7d32" : finalDecision === "rejected" ? "#c62828" : "#1a237e" }}>
                                                        {isSubmittingDecision
                                                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Envoi…</>
                                                            : finalDecision === "certified"
                                                                ? <><Trophy className="h-3.5 w-3.5" />Valider — Certifié</>
                                                                : finalDecision === "rejected"
                                                                    ? <><XCircle className="h-3.5 w-3.5" />Valider — Non certifié</>
                                                                    : <><Lock className="h-3.5 w-3.5" />Choisir une décision</>}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <button onClick={closeModal} disabled={isSubmittingJury || isSubmittingDecision}
                                            className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                                            Fermer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
