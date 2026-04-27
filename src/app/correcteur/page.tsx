"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    fetchResponses, updateExamGrade, fetchForms, getCertFormId, setCertFormId,
    API_URL, signCorrections, lockCorrection,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Search, CheckCircle, AlertTriangle,
    X, Save, FilePenLine, FileCheck,
    ChevronLeft, ChevronRight, PartyPopper,
    Lock, PenLine, Pencil, Eye,
    Trash2, Plus,
} from "lucide-react";

const ITEMS_PER_PAGE = 8;

const APPRECIATIONS = [
    { label: "Insuffisant",  value: "Insuffisant",  color: "#c62828", bg: "#ffebee", border: "#ef9a9a" },
    { label: "Passable",     value: "Passable",     color: "#e65100", bg: "#fff3e0", border: "#ffcc80" },
    { label: "Satisfaisant", value: "Satisfaisant", color: "#1565c0", bg: "#e3f2fd", border: "#90caf9" },
    { label: "Bien",         value: "Bien",         color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7" },
    { label: "Très bien",    value: "Très bien",    color: "#4a148c", bg: "#f3e5f5", border: "#ce93d8" },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface RenderedPage { dataUrl: string; width: number; height: number; }

interface Annotation {
    id: string;
    pageIndex: number;   // 0-based
    x: number;           // % of page width
    y: number;           // % of page height
    points_earned: string;
    max_points: string;
    label: string;
}

interface Pending {
    pageIndex: number;
    x: number; y: number;   // % within page
    pxX: number; pxY: number; // px within page (for popup placement)
}

function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CorrecteurPage() {
    const [responses, setResponses]     = useState<any[]>([]);
    const [isLoading, setIsLoading]     = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

    // PDF rendering
    const [pdfjsReady, setPdfjsReady]       = useState(false);
    const [renderedPages, setRenderedPages] = useState<RenderedPage[]>([]);
    const [isRenderingPdf, setIsRenderingPdf] = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);
    const [totalPdfPages, setTotalPdfPages]   = useState(0);

    // Annotations
    const [annotations, setAnnotations]   = useState<Annotation[]>([]);
    const [annotateMode, setAnnotateMode] = useState(false);
    const [pending, setPending]           = useState<Pending | null>(null);
    const [pendingLabel, setPendingLabel] = useState("");
    const [pendingEarned, setPendingEarned] = useState("");
    const [pendingMax, setPendingMax]     = useState("20");
    const [editingId, setEditingId]       = useState<string | null>(null);
    const pendingEarnedRef = useRef<HTMLInputElement>(null);

    // Grade
    const [appreciation, setAppreciation] = useState("");
    const [comments, setComments]         = useState("");
    const [manualGrade, setManualGrade]   = useState("");
    const [useManual, setUseManual]       = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLocking, setIsLocking]       = useState(false);
    const [currentPage, setCurrentPage]   = useState(1);
    const [isSigning, setIsSigning]       = useState(false);
    const [signed, setSigned]             = useState(false);
    const [showSignModal, setShowSignModal] = useState(false);

    const { user, logout, isLoading: isAuthLoading } = useAuth();
    const correctorEmail = user?.email || "";

    // ── URL helpers (declared early so useEffects can reference them) ─────────
    const resolveUrl  = (u: string) => { if (!u) return ""; if (u.startsWith("http")) return u; return `${API_URL.replace("/api", "")}${u}`; };
    const getExamDocUrl = (r: any): string | null => r?.exam_document ? resolveUrl(r.exam_document) : null;

    // ── Load PDF.js from CDN ─────────────────────────────────────────────────
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

    // ── Render PDF when modal opens ──────────────────────────────────────────
    useEffect(() => {
        if (!pdfjsReady || !selectedResponse) return;
        const docUrl = getExamDocUrl(selectedResponse);
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
                const arrayBuffer = await blob.arrayBuffer();
                const pdfjsLib = (window as any).pdfjsLib;
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

                if (cancelled) return;
                setTotalPdfPages(pdf.numPages);

                for (let i = 1; i <= pdf.numPages; i++) {
                    if (cancelled) break;
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.8 });
                    const canvas = document.createElement("canvas");
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) continue;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    if (cancelled) break;
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
                    setRenderedPages(prev => [...prev, { dataUrl, width: viewport.width, height: viewport.height }]);
                    setRenderProgress(i);
                }
            } catch (err) {
                console.error("PDF render error:", err);
            } finally {
                if (!cancelled) setIsRenderingPdf(false);
            }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pdfjsReady, selectedResponse?._id ?? null]);

    // ── Data ─────────────────────────────────────────────────────────────────
    const loadData = async () => {
        setIsLoading(true);
        try {
            let formId = getCertFormId();
            if (!formId) {
                const forms = await fetchForms();
                const certForm = forms.find((f: any) => f.title === "Fiche de demande - IRISQ CERTIFICATION");
                if (!certForm) { setIsLoading(false); return; }
                formId = certForm._id;
                setCertFormId(formId!);
            }
            const allResponses = await fetchResponses(formId!);
            const filtered = allResponses
                .filter((r: any) => r.status === "approved")
                .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
            setResponses(filtered);
        } catch (error) { console.error(error); }
        finally { setIsLoading(false); }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (user) loadData(); }, [user]);

    const generateId = (r: any) => r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;
    const formatDate  = (iso: string) => !iso ? "—" : new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });

    // ── Computed total ────────────────────────────────────────────────────────
    const computedTotal = useCallback(() => ({
        earned: annotations.reduce((s, a) => s + (parseFloat(a.points_earned) || 0), 0),
        max:    annotations.reduce((s, a) => s + (parseFloat(a.max_points)    || 0), 0),
    }), [annotations]);

    const effectiveGrade = useCallback(() => {
        if (useManual && manualGrade.trim()) return manualGrade.trim();
        const { earned, max } = computedTotal();
        if (annotations.length === 0) return "";
        return `${earned}/${max}`;
    }, [useManual, manualGrade, computedTotal, annotations]);

    // ── Open modal ────────────────────────────────────────────────────────────
    const openModal = (r: any) => {
        setSelectedResponse(r);
        setAnnotateMode(false);
        setPending(null);
        setEditingId(null);
        setComments(r.exam_comments || "");
        setAppreciation(r.exam_appreciation || "");
        setUseManual(false);
        setManualGrade(r.exam_grade || "");
        if (r.answer_grades?.length > 0) {
            setAnnotations(r.answer_grades.map((g: any) => ({
                id: g.question_id || uid(),
                pageIndex: g.page_index ?? 0,
                x: g.x ?? 10,
                y: g.y ?? 10,
                points_earned: String(g.points_earned ?? ""),
                max_points: String(g.max_points ?? "20"),
                label: g.label || g.question_id || "Note",
            })));
        } else { setAnnotations([]); }
    };

    // ── Click on a page ───────────────────────────────────────────────────────
    const handlePageClick = (e: React.MouseEvent<HTMLDivElement>, pageIdx: number) => {
        if (!annotateMode) return;
        if (editingId) { setEditingId(null); return; }
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width)  * 100;
        const y = ((e.clientY - rect.top)  / rect.height) * 100;
        setPendingLabel(`Q${annotations.length + 1}`);
        setPendingEarned(""); setPendingMax("20");
        setPending({ pageIndex: pageIdx, x, y, pxX: e.clientX - rect.left, pxY: e.clientY - rect.top });
        setTimeout(() => pendingEarnedRef.current?.focus(), 40);
    };

    const confirmPending = () => {
        if (!pending) return;
        setAnnotations(prev => [...prev, {
            id: uid(),
            pageIndex: pending.pageIndex,
            x: pending.x, y: pending.y,
            points_earned: pendingEarned,
            max_points: pendingMax || "20",
            label: pendingLabel || `Q${annotations.length + 1}`,
        }]);
        setPending(null);
    };

    const updateAnnotation = (id: string, field: keyof Annotation, value: string | number) =>
        setAnnotations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));

    const removeAnnotation = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id));

    // ── Submit ────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResponse) return;
        const grade = effectiveGrade();
        if (!grade) { alert("Veuillez saisir au moins une annotation ou une note manuelle."); return; }
        setIsSubmitting(true);
        try {
            const updated = await updateExamGrade(selectedResponse._id, {
                exam_grade: grade,
                exam_status: "graded",
                exam_comments: comments || undefined,
                exam_appreciation: appreciation || undefined,
                answer_grades: annotations.length > 0 ? annotations.map(a => ({
                    question_id: a.id,
                    label: a.label,
                    points_earned: parseFloat(a.points_earned) || 0,
                    max_points:    parseFloat(a.max_points)    || 0,
                    x: a.x, y: a.y,
                    page_index: a.pageIndex,
                })) : undefined,
            });
            setResponses(prev => prev.map(r => r._id === updated._id ? updated : r));
            setSelectedResponse(updated);
            setAnnotateMode(false);
        } catch (err: any) { alert(err.message || "Erreur lors de la soumission."); }
        finally { setIsSubmitting(false); }
    };

    const handleLock = async () => {
        if (!selectedResponse) return;
        if (!window.confirm("Voulez-vous verrouiller cette correction ? Aucune modification ne sera possible ensuite.")) return;
        setIsLocking(true);
        try {
            const updated = await lockCorrection(selectedResponse._id);
            setResponses(prev => prev.map(r => r._id === updated._id ? updated : r));
            setSelectedResponse(updated);
        } catch (err: any) { alert(err.message || "Erreur."); }
        finally { setIsLocking(false); }
    };

    const myResponses = responses.filter(r => r.assigned_examiner_email?.toLowerCase() === correctorEmail.toLowerCase());
    const allGraded   = myResponses.length > 0 && myResponses.every(r => !!r.exam_grade);

    const handleSign = async () => {
        setIsSigning(true);
        try { await signCorrections(); setSigned(true); }
        catch (err: any) { alert(err.message || "Erreur."); }
        finally { setIsSigning(false); }
    };

    const filteredResponses = responses.filter(r => {
        if (r.assigned_examiner_email?.toLowerCase() !== correctorEmail.toLowerCase()) return false;
        const q = searchQuery.toLowerCase();
        return generateId(r).toLowerCase().includes(q) ||
            (r.answers?.["Certification souhaitée"] || "").toLowerCase().includes(q);
    });
    const totalPages       = Math.ceil(filteredResponses.length / ITEMS_PER_PAGE);
    const paginatedResponses = filteredResponses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    if (isAuthLoading || !user) return (
        <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
            <Loader2 className="animate-spin text-[#1a237e] h-8 w-8" />
        </div>
    );

    const isLocked   = !!selectedResponse?.is_correction_locked;
    const savedGrade = selectedResponse?.exam_grade;
    const savedAppr  = selectedResponse?.exam_appreciation;
    const stampAppr  = APPRECIATIONS.find(a => a.value === savedAppr);
    const { earned: totalEarned, max: totalMax } = computedTotal();

    return (
        <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>Évaluations Candidats</h1>
                    <div className="flex items-center gap-3 mt-1">
                        <p className="text-gray-500 text-sm">Connecté en tant que <span className="font-bold text-[#1a237e]">{correctorEmail}</span></p>
                        <button onClick={logout} className="text-[11px] text-gray-400 hover:text-red-500 transition-colors underline underline-offset-2">Déconnexion</button>
                    </div>
                </div>

                {/* Bouton principal */}
                {signed ? (
                    <div className="flex items-center gap-2.5 px-5 py-3 rounded-xl text-white font-bold text-sm shadow-lg shrink-0" style={{ backgroundColor: "#2e7d32" }}>
                        <PartyPopper className="h-4 w-4 shrink-0" />
                        <span>Corrections signées — évaluateur notifié</span>
                    </div>
                ) : (
                    <button
                        onClick={() => setShowSignModal(true)}
                        disabled={isSigning}
                        className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shrink-0"
                        style={{ backgroundColor: allGraded ? "#2e7d32" : "#1a237e" }}
                    >
                        {isSigning
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                            : <><PenLine className="h-4 w-4" /> Correction totale terminée</>}
                    </button>
                )}
            </div>

            {/* ── Bandeau "toutes corrigées" ── */}
            {!signed && allGraded && (
                <div className="flex items-center gap-3 px-5 py-3 rounded-xl border-2 text-sm font-semibold" style={{ backgroundColor: "#e8f5e9", borderColor: "#a5d6a7", color: "#2e7d32" }}>
                    <CheckCircle className="h-4 w-4 shrink-0" />
                    Toutes les copies sont corrigées — cliquez sur &laquo;&nbsp;Correction totale terminée&nbsp;&raquo; pour notifier l&apos;évaluateur.
                </div>
            )}

            {/* ── Search ── */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#c5cae9" }}>
                <Search className="text-[#1a237e] h-5 w-5 shrink-0" />
                <input type="text" placeholder="Chercher par ID Candidat ou Certification…" value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 uppercase" />
                {searchQuery && <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-400"><X className="h-4 w-4" /></button>}
            </div>

            {/* ── Table ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">Liste des Copies</h2>
                    <div className="text-xs text-white/70">{filteredResponses.length} copie(s)</div>
                </div>
                {isLoading ? (
                    <div className="p-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#1a237e" }} /><p className="text-sm text-gray-400">Chargement…</p></div>
                ) : filteredResponses.length === 0 ? (
                    <div className="p-16 text-center"><FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20 text-gray-400" /><p className="text-sm font-medium text-gray-400">Aucune copie trouvée.</p></div>
                ) : (
                    <>
                        <div className="grid grid-cols-12 px-6 py-3 bg-[#f8f9fa] border-b text-xs font-bold uppercase tracking-wider text-[#1a237e]" style={{ borderColor: "#e8eaf6" }}>
                            <div className="col-span-3">Candidat</div><div className="col-span-4">Certification</div>
                            <div className="col-span-2 text-center">Note</div><div className="col-span-1 text-center">Statut</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>
                        <div className="divide-y" style={{ borderColor: "#f0f2f5" }}>
                            {paginatedResponses.map((response, idx) => {
                                const candidateId = generateId(response);
                                const graded = !!response.exam_grade;
                                const hasDoc = !!getExamDocUrl(response);
                                const locked = !!response.is_correction_locked;
                                const appr   = APPRECIATIONS.find(a => a.value === response.exam_appreciation);
                                return (
                                    <motion.div key={response._id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.03 }}
                                        className="grid grid-cols-12 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors group">
                                        <div className="col-span-3 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">{candidateId.slice(-4)}</div>
                                            <div><p className="font-bold text-gray-900 text-sm group-hover:text-[#1a237e]">{candidateId}</p><p className="text-xs text-gray-400 mt-0.5">{formatDate(response.submitted_at)}</p></div>
                                        </div>
                                        <div className="col-span-4"><p className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg inline-block max-w-[220px] truncate">{response.answers?.["Certification souhaitée"] || "Non spécifiée"}</p></div>
                                        <div className="col-span-2 flex justify-center">
                                            {graded ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: "#e8f5e9", color: "#2e7d32", borderColor: "#c8e6c9" }}><CheckCircle className="h-3 w-3" />{response.exam_grade}</span>
                                                    {appr && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: appr.color, backgroundColor: appr.bg }}>{appr.label}</span>}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }}><AlertTriangle className="h-3 w-3" />En attente</span>
                                            )}
                                        </div>
                                        <div className="col-span-1 flex justify-center">{locked && <Lock className="h-4 w-4 text-rose-500" aria-label="Verrouillée" />}</div>
                                        <div className="col-span-2 flex items-center justify-end">
                                            <button onClick={() => openModal(response)} disabled={!hasDoc}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 hover:opacity-90"
                                                style={{ backgroundColor: "#1a237e" }}>
                                                <FilePenLine className="h-3.5 w-3.5" />{graded ? (locked ? "Voir" : "Modifier") : "Corriger"}
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t flex items-center justify-between bg-[#f8f9fa]" style={{ borderColor: "#e8eaf6" }}>
                                <p className="text-xs text-gray-500">Page <span className="font-bold text-[#1a237e]">{currentPage}</span> / {totalPages} · {filteredResponses.length} résultat{filteredResponses.length !== 1 ? "s" : ""}</p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce<(number | string)[]>((acc, p, i, arr) => { if (i > 0 && typeof arr[i - 1] === "number" && (p as number) - (arr[i - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, [])
                                        .map((p, i) => p === "..." ? <span key={`e-${i}`} className="text-gray-400 px-1">…</span> :
                                            <button key={p} onClick={() => setCurrentPage(p as number)} className={`w-8 h-8 rounded-lg text-sm font-bold ${currentPage === p ? "bg-[#1a237e] text-white" : "border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]"}`}>{p}</button>)}
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </motion.div>

            {/* ════════════════════════════════════════════
                MODAL CORRECTION
            ════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedResponse && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/60 backdrop-blur-sm">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0" onClick={() => !isSubmitting && !isLocking && setSelectedResponse(null)} />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 16 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            onClick={e => e.stopPropagation()}
                            className="relative bg-white rounded-2xl shadow-2xl flex flex-col z-10 overflow-hidden"
                            style={{ width: "97vw", height: "95vh" }}
                        >
                            {/* ── Header ── */}
                            <div className="px-5 py-3.5 flex items-center justify-between shrink-0"
                                style={{ backgroundColor: isLocked ? "#b71c1c" : "#1a237e" }}>
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-1.5 rounded-lg">
                                        {isLocked ? <Lock className="h-4 w-4 text-white" /> : <FilePenLine className="h-4 w-4 text-white" />}
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold uppercase tracking-widest text-white">{isLocked ? "Correction Verrouillée" : "Correction de copie"}</h2>
                                        <p className="text-xs text-white/50 font-mono">{generateId(selectedResponse)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Corriger la copie / Lecture */}
                                    {!isLocked && (
                                        <button onClick={() => { setAnnotateMode(m => !m); setPending(null); setEditingId(null); }}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all"
                                            style={{ backgroundColor: annotateMode ? "#ef4444" : "rgba(255,255,255,0.12)", border: annotateMode ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.2)" }}>
                                            {annotateMode ? <><Eye className="h-3.5 w-3.5" /> Lecture</> : <><Pencil className="h-3.5 w-3.5" /> Corriger la copie</>}
                                        </button>
                                    )}
                                    <button onClick={() => !isSubmitting && !isLocking && setSelectedResponse(null)} disabled={isSubmitting || isLocking}
                                        className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Hint / lock bar */}
                            {annotateMode && !isLocked && (
                                <div className="bg-amber-50 border-b border-amber-200 px-5 py-1.5 flex items-center gap-2 text-amber-800 text-xs shrink-0">
                                    <Pencil className="h-3 w-3 shrink-0" />
                                    <span>Cliquez à côté d&apos;une question pour poser une note. Faites défiler librement — les bulles restent sur la question.</span>
                                </div>
                            )}
                            {isLocked && (
                                <div className="bg-rose-50 border-b border-rose-200 px-5 py-1.5 flex items-center gap-2 text-rose-700 text-xs font-bold shrink-0">
                                    <Lock className="h-3 w-3 shrink-0" /> Correction verrouillée — lecture seule.
                                </div>
                            )}

                            {/* ── Body ── */}
                            <div className="flex-1 flex overflow-hidden">

                                {/* ══ LEFT : PDF rendu page par page ══ */}
                                <div className="flex-1 overflow-y-auto bg-gray-700 relative" style={{ scrollBehavior: "smooth" }}>

                                    {/* Loading state */}
                                    {(isRenderingPdf || renderedPages.length === 0) && (
                                        <div className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-sm px-5 py-2 flex items-center gap-3">
                                            <Loader2 className="h-4 w-4 animate-spin text-white" />
                                            <span className="text-white text-xs font-medium">
                                                {totalPdfPages > 0
                                                    ? `Chargement de la copie… ${renderProgress}/${totalPdfPages} pages`
                                                    : "Chargement de la copie…"}
                                            </span>
                                            {totalPdfPages > 0 && (
                                                <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                                    <div className="h-full bg-white rounded-full transition-all" style={{ width: `${(renderProgress / totalPdfPages) * 100}%` }} />
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Pages rendues */}
                                    <div className="py-4 flex flex-col items-center gap-4">
                                        {renderedPages.map((page, pageIdx) => (
                                            <div key={pageIdx} className="relative shadow-2xl select-none" style={{ width: "min(100%, 860px)" }}>
                                                {/* Image de la page */}
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={page.dataUrl}
                                                    alt={`Page ${pageIdx + 1}`}
                                                    className="w-full block"
                                                    draggable={false}
                                                />

                                                {/* Overlay annotations — même taille que l'image */}
                                                <div
                                                    className="absolute inset-0"
                                                    style={{ cursor: annotateMode ? "crosshair" : "default" }}
                                                    onClick={e => handlePageClick(e, pageIdx)}
                                                >
                                                    {/* Bulles d'annotation sur cette page */}
                                                    {annotations
                                                        .filter(a => a.pageIndex === pageIdx)
                                                        .map(ann => {
                                                            const isEditing = editingId === ann.id;
                                                            return (
                                                                <div key={ann.id} className="absolute"
                                                                    style={{ left: `${ann.x}%`, top: `${ann.y}%`, transform: "translate(-50%, -50%)", zIndex: 10 }}
                                                                    onClick={e => { e.stopPropagation(); if (annotateMode) setEditingId(isEditing ? null : ann.id); }}>

                                                                    {isEditing && annotateMode ? (
                                                                        /* Popover édition */
                                                                        <div className="bg-white rounded-2xl shadow-2xl p-3 border-2 flex flex-col gap-2"
                                                                            style={{ width: 170, borderColor: "#c62828" }}
                                                                            onClick={e => e.stopPropagation()}>
                                                                            <input type="text" value={ann.label}
                                                                                onChange={e => updateAnnotation(ann.id, "label", e.target.value)}
                                                                                className="text-xs font-bold text-center border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
                                                                                placeholder="Label" />
                                                                            <div className="flex items-center gap-1">
                                                                                <input type="text" inputMode="decimal" value={ann.points_earned}
                                                                                    onChange={e => updateAnnotation(ann.id, "points_earned", e.target.value)}
                                                                                    className="w-14 text-center text-xl font-black border-2 rounded-xl py-1 focus:outline-none"
                                                                                    style={{ color: "#c62828", borderColor: "#c62828" }} placeholder="0" />
                                                                                <span className="font-black text-gray-400">/</span>
                                                                                <input type="text" inputMode="decimal" value={ann.max_points}
                                                                                    onChange={e => updateAnnotation(ann.id, "max_points", e.target.value)}
                                                                                    className="w-12 text-center text-sm font-bold border border-gray-200 rounded-xl py-1 focus:outline-none text-gray-500"
                                                                                    placeholder="20" />
                                                                            </div>
                                                                            <div className="flex gap-1.5">
                                                                                <button onClick={() => setEditingId(null)} className="flex-1 py-1.5 text-xs font-bold rounded-lg text-white" style={{ backgroundColor: "#2e7d32" }}>OK</button>
                                                                                <button onClick={() => { removeAnnotation(ann.id); setEditingId(null); }} className="py-1.5 px-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        /* Bulle note — style encre rouge */
                                                                        <div className="flex flex-col items-center gap-0.5 cursor-pointer group/b">
                                                                            <div className="flex flex-col items-center justify-center rounded-full border-[3px] transition-transform group-hover/b:scale-110"
                                                                                style={{ width: 48, height: 48, borderColor: "#c62828", backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 2px 10px rgba(198,40,40,0.4)" }}>
                                                                                <span className="font-black leading-none" style={{ fontSize: 17, color: "#c62828" }}>
                                                                                    {ann.points_earned !== "" ? ann.points_earned : "—"}
                                                                                </span>
                                                                                <span className="font-bold leading-none" style={{ fontSize: 8, color: "#c62828", opacity: 0.7 }}>
                                                                                    /{ann.max_points}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/95 shadow-sm" style={{ color: "#c62828" }}>
                                                                                {ann.label}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}

                                                    {/* Popup nouvelle annotation sur cette page */}
                                                    {pending?.pageIndex === pageIdx && (
                                                        <div className="absolute bg-white rounded-2xl shadow-2xl p-4 border-2 flex flex-col gap-2 z-30"
                                                            style={{
                                                                left: Math.min(pending.pxX + 8, 680),
                                                                top: pending.pxY - 10,
                                                                width: 178,
                                                                borderColor: "#c62828",
                                                            }}
                                                            onClick={e => e.stopPropagation()}>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Nouvelle note</p>
                                                            <input type="text" value={pendingLabel} onChange={e => setPendingLabel(e.target.value)}
                                                                className="text-xs font-bold text-center border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-red-400"
                                                                placeholder="Label (Q1, Q2…)" />
                                                            <div className="flex items-center gap-1">
                                                                <input ref={pendingEarnedRef} type="text" inputMode="decimal" value={pendingEarned}
                                                                    onChange={e => setPendingEarned(e.target.value)}
                                                                    onKeyDown={e => e.key === "Enter" && confirmPending()}
                                                                    className="w-16 text-center text-2xl font-black border-2 rounded-xl py-1 focus:outline-none"
                                                                    style={{ color: "#c62828", borderColor: "#c62828" }} placeholder="0" />
                                                                <span className="font-black text-gray-400">/</span>
                                                                <input type="text" inputMode="decimal" value={pendingMax}
                                                                    onChange={e => setPendingMax(e.target.value)}
                                                                    className="w-14 text-center text-base font-bold border border-gray-200 rounded-xl py-1 focus:outline-none text-gray-500"
                                                                    placeholder="20" />
                                                            </div>
                                                            <div className="flex gap-1.5">
                                                                <button onClick={confirmPending}
                                                                    className="flex-1 py-1.5 text-xs font-bold rounded-lg text-white flex items-center justify-center gap-1"
                                                                    style={{ backgroundColor: "#c62828" }}>
                                                                    <Plus className="h-3 w-3" /> Poser
                                                                </button>
                                                                <button onClick={() => setPending(null)} className="py-1.5 px-2.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold hover:bg-gray-200">✕</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* ── Tampon note finale (page 1 uniquement) ── */}
                                                {pageIdx === 0 && savedGrade && (
                                                    <div className="absolute pointer-events-none"
                                                        style={{ top: "2%", right: "2%", zIndex: 20 }}>
                                                        <div className="flex flex-col items-center gap-1"
                                                            style={{ transform: "rotate(-8deg)" }}>
                                                            {/* Cercle principal */}
                                                            <div className="flex flex-col items-center justify-center rounded-full border-[4px]"
                                                                style={{
                                                                    width: 88, height: 88,
                                                                    borderColor: "#c62828",
                                                                    backgroundColor: "rgba(255,255,255,0.95)",
                                                                    boxShadow: "0 0 0 2px rgba(198,40,40,0.15), 0 4px 16px rgba(198,40,40,0.3)",
                                                                }}>
                                                                <span className="font-black leading-tight text-center px-1"
                                                                    style={{
                                                                        fontSize: savedGrade.length > 5 ? 14 : 20,
                                                                        color: "#c62828",
                                                                        lineHeight: 1.1,
                                                                    }}>
                                                                    {savedGrade}
                                                                </span>
                                                                <span className="font-black uppercase tracking-widest"
                                                                    style={{ fontSize: 7, color: "#c62828", opacity: 0.6 }}>
                                                                    NOTE
                                                                </span>
                                                            </div>
                                                            {/* Appréciation */}
                                                            {savedAppr && (
                                                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                                    style={{ color: stampAppr?.color, backgroundColor: stampAppr?.bg }}>
                                                                    {savedAppr}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Numéro de page */}
                                                <div className="absolute bottom-2 right-3 text-[10px] font-bold text-gray-400 bg-white/80 px-2 py-0.5 rounded-full pointer-events-none">
                                                    {pageIdx + 1} / {renderedPages.length}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ══ RIGHT : Panneau notation compact ══ */}
                                <form onSubmit={handleSubmit} className="flex flex-col bg-gray-50 overflow-y-auto shrink-0 border-l" style={{ width: 290, borderColor: "#e8eaf6" }}>
                                    <div className="flex flex-col flex-1 p-4 gap-4">

                                        {/* Annotations list */}
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Notes ({annotations.length})</p>
                                                {annotateMode && !isLocked && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 animate-pulse">En cours…</span>}
                                            </div>

                                            {annotations.length === 0 ? (
                                                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                                                    <Pencil className="h-6 w-6 mx-auto mb-1.5 text-gray-300" />
                                                    <p className="text-xs text-gray-400 font-medium">Aucune annotation</p>
                                                    <p className="text-[10px] text-gray-300 mt-0.5">Activez Annoter et cliquez sur la copie</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {annotations.map(ann => (
                                                        <div key={ann.id} className="bg-white rounded-xl border border-gray-200 px-3 py-2 flex items-center gap-2 shadow-sm">
                                                            <div className="flex flex-col items-center justify-center rounded-full border-2 shrink-0"
                                                                style={{ width: 36, height: 36, borderColor: "#c62828", backgroundColor: "#fff5f5" }}>
                                                                <span className="font-black" style={{ fontSize: 12, color: "#c62828", lineHeight: 1 }}>{ann.points_earned !== "" ? ann.points_earned : "—"}</span>
                                                                <span className="font-bold" style={{ fontSize: 7, color: "#c62828", opacity: 0.6 }}>/{ann.max_points}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-black text-gray-700 truncate">{ann.label}</p>
                                                                <p className="text-[9px] text-gray-400">p.{ann.pageIndex + 1} · {ann.points_earned !== "" ? `${ann.points_earned}/${ann.max_points}` : "non noté"}</p>
                                                            </div>
                                                            {!isLocked && (
                                                                <button type="button" onClick={() => removeAnnotation(ann.id)}
                                                                    className="p-1 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors shrink-0">
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Total */}
                                        {annotations.length > 0 && (
                                            <div className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                                                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Total</span>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="font-black text-white" style={{ fontSize: 24 }}>{totalEarned}</span>
                                                    <span className="font-bold text-white/40 text-base">/{totalMax}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Note manuelle */}
                                        <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" disabled={isLocked} checked={useManual} onChange={e => setUseManual(e.target.checked)} className="rounded" />
                                                <span className="text-[11px] font-bold text-gray-600">Note manuelle</span>
                                            </label>
                                            {useManual ? (
                                                <input type="text" disabled={isLocked} value={manualGrade} onChange={e => setManualGrade(e.target.value)}
                                                    placeholder="Ex: 15/20" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-bold focus:outline-none disabled:opacity-50" style={{ color: "#1a237e" }} />
                                            ) : (
                                                <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono font-bold" style={{ color: "#1a237e" }}>
                                                    {effectiveGrade() || <span className="text-gray-400 font-normal text-xs">Auto-calculée</span>}
                                                </div>
                                            )}
                                            {savedGrade && (
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                                                    <CheckCircle className="h-3 w-3 shrink-0" /> Enregistrée : <span className="font-black">{savedGrade}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Appréciation */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Appréciation</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {APPRECIATIONS.map(a => {
                                                    const active = appreciation === a.value;
                                                    return (
                                                        <button key={a.value} type="button" disabled={isLocked}
                                                            onClick={() => setAppreciation(active ? "" : a.value)}
                                                            className="px-2 py-1 rounded-lg text-[10px] font-bold border-2 transition-all disabled:opacity-50"
                                                            style={{ backgroundColor: active ? a.bg : "white", borderColor: active ? a.color : "#e8eaf6", color: active ? a.color : "#9ca3af" }}>
                                                            {a.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Observations */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Observations</p>
                                            <textarea disabled={isLocked} value={comments} onChange={e => setComments(e.target.value)}
                                                placeholder="Observations sur la copie…" rows={3}
                                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none resize-none disabled:opacity-50" />
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-col gap-2 mt-auto pt-3 border-t border-gray-200">
                                            {!isLocked ? (
                                                <>
                                                    <button type="submit" disabled={isSubmitting || !effectiveGrade()}
                                                        className="w-full py-3 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 disabled:opacity-40 hover:opacity-90"
                                                        style={{ backgroundColor: "#1a237e", boxShadow: effectiveGrade() ? "0 4px 14px rgba(26,35,126,0.3)" : undefined }}>
                                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Enregistrement…</> : <><Save className="h-4 w-4" />Enregistrer</>}
                                                    </button>
                                                    {savedGrade && (
                                                        <button type="button" disabled={isLocking} onClick={handleLock}
                                                            className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex justify-center items-center gap-2 disabled:opacity-60 hover:opacity-90"
                                                            style={{ backgroundColor: "#b71c1c" }}>
                                                            {isLocking ? <><Loader2 className="h-4 w-4 animate-spin" />Verrouillage…</> : <><Lock className="h-4 w-4" />Verrouiller</>}
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold">
                                                    <Lock className="h-3.5 w-3.5" /> Correction verrouillée
                                                </div>
                                            )}
                                            <button type="button" onClick={() => !isSubmitting && !isLocking && setSelectedResponse(null)}
                                                disabled={isSubmitting || isLocking}
                                                className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50">
                                                Fermer
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ════ MODAL CONFIRMATION SIGNATURE ════ */}
            <AnimatePresence>
                {showSignModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                        <motion.div
                            className="absolute inset-0"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            onClick={() => !isSigning && setShowSignModal(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 12 }}
                            transition={{ duration: 0.18, ease: "easeOut" }}
                            onClick={e => e.stopPropagation()}
                            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden z-10"
                        >
                            {/* Header modal */}
                            <div className="px-6 py-5 flex items-center gap-4" style={{ backgroundColor: allGraded ? "#2e7d32" : "#1a237e" }}>
                                <div className="bg-white/15 p-2.5 rounded-xl shrink-0">
                                    <PenLine className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-white tracking-tight">Confirmer la fin de correction</h3>
                                    <p className="text-white/60 text-xs mt-0.5">Cette action notifie l&apos;évaluateur</p>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="px-6 py-5 space-y-4">
                                {/* Compteur copies */}
                                <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 border border-gray-200">
                                    <span className="text-sm text-gray-500 font-medium">Copies corrigées</span>
                                    <span className="text-sm font-extrabold" style={{ color: allGraded ? "#2e7d32" : "#b45309" }}>
                                        {myResponses.filter(r => !!r.exam_grade).length} / {myResponses.length}
                                    </span>
                                </div>

                                {/* Blocage si copies non corrigées */}
                                {!allGraded ? (
                                    <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                                        <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-800 font-medium leading-relaxed">
                                            <span className="font-black">Impossible de signer.</span>{" "}
                                            {myResponses.length - myResponses.filter(r => !!r.exam_grade).length} copie(s) ne sont pas encore corrigées.
                                            Terminez toutes les corrections avant de notifier l&apos;évaluateur.
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-600 leading-relaxed">
                                        En confirmant, l&apos;évaluateur recevra une notification indiquant que{" "}
                                        <span className="font-bold text-gray-800">{correctorEmail}</span>{" "}
                                        a terminé de corriger toutes les copies qui lui sont assignées.
                                    </p>
                                )}

                                {/* Actions */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setShowSignModal(false)}
                                        disabled={isSigning}
                                        className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        {allGraded ? "Annuler" : "Fermer"}
                                    </button>
                                    {allGraded && (
                                        <button
                                            onClick={async () => { setShowSignModal(false); await handleSign(); }}
                                            disabled={isSigning}
                                            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                                            style={{ backgroundColor: "#2e7d32" }}
                                        >
                                            {isSigning
                                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                                                : <><CheckCircle className="h-4 w-4" /> Confirmer &amp; notifier</>}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
}
