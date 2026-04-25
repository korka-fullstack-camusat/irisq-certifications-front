"use client";

import { useState, useEffect, useCallback } from "react";
import {
    fetchResponses, updateExamGrade, fetchForms, getCertFormId, setCertFormId,
    API_URL, signCorrections, lockCorrection,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
    Loader2, Search, FileText, CheckCircle, AlertTriangle,
    X, Save, FilePenLine, FileCheck,
    ChevronLeft, ChevronRight, Eye, PenLine, PartyPopper,
    Lock, Maximize2,
} from "lucide-react";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const ITEMS_PER_PAGE = 8;

const APPRECIATIONS = [
    { label: "Insuffisant",  value: "Insuffisant",  color: "#c62828", bg: "#ffebee", border: "#ef9a9a" },
    { label: "Passable",     value: "Passable",     color: "#e65100", bg: "#fff3e0", border: "#ffcc80" },
    { label: "Satisfaisant", value: "Satisfaisant", color: "#1565c0", bg: "#e3f2fd", border: "#90caf9" },
    { label: "Bien",         value: "Bien",         color: "#2e7d32", bg: "#e8f5e9", border: "#a5d6a7" },
    { label: "Très bien",    value: "Très bien",    color: "#4a148c", bg: "#f3e5f5", border: "#ce93d8" },
];

export default function CorrecteurPage() {
    const [responses, setResponses]       = useState<any[]>([]);
    const [isLoading, setIsLoading]       = useState(true);
    const [searchQuery, setSearchQuery]   = useState("");
    const [selectedResponse, setSelectedResponse] = useState<any | null>(null);

    // Grading state — simple
    const [earnedPoints, setEarnedPoints] = useState("");
    const [maxPoints, setMaxPoints]       = useState("20");
    const [appreciation, setAppreciation] = useState("");
    const [comments, setComments]         = useState("");

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLocking, setIsLocking]       = useState(false);
    const [currentPage, setCurrentPage]   = useState(1);
    const [previewFile, setPreviewFile]   = useState<{ url: string; title?: string } | null>(null);
    const [isSigning, setIsSigning]       = useState(false);
    const [signed, setSigned]             = useState(false);

    const { user, logout, isLoading: isAuthLoading } = useAuth();
    const correctorEmail = user?.email || "";

    useEffect(() => { if (user) loadData(); }, [user]);

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
        } catch (error) {
            console.error("Failed to load data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateId = (r: any) => r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;

    const formatDate = (isoString: string) => {
        if (!isoString) return "—";
        return new Date(isoString).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
    };

    const resolveUrl = (u: string) => {
        if (!u) return "";
        if (u.startsWith("http")) return u;
        return `${API_URL.replace("/api", "")}${u}`;
    };

    const getExamDocUrl = (response: any): string | null =>
        response?.exam_document ? resolveUrl(response.exam_document) : null;

    // ── Open modal ─────────────────────────────────────────────────────────────
    const openGradingModal = (response: any) => {
        setSelectedResponse(response);
        setComments(response.exam_comments || "");
        setAppreciation(response.exam_appreciation || "");
        if (response.exam_grade) {
            const parts = String(response.exam_grade).split("/");
            setEarnedPoints(parts[0] ?? "");
            setMaxPoints(parts[1] ?? "20");
        } else {
            setEarnedPoints("");
            setMaxPoints("20");
        }
    };

    const effectiveGrade = useCallback(() => {
        if (earnedPoints === "" || earnedPoints === undefined) return "";
        return `${earnedPoints}/${maxPoints || "20"}`;
    }, [earnedPoints, maxPoints]);

    // ── Submit grade ───────────────────────────────────────────────────────────
    const handleGradeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedResponse) return;
        const grade = effectiveGrade();
        if (!grade) { alert("Veuillez saisir une note."); return; }

        setIsSubmitting(true);
        try {
            const updated = await updateExamGrade(selectedResponse._id, {
                exam_grade: grade,
                exam_status: "graded",
                exam_comments: comments || undefined,
                exam_appreciation: appreciation || undefined,
            });
            setResponses(prev => prev.map(r => r._id === updated._id ? updated : r));
            setSelectedResponse(updated);
            // Sync local fields with saved value
            const parts = String(updated.exam_grade || grade).split("/");
            setEarnedPoints(parts[0] ?? "");
            setMaxPoints(parts[1] ?? "20");
        } catch (error: any) {
            alert(error.message || "Erreur lors de la soumission de la note.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Lock ──────────────────────────────────────────────────────────────────
    const handleLock = async () => {
        if (!selectedResponse) return;
        if (!window.confirm("Voulez-vous vraiment verrouiller cette correction ? Vous ne pourrez plus la modifier ensuite.")) return;
        setIsLocking(true);
        try {
            const updated = await lockCorrection(selectedResponse._id);
            setResponses(prev => prev.map(r => r._id === updated._id ? updated : r));
            setSelectedResponse(updated);
        } catch (error: any) {
            alert(error.message || "Erreur lors du verrouillage.");
        } finally {
            setIsLocking(false);
        }
    };

    // ── Sign all ──────────────────────────────────────────────────────────────
    const myResponses = responses.filter(
        (r: any) => r.assigned_examiner_email?.toLowerCase() === correctorEmail.toLowerCase()
    );
    const allGraded = myResponses.length > 0 && myResponses.every((r: any) => !!r.exam_grade);

    const handleSign = async () => {
        setIsSigning(true);
        try { await signCorrections(); setSigned(true); }
        catch (err: any) { alert(err.message || "Erreur lors de la signature"); }
        finally { setIsSigning(false); }
    };

    const filteredResponses = responses.filter(r => {
        if (r.assigned_examiner_email?.toLowerCase() !== correctorEmail.toLowerCase()) return false;
        const q = searchQuery.toLowerCase();
        return generateId(r).toLowerCase().includes(q) ||
            (r.answers?.["Certification souhaitée"] || "").toLowerCase().includes(q);
    });

    const totalPages = Math.ceil(filteredResponses.length / ITEMS_PER_PAGE);
    const paginatedResponses = filteredResponses.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    if (isAuthLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[#f4f6f9]">
                <Loader2 className="animate-spin text-[#1a237e] h-8 w-8" />
            </div>
        );
    }

    const isLocked  = !!selectedResponse?.is_correction_locked;
    const savedGrade = selectedResponse?.exam_grade;
    const savedAppreciation = selectedResponse?.exam_appreciation;
    const stampAppr = APPRECIATIONS.find(a => a.value === savedAppreciation);

    return (
        <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">

            {/* ── Header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
                        Évaluations Candidats
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Connecté en tant que <span className="font-bold text-[#1a237e]">{correctorEmail}</span>
                    </p>
                </div>
                <button
                    onClick={logout}
                    className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-wider px-4 py-2 bg-white rounded-lg border shadow-sm border-gray-200 hover:border-red-200"
                >
                    Déconnexion
                </button>
            </div>

            {/* ── Signature banner ── */}
            {signed ? (
                <div className="flex items-center gap-3 px-5 py-4 rounded-2xl text-white font-bold shadow-lg" style={{ backgroundColor: "#2e7d32" }}>
                    <PartyPopper className="h-5 w-5 shrink-0" />
                    <span>Corrections signées avec succès — l&apos;évaluateur a été notifié.</span>
                </div>
            ) : allGraded && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 rounded-2xl border-2 shadow-sm" style={{ backgroundColor: "#e8f5e9", borderColor: "#2e7d32" }}>
                    <div className="flex items-center gap-3">
                        <CheckCircle className="h-6 w-6 shrink-0" style={{ color: "#2e7d32" }} />
                        <div>
                            <p className="font-bold" style={{ color: "#1b5e20" }}>Toutes les copies sont corrigées</p>
                            <p className="text-sm" style={{ color: "#388e3c" }}>Signez pour notifier l&apos;évaluateur que vous avez terminé.</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSign}
                        disabled={isSigning}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 shrink-0"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.3)" }}
                    >
                        {isSigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenLine className="h-4 w-4" />}
                        Signer les corrections
                    </button>
                </div>
            )}

            {/* ── Search ── */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#c5cae9" }}>
                <Search className="text-[#1a237e] h-5 w-5 shrink-0" />
                <input
                    type="text"
                    placeholder="Chercher par ID Candidat ou Certification…"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 uppercase"
                />
                {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ── Table ── */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">Liste des Copies</h2>
                    <div className="text-xs text-white/70">{filteredResponses.length} copie(s)</div>
                </div>

                {isLoading ? (
                    <div className="p-16 text-center text-gray-400">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#1a237e" }} />
                        <p className="text-sm">Chargement des copies…</p>
                    </div>
                ) : filteredResponses.length === 0 ? (
                    <div className="p-16 text-center text-gray-400">
                        <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-sm font-medium">Aucune copie trouvée.</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-12 px-6 py-3 bg-[#f8f9fa] border-b text-xs font-bold uppercase tracking-wider text-[#1a237e]" style={{ borderColor: "#e8eaf6" }}>
                            <div className="col-span-3">Candidat</div>
                            <div className="col-span-4">Certification</div>
                            <div className="col-span-2 text-center">Note</div>
                            <div className="col-span-1 text-center">Statut</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        <div className="divide-y" style={{ borderColor: "#f0f2f5" }}>
                            {paginatedResponses.map((response, idx) => {
                                const candidateId = generateId(response);
                                const graded = !!response.exam_grade;
                                const hasDoc = !!getExamDocUrl(response);
                                const locked = !!response.is_correction_locked;
                                const appr = APPRECIATIONS.find(a => a.value === response.exam_appreciation);

                                return (
                                    <motion.div
                                        key={response._id}
                                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                        transition={{ delay: idx * 0.03 }}
                                        className="grid grid-cols-12 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors group"
                                    >
                                        <div className="col-span-3 flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">
                                                {candidateId.slice(-4)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 tracking-wide text-sm group-hover:text-[#1a237e] transition-colors">{candidateId}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">{formatDate(response.submitted_at)}</p>
                                            </div>
                                        </div>

                                        <div className="col-span-4">
                                            <p className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg leading-tight inline-block max-w-[220px] truncate">
                                                {response.answers?.["Certification souhaitée"] || "Non spécifiée"}
                                            </p>
                                        </div>

                                        <div className="col-span-2 flex justify-center">
                                            {graded ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: "#e8f5e9", color: "#2e7d32", borderColor: "#c8e6c9" }}>
                                                        <CheckCircle className="h-3 w-3" /> {response.exam_grade}
                                                    </span>
                                                    {appr && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: appr.color, backgroundColor: appr.bg }}>
                                                            {appr.label}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border" style={{ background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }}>
                                                    <AlertTriangle className="h-3 w-3" /> En attente
                                                </span>
                                            )}
                                        </div>

                                        <div className="col-span-1 flex justify-center">
                                            {locked && (
                                                <span title="Correction verrouillée" className="text-rose-500"><Lock className="h-4 w-4" /></span>
                                            )}
                                        </div>

                                        <div className="col-span-2 flex items-center justify-end">
                                            <button
                                                onClick={() => openGradingModal(response)}
                                                disabled={!hasDoc}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                                                style={{ backgroundColor: "#1a237e" }}
                                                title={!hasDoc ? "Aucune copie soumise" : ""}
                                            >
                                                <FilePenLine className="h-3.5 w-3.5" />
                                                {graded ? (locked ? "Voir" : "Modifier") : "Corriger"}
                                            </button>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {totalPages > 1 && (
                            <div className="px-6 py-4 border-t flex items-center justify-between bg-[#f8f9fa]" style={{ borderColor: "#e8eaf6" }}>
                                <p className="text-xs text-gray-500 font-medium">
                                    Page <span className="font-bold text-[#1a237e]">{currentPage}</span> sur <span className="font-bold">{totalPages}</span>
                                    {" "}· {filteredResponses.length} résultat{filteredResponses.length !== 1 ? "s" : ""}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                        className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                        <ChevronLeft className="h-4 w-4" />
                                    </button>
                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                                            acc.push(p); return acc;
                                        }, [])
                                        .map((p, idx) =>
                                            p === "..." ? (
                                                <span key={`e-${idx}`} className="text-gray-400 text-sm font-bold px-1">…</span>
                                            ) : (
                                                <button key={p} onClick={() => setCurrentPage(p as number)}
                                                    className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === p ? "bg-[#1a237e] text-white" : "border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]"}`}>
                                                    {p}
                                                </button>
                                            )
                                        )}
                                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                        className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                        <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </motion.div>

            {/* ════════════════════════════════════════════════════════════
                MODAL CORRECTION
            ════════════════════════════════════════════════════════════ */}
            <AnimatePresence>
                {selectedResponse && (
                    <div className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm overflow-hidden">
                        {/* Overlay */}
                        <motion.div
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0"
                            onClick={() => !isSubmitting && !isLocking && setSelectedResponse(null)}
                        />

                        {/* Panel */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 30, stiffness: 200 }}
                            onClick={e => e.stopPropagation()}
                            className="relative ml-auto w-full max-w-6xl bg-white h-full shadow-2xl flex flex-col z-10"
                        >
                            {/* Header */}
                            <div
                                className="px-6 py-4 flex items-center justify-between shrink-0"
                                style={{ backgroundColor: isLocked ? "#b71c1c" : "#1a237e" }}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-white/10 p-2 rounded-lg">
                                        {isLocked
                                            ? <Lock className="h-4 w-4 text-white" />
                                            : <FilePenLine className="h-4 w-4 text-white" />}
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                                            {isLocked ? "Correction Verrouillée" : "Correction de copie"}
                                        </h2>
                                        <p className="text-xs text-white/60 font-mono mt-0.5">{generateId(selectedResponse)}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => !isSubmitting && !isLocking && setSelectedResponse(null)}
                                    disabled={isSubmitting || isLocking}
                                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {isLocked && (
                                <div className="bg-rose-50 border-b border-rose-200 px-6 py-2 flex items-center gap-2 text-rose-800 text-xs font-bold shrink-0">
                                    <Lock className="h-3.5 w-3.5 shrink-0" />
                                    Cette correction est verrouillée — aucune modification n&apos;est possible.
                                </div>
                            )}

                            {/* ── Body: split PDF | Notation ── */}
                            <div className="flex-1 flex overflow-hidden">

                                {/* ── LEFT : PDF viewer + tampon note ── */}
                                <div className="flex-[3] flex flex-col overflow-hidden border-r" style={{ borderColor: "#e8eaf6" }}>
                                    {/* Toolbar */}
                                    <div className="px-5 py-3 bg-[#f8f9fa] border-b flex items-center justify-between shrink-0" style={{ borderColor: "#e8eaf6" }}>
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-[#1a237e]" />
                                            <span className="text-xs font-bold text-[#1a237e] uppercase tracking-wider">Copie du candidat</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const u = getExamDocUrl(selectedResponse);
                                                if (u) setPreviewFile({ url: u, title: `Copie — ${generateId(selectedResponse)}` });
                                            }}
                                            disabled={!getExamDocUrl(selectedResponse)}
                                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a237e] bg-[#e8eaf6] px-3 py-1.5 rounded-lg hover:bg-[#c5cae9] transition-colors border border-[#c5cae9] disabled:opacity-50"
                                        >
                                            <Maximize2 className="h-3.5 w-3.5" /> Plein écran
                                        </button>
                                    </div>

                                    {/* PDF + tampon superposé */}
                                    <div className="flex-1 relative bg-gray-200">
                                        <iframe
                                            src={getExamDocUrl(selectedResponse) || ""}
                                            className="w-full h-full"
                                            title="Copie du candidat"
                                        />

                                        {/* ── Tampon note (style devoir école) ── */}
                                        <AnimatePresence>
                                            {savedGrade && (
                                                <motion.div
                                                    key="stamp"
                                                    initial={{ scale: 0, rotate: -25, opacity: 0 }}
                                                    animate={{ scale: 1, rotate: -14, opacity: 1 }}
                                                    exit={{ scale: 0, opacity: 0 }}
                                                    transition={{ type: "spring", damping: 12, stiffness: 200 }}
                                                    className="absolute bottom-8 right-8 pointer-events-none select-none"
                                                    style={{ filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.35))" }}
                                                >
                                                    <div
                                                        className="flex flex-col items-center justify-center rounded-full border-[5px]"
                                                        style={{
                                                            width: 120,
                                                            height: 120,
                                                            borderColor: stampAppr?.color ?? "#c62828",
                                                            backgroundColor: "rgba(255,255,255,0.92)",
                                                        }}
                                                    >
                                                        <span
                                                            className="font-black leading-none"
                                                            style={{ fontSize: 34, color: stampAppr?.color ?? "#c62828" }}
                                                        >
                                                            {String(savedGrade).split("/")[0]}
                                                        </span>
                                                        <span
                                                            className="font-bold leading-none mt-0.5"
                                                            style={{ fontSize: 15, color: stampAppr?.color ?? "#c62828", opacity: 0.75 }}
                                                        >
                                                            /{String(savedGrade).split("/")[1] ?? "20"}
                                                        </span>
                                                        {savedAppreciation && (
                                                            <span
                                                                className="mt-1 text-[9px] font-black uppercase tracking-widest text-center px-1 leading-tight"
                                                                style={{ color: stampAppr?.color ?? "#c62828", maxWidth: 88 }}
                                                            >
                                                                {savedAppreciation}
                                                            </span>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>

                                {/* ── RIGHT : Formulaire de notation simplifié ── */}
                                <div className="flex-[1.5] flex flex-col bg-gray-50 overflow-y-auto">
                                    <form onSubmit={handleGradeSubmit} className="flex flex-col flex-1 p-6 gap-6">

                                        {/* ── Scoreboard : note ── */}
                                        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-center">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4">Note attribuée</p>
                                            <div className="flex items-center justify-center gap-3">
                                                {/* Points obtenus */}
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={parseFloat(maxPoints) || 9999}
                                                    step="0.5"
                                                    disabled={isLocked}
                                                    value={earnedPoints}
                                                    onChange={e => setEarnedPoints(e.target.value)}
                                                    placeholder="—"
                                                    className="w-24 text-center font-black border-2 rounded-2xl focus:outline-none focus:border-[#1a237e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    style={{
                                                        fontSize: 42,
                                                        paddingTop: 12,
                                                        paddingBottom: 12,
                                                        color: "#1a237e",
                                                        borderColor: earnedPoints ? "#1a237e" : "#e8eaf6",
                                                    }}
                                                />
                                                <span className="text-3xl font-black text-gray-300">/</span>
                                                {/* Points max */}
                                                <input
                                                    type="number"
                                                    min="1"
                                                    disabled={isLocked}
                                                    value={maxPoints}
                                                    onChange={e => setMaxPoints(e.target.value)}
                                                    className="w-16 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:border-[#1a237e] text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors py-3"
                                                    style={{ borderColor: "#e8eaf6" }}
                                                />
                                            </div>
                                            {earnedPoints && (
                                                <p className="mt-3 text-xs text-gray-400">
                                                    La note <span className="font-black text-[#1a237e]">{effectiveGrade()}</span> sera apposée sur la copie.
                                                </p>
                                            )}
                                        </div>

                                        {/* ── Appréciation ── */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">Appréciation</p>
                                            <div className="flex flex-wrap gap-2">
                                                {APPRECIATIONS.map(a => {
                                                    const active = appreciation === a.value;
                                                    return (
                                                        <button
                                                            key={a.value}
                                                            type="button"
                                                            disabled={isLocked}
                                                            onClick={() => setAppreciation(active ? "" : a.value)}
                                                            className="px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                                                            style={{
                                                                backgroundColor: active ? a.bg : "white",
                                                                borderColor: active ? a.color : "#e8eaf6",
                                                                color: active ? a.color : "#9ca3af",
                                                            }}
                                                        >
                                                            {a.label}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* ── Observations ── */}
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Observations</p>
                                            <textarea
                                                disabled={isLocked}
                                                value={comments}
                                                onChange={e => setComments(e.target.value)}
                                                placeholder="Observations générales sur la copie…"
                                                rows={4}
                                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                                            />
                                        </div>

                                        {/* ── Actions ── */}
                                        <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-gray-200">
                                            {!isLocked ? (
                                                <>
                                                    <button
                                                        type="submit"
                                                        disabled={isSubmitting || !effectiveGrade()}
                                                        className="w-full py-3.5 text-white rounded-xl text-sm font-bold flex justify-center items-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                                        style={{ backgroundColor: "#1a237e", boxShadow: effectiveGrade() ? "0 4px 14px rgba(26,35,126,0.3)" : undefined }}
                                                    >
                                                        {isSubmitting
                                                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
                                                            : <><Save className="h-4 w-4" /> Enregistrer la note</>}
                                                    </button>

                                                    {savedGrade && (
                                                        <button
                                                            type="button"
                                                            disabled={isLocking}
                                                            onClick={handleLock}
                                                            className="w-full py-3 rounded-xl text-sm font-bold text-white flex justify-center items-center gap-2 transition-all hover:opacity-90 disabled:opacity-60"
                                                            style={{ backgroundColor: "#b71c1c" }}
                                                        >
                                                            {isLocking
                                                                ? <><Loader2 className="h-4 w-4 animate-spin" /> Verrouillage…</>
                                                                : <><Lock className="h-4 w-4" /> Valider &amp; verrouiller</>}
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 py-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm font-bold">
                                                    <Lock className="h-4 w-4" />
                                                    Correction verrouillée — aucune modification possible
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => !isSubmitting && !isLocking && setSelectedResponse(null)}
                                                disabled={isSubmitting || isLocking}
                                                className="w-full py-2.5 bg-white border border-gray-200 text-gray-500 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                                            >
                                                Fermer
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {previewFile && (
                <FilePreviewModal url={previewFile.url} title={previewFile.title} onClose={() => setPreviewFile(null)} />
            )}
        </div>
    );
}
