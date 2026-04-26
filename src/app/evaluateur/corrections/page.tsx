"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, X, Eye, Loader2, ClipboardList,
    ShieldAlert, ShieldCheck, CheckCircle2, UserCheck,
    Edit3, Camera, FileText, AlertTriangle,
    ChevronLeft, ChevronRight, Lock, Clock, Maximize2,
} from "lucide-react";
import { fetchSessions, fetchSessionResponses, unblockExam, API_URL } from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const ITEMS_PER_PAGE = 10;

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveUrl(url: string) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_URL.replace("/api", "")}${url}`;
}

function generateId(r: any) {
    return r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;
}

interface RenderedPage { dataUrl: string; width: number; height: number; }

const APPRECIATION_COLORS: Record<string, { color: string; bg: string }> = {
    "Insuffisant":  { color: "#c62828", bg: "#ffebee" },
    "Passable":     { color: "#e65100", bg: "#fff3e0" },
    "Satisfaisant": { color: "#1565c0", bg: "#e3f2fd" },
    "Bien":         { color: "#2e7d32", bg: "#e8f5e9" },
    "Très bien":    { color: "#4a148c", bg: "#f3e5f5" },
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CorrectionsPage() {
    const [responses, setResponses] = useState<any[]>([]);
    const [isLoading, setIsLoading]  = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected]    = useState<any>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);
    const [isUnblocking, setIsUnblocking] = useState(false);
    const [modalView, setModalView] = useState<"main" | "webcam" | "alerts">("main");
    const [activePhotoIdx, setActivePhotoIdx] = useState(0);

    // ── PDF.js rendering ──────────────────────────────────────────────────────
    const [pdfjsReady, setPdfjsReady]         = useState(false);
    const [renderedPages, setRenderedPages]   = useState<RenderedPage[]>([]);
    const [isRenderingPdf, setIsRenderingPdf] = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);
    const [totalPdfPages, setTotalPdfPages]   = useState(0);

    // ── Chargement de toutes les sessions ──────────────────────────────────
    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const sessions = await fetchSessions();
                const chunks = await Promise.all(
                    sessions.map((s: any) => fetchSessionResponses(s._id).catch(() => []))
                );
                const all: any[] = ([] as any[]).concat(...chunks);
                const withExam = all.filter(
                    (r: any) => r.status === "approved" &&
                        (r.exam_document || (r.exam_answers && r.exam_answers.length > 0) || r.exam_blocked)
                );
                // dédoublonner par _id
                const seen = new Set<string>();
                setResponses(withExam.filter(r => { if (seen.has(r._id)) return false; seen.add(r._id); return true; }));
            } catch (err) {
                console.error("Erreur chargement corrections", err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    // ── Chargement PDF.js CDN ────────────────────────────────────────────────
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

    // ── Rendu PDF quand on sélectionne une copie corrigée ────────────────────
    useEffect(() => {
        if (!pdfjsReady || !selected?.exam_grade || !selected?.exam_document) return;
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
    }, [pdfjsReady, selected?._id]);

    // ── Filtrage ───────────────────────────────────────────────────────────
    const filtered = responses.filter(r => {
        const q = searchQuery.toLowerCase();
        return (
            generateId(r).toLowerCase().includes(q) ||
            (r.profile?.toLowerCase().includes(q) ?? false) ||
            (r.assigned_examiner_email?.toLowerCase().includes(q) ?? false)
        );
    });
    const totalPages  = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paginated   = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6">
            {/* ── En-tête ── */}
            <div>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Résultats des Corrections</h1>
                <p className="text-gray-400 text-sm mt-1">Consultez les copies soumises et leurs résultats de correction.</p>
            </div>

            {/* ── Recherche ── */}
            <div className="bg-white p-3.5 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#e8eaf6" }}>
                <Search className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                <input
                    type="text"
                    placeholder="Rechercher par matricule, profil, correcteur…"
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
                {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setCurrentPage(1); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-400">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ── Contenu ── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24" style={{ color: "#1a237e" }}>
                    <Loader2 className="h-8 w-8 animate-spin mb-3" />
                    <p className="text-sm font-bold animate-pulse">Chargement des copies…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-16 text-center border shadow-sm" style={{ borderColor: "#e8eaf6" }}>
                    <div className="w-16 h-16 bg-[#e8eaf6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8" style={{ color: "#1a237e" }} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Aucune copie disponible</h3>
                    <p className="text-gray-500 text-sm">Il n'y a pas encore de copies soumises correspondant à votre recherche.</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs uppercase font-bold border-b" style={{ backgroundColor: "#f4f6f9", borderColor: "#e8eaf6", color: "#1a237e" }}>
                            <tr>
                                <th className="px-5 py-3.5">Candidat</th>
                                <th className="px-5 py-3.5 hidden sm:table-cell">Profil / Certification</th>
                                <th className="px-5 py-3.5">Anti-Triche</th>
                                <th className="px-5 py-3.5">Correction</th>
                                <th className="px-5 py-3.5 text-right">Détails</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: "#f0f2f5" }}>
                            {paginated.map(r => {
                                const hasAlerts = r.cheat_alerts && r.cheat_alerts.length > 0;
                                const isGraded  = !!r.exam_grade;
                                const isBlocked = !!r.exam_blocked;
                                return (
                                    <tr key={r._id} className={`hover:bg-gray-50/60 transition-colors ${isBlocked ? "bg-rose-50/40" : ""}`}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${isBlocked ? "bg-rose-100 text-rose-700" : "bg-[#e8eaf6] text-[#1a237e]"}`}>
                                                    {generateId(r).slice(-4)}
                                                </div>
                                                <div>
                                                    <span className="font-bold text-gray-900 text-xs font-mono">{generateId(r)}</span>
                                                    {isBlocked && (
                                                        <p className="text-[10px] text-rose-600 font-bold uppercase tracking-wider mt-0.5">Accès bloqué</p>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell">
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{r.profile || "—"}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {isBlocked ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-300">
                                                    <Lock className="h-3 w-3" /> Bloqué
                                                </span>
                                            ) : hasAlerts ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                    <ShieldAlert className="h-3 w-3" /> {r.cheat_alerts.length} alerte(s)
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                    <ShieldCheck className="h-3 w-3" /> Clean
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {isBlocked ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200">
                                                    <Clock className="h-3 w-3" /> Non soumis
                                                </span>
                                            ) : isGraded ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    <CheckCircle2 className="h-3 w-3" /> {r.exam_grade}
                                                </span>
                                            ) : r.assigned_examiner_email ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                    <UserCheck className="h-3 w-3" /> En cours
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                    <Edit3 className="h-3 w-3" /> À corriger
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <button
                                                onClick={() => setSelected(r)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:-translate-y-0.5"
                                                style={{ borderColor: "#1a237e", color: "#1a237e", backgroundColor: "#e8eaf6" }}
                                            >
                                                <Eye className="h-3.5 w-3.5" /> Voir
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {totalPages > 1 && (
                        <div className="px-5 py-3.5 border-t flex items-center justify-between bg-[#f4f6f9]" style={{ borderColor: "#e8eaf6" }}>
                            <p className="text-xs text-gray-500">
                                Page <span className="font-bold" style={{ color: "#1a237e" }}>{currentPage}</span> / {totalPages}
                                {" "}· {filtered.length} copie{filtered.length > 1 ? "s" : ""}
                            </p>
                            <div className="flex items-center gap-1.5">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-[#e8eaf6] disabled:opacity-40 transition-colors" style={{ color: "#1a237e" }}>
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                        if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                                        acc.push(p); return acc;
                                    }, [])
                                    .map((p, idx) => p === "..." ? (
                                        <span key={`e-${idx}`} className="text-gray-400 text-sm px-1">…</span>
                                    ) : (
                                        <button key={p} onClick={() => setCurrentPage(p as number)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === p ? "text-white" : "border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]"}`}
                                            style={currentPage === p ? { backgroundColor: "#1a237e" } : {}}>
                                            {p}
                                        </button>
                                    ))}
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg border border-gray-200 hover:bg-[#e8eaf6] disabled:opacity-40 transition-colors" style={{ color: "#1a237e" }}>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════
                MODAL DÉTAIL COPIE
            ══════════════════════════════════════════ */}
            <AnimatePresence>
                {selected && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                            onClick={() => { setSelected(null); setModalView("main"); setRenderedPages([]); }}
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.94, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.94, y: 20 }}
                            transition={{ duration: 0.22 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl w-full pointer-events-auto flex flex-col overflow-hidden"
                                style={{
                                    border: "2px solid #e8eaf6",
                                    maxWidth: "860px",
                                    maxHeight: "90vh",
                                }}
                            >
                                {/* ── Header ── */}
                                <div
                                    className="px-6 py-4 flex items-center justify-between shrink-0"
                                    style={{ backgroundColor: selected.exam_blocked ? "#b71c1c" : "#1a237e" }}
                                >
                                    <div className="flex items-center gap-3">
                                        {/* Bouton retour quand on est dans une sous-vue */}
                                        {modalView !== "main" && (
                                            <button
                                                onClick={() => setModalView("main")}
                                                className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors mr-1"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                        )}
                                        <div className="bg-white/10 p-2 rounded-xl">
                                            {modalView === "webcam" ? <Camera className="h-4 w-4 text-white" /> :
                                             modalView === "alerts" ? <ShieldAlert className="h-4 w-4 text-white" /> :
                                             selected.exam_blocked ? <Lock className="h-4 w-4 text-white" /> :
                                             <ClipboardList className="h-4 w-4 text-white" />}
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white uppercase tracking-wide">
                                                {modalView === "webcam" ? "Surveillance webcam" :
                                                 modalView === "alerts" ? "Alertes anti-triche" :
                                                 selected.exam_blocked ? "Candidat Bloqué" : "Résultat de correction"}
                                            </h2>
                                            <p className="text-white/60 text-xs font-mono mt-0.5">{generateId(selected)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Boutons Surveillance + Alertes uniquement sur la vue principale */}
                                        {modalView === "main" && !selected.exam_blocked && (
                                            <>
                                                <button
                                                    onClick={() => { setActivePhotoIdx(0); setModalView("webcam"); }}
                                                    disabled={!selected.candidate_photos?.length}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-white/25 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.2)" }}
                                                >
                                                    <Camera className="h-3.5 w-3.5" />
                                                    Surveillance
                                                    {!!selected.candidate_photos?.length && (
                                                        <span className="bg-white/30 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                                            {selected.candidate_photos.length}
                                                        </span>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => setModalView("alerts")}
                                                    disabled={!selected.cheat_alerts?.length}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                                    style={{ backgroundColor: "#dc2626", color: "#fff", border: "1px solid #b91c1c" }}
                                                >
                                                    <ShieldAlert className="h-3.5 w-3.5" />
                                                    Alertes
                                                    {!!selected.cheat_alerts?.length && (
                                                        <span className="bg-white/25 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                                                            {selected.cheat_alerts.length}
                                                        </span>
                                                    )}
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => { setSelected(null); setModalView("main"); setRenderedPages([]); }}
                                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* ══ VUE : CANDIDAT BLOQUÉ ══ */}
                                {selected.exam_blocked && (
                                    <div className="flex-1 flex flex-col justify-between p-6">
                                        <div className="space-y-4">
                                            <div className="flex items-start gap-4 bg-rose-50 border border-rose-200 rounded-2xl p-5">
                                                <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-1">Motif de blocage</p>
                                                    <p className="font-bold text-rose-800 text-sm">
                                                        {selected.exam_blocked_reason || "Accès bloqué pendant l'examen"}
                                                    </p>
                                                    {selected.exam_blocked_at && (
                                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                                            <Clock className="h-3 w-3" />
                                                            {new Date(selected.exam_blocked_at).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-400 text-center">En débloquant cet accès, un email sera automatiquement envoyé au candidat.</p>
                                        </div>
                                        <div className="flex gap-3 pt-6">
                                            <button onClick={() => { setSelected(null); setRenderedPages([]); }} className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50" style={{ borderColor: "#e0e0e0", color: "#555" }}>Fermer</button>
                                            <button
                                                disabled={isUnblocking}
                                                onClick={async () => {
                                                    setIsUnblocking(true);
                                                    const targetId = selected._id;
                                                    try {
                                                        await unblockExam(targetId);
                                                        setResponses(prev => prev.filter(r => r._id !== targetId));
                                                        setSelected(null); setRenderedPages([]);
                                                    } catch (e: any) {
                                                        alert(e.message || "Erreur lors du déblocage.");
                                                    } finally { setIsUnblocking(false); }
                                                }}
                                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 12px rgba(46,125,50,0.25)" }}
                                            >
                                                {isUnblocking ? <><Loader2 className="h-4 w-4 animate-spin" />Déblocage…</> : <><ShieldCheck className="h-4 w-4" />Débloquer l&apos;accès</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* ══ VUE : COPIE PRINCIPALE ══ */}
                                {!selected.exam_blocked && modalView === "main" && (
                                    <>
                                        {selected.exam_grade ? (
                                            /* ── CORRIGÉ : PDF rendu + bulles annotations ── */
                                            <div className="flex flex-1 overflow-hidden">
                                                {/* Zone PDF scrollable */}
                                                <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: "#e8eaf6" }}>
                                                    {/* Barre titre */}
                                                    <div className="px-4 py-2 flex items-center justify-between shrink-0 border-b" style={{ backgroundColor: "#f4f6f9", borderColor: "#e8eaf6" }}>
                                                        <div className="flex items-center gap-2">
                                                            <FileText className="h-3.5 w-3.5" style={{ color: "#1a237e" }} />
                                                            <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1a237e" }}>Copie corrigée</span>
                                                            {isRenderingPdf && totalPdfPages > 0 && (
                                                                <span className="text-[10px] text-gray-400 font-medium">{renderProgress}/{totalPdfPages} pages</span>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() => setPreviewFile({ url: resolveUrl(selected.exam_document), title: `Copie — ${generateId(selected)}` })}
                                                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                                                            style={{ backgroundColor: "#1a237e" }}
                                                        >
                                                            <Maximize2 className="h-3 w-3" /> Plein écran
                                                        </button>
                                                    </div>

                                                    {/* Pages PDF + annotations */}
                                                    <div className="flex-1 overflow-y-auto bg-gray-700" style={{ minHeight: 0 }}>
                                                        {/* Barre de progression */}
                                                        {(isRenderingPdf || renderedPages.length === 0) && (
                                                            <div className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-sm px-4 py-2 flex items-center gap-3">
                                                                <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" />
                                                                <span className="text-white text-xs font-medium">
                                                                    {totalPdfPages > 0
                                                                        ? `Chargement… ${renderProgress}/${totalPdfPages} pages`
                                                                        : "Chargement de la copie…"}
                                                                </span>
                                                                {totalPdfPages > 0 && (
                                                                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                                                        <div className="h-full bg-white rounded-full transition-all"
                                                                            style={{ width: `${(renderProgress / totalPdfPages) * 100}%` }} />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="py-4 flex flex-col items-center gap-4">
                                                            {renderedPages.map((page, pageIdx) => (
                                                                <div key={pageIdx} className="relative shadow-2xl select-none"
                                                                    style={{ width: "min(100%, 780px)" }}>
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img src={page.dataUrl} alt={`Page ${pageIdx + 1}`}
                                                                        className="w-full block" draggable={false} />

                                                                    {/* Overlay bulles annotations */}
                                                                    <div className="absolute inset-0 pointer-events-none">
                                                                        {(selected.answer_grades || [])
                                                                            .filter((g: any) => (g.page_index ?? 0) === pageIdx)
                                                                            .map((g: any, i: number) => (
                                                                                <div key={i} className="absolute"
                                                                                    style={{
                                                                                        left: `${g.x ?? 10}%`,
                                                                                        top:  `${g.y ?? 10}%`,
                                                                                        transform: "translate(-50%, -50%)",
                                                                                        zIndex: 10,
                                                                                    }}>
                                                                                    <div className="flex flex-col items-center gap-0.5">
                                                                                        <div className="flex flex-col items-center justify-center rounded-full border-[3px]"
                                                                                            style={{
                                                                                                width: 44, height: 44,
                                                                                                borderColor: "#c62828",
                                                                                                backgroundColor: "rgba(255,255,255,0.96)",
                                                                                                boxShadow: "0 2px 10px rgba(198,40,40,0.4)",
                                                                                            }}>
                                                                                            <span className="font-black leading-none"
                                                                                                style={{ fontSize: 15, color: "#c62828" }}>
                                                                                                {g.points_earned ?? "—"}
                                                                                            </span>
                                                                                            <span className="font-bold leading-none"
                                                                                                style={{ fontSize: 7, color: "#c62828", opacity: 0.7 }}>
                                                                                                /{g.max_points}
                                                                                            </span>
                                                                                        </div>
                                                                                        <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/95 shadow-sm"
                                                                                            style={{ color: "#c62828" }}>
                                                                                            {g.label || g.question_id || `Q${i + 1}`}
                                                                                        </span>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                    </div>

                                                                    {/* ── Tampon note finale (page 1 uniquement) ── */}
                                                                    {pageIdx === 0 && selected.exam_grade && (
                                                                        <div className="absolute pointer-events-none"
                                                                            style={{ top: "2%", right: "2%", zIndex: 20 }}>
                                                                            <div className="flex flex-col items-center gap-1"
                                                                                style={{ transform: "rotate(-8deg)" }}>
                                                                                <div className="flex flex-col items-center justify-center rounded-full border-[4px]"
                                                                                    style={{
                                                                                        width: 88, height: 88,
                                                                                        borderColor: "#c62828",
                                                                                        backgroundColor: "rgba(255,255,255,0.95)",
                                                                                        boxShadow: "0 0 0 2px rgba(198,40,40,0.15), 0 4px 16px rgba(198,40,40,0.3)",
                                                                                    }}>
                                                                                    <span className="font-black leading-tight text-center px-1"
                                                                                        style={{
                                                                                            fontSize: selected.exam_grade.length > 5 ? 14 : 20,
                                                                                            color: "#c62828",
                                                                                            lineHeight: 1.1,
                                                                                        }}>
                                                                                        {selected.exam_grade}
                                                                                    </span>
                                                                                    <span className="font-black uppercase tracking-widest"
                                                                                        style={{ fontSize: 7, color: "#c62828", opacity: 0.6 }}>
                                                                                        NOTE
                                                                                    </span>
                                                                                </div>
                                                                                {selected.exam_appreciation && (() => {
                                                                                    const c = APPRECIATION_COLORS[selected.exam_appreciation] || { color: "#374151", bg: "#f3f4f6" };
                                                                                    return (
                                                                                        <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                                                                            style={{ color: c.color, backgroundColor: c.bg }}>
                                                                                            {selected.exam_appreciation}
                                                                                        </span>
                                                                                    );
                                                                                })()}
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
                                                </div>

                                            </div>
                                        ) : (
                                            /* ── NON CORRIGÉ : document seul ── */
                                            <div className="flex-1 flex flex-col overflow-hidden">
                                                {selected.exam_document ? (
                                                    <>
                                                        <div className="px-5 py-2.5 flex items-center justify-between shrink-0 border-b" style={{ backgroundColor: "#f4f6f9", borderColor: "#e8eaf6" }}>
                                                            <div className="flex items-center gap-2">
                                                                <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1a237e" }}>Copie du candidat</span>
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                                                                    En attente de correction
                                                                </span>
                                                            </div>
                                                            <button
                                                                onClick={() => setPreviewFile({ url: resolveUrl(selected.exam_document), title: `Copie — ${generateId(selected)}` })}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                                                                style={{ backgroundColor: "#1a237e" }}
                                                            >
                                                                <Maximize2 className="h-3.5 w-3.5" /> Plein écran
                                                            </button>
                                                        </div>
                                                        <div className="flex-1" style={{ backgroundColor: "#e8e8e8", minHeight: 0 }}>
                                                            <iframe src={resolveUrl(selected.exam_document)} className="w-full h-full" title={`Copie — ${generateId(selected)}`} />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 flex-1">
                                                        <FileText className="h-10 w-10 mb-3 opacity-30" />
                                                        <p className="text-sm">Aucune copie disponible pour ce candidat.</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        <div className="px-6 py-3 shrink-0 border-t flex justify-end" style={{ borderColor: "#e8eaf6" }}>
                                            <button onClick={() => { setSelected(null); setModalView("main"); setRenderedPages([]); }} className="px-6 py-2.5 rounded-xl text-sm font-bold border hover:bg-gray-50" style={{ borderColor: "#e0e0e0", color: "#555" }}>Fermer</button>
                                        </div>
                                    </>
                                )}

                                {/* ══ VUE : SURVEILLANCE WEBCAM ══ */}
                                {!selected.exam_blocked && modalView === "webcam" && (() => {
                                    const photos: string[] = selected.candidate_photos || [];
                                    const photoLabel = (i: number) => i === 0 ? "Début d'épreuve" : i === photos.length - 1 ? "Fin d'épreuve" : "Milieu d'épreuve";
                                    const activeUrl = resolveUrl(photos[activePhotoIdx] || "");
                                    return (
                                        <div className="flex-1 overflow-y-auto">
                                            {photos.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                                    <Camera className="h-10 w-10 mb-3 opacity-30" />
                                                    <p className="text-sm">Aucune photo enregistrée pour cet examen.</p>
                                                </div>
                                            ) : (
                                                <div className="p-6 space-y-4">
                                                    {/* Photo principale */}
                                                    <div className="relative rounded-xl overflow-hidden bg-gray-900 flex items-center justify-center" style={{ height: 340 }}>
                                                        <img
                                                            key={activeUrl}
                                                            src={activeUrl}
                                                            alt={`Capture ${activePhotoIdx + 1}`}
                                                            className="max-h-full max-w-full object-contain"
                                                            onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                                                        />
                                                        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg">
                                                            {photoLabel(activePhotoIdx)}
                                                        </div>
                                                        <button
                                                            onClick={() => setPreviewFile({ url: activeUrl, title: `${photoLabel(activePhotoIdx)} — ${generateId(selected)}` })}
                                                            className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-lg transition-colors"
                                                        >
                                                            <Maximize2 className="h-3.5 w-3.5" />
                                                        </button>
                                                        {activePhotoIdx > 0 && (
                                                            <button onClick={() => setActivePhotoIdx(i => i - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-1.5 rounded-lg transition-colors">
                                                                <ChevronLeft className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        {activePhotoIdx < photos.length - 1 && (
                                                            <button onClick={() => setActivePhotoIdx(i => i + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/75 text-white p-1.5 rounded-lg transition-colors">
                                                                <ChevronRight className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    {/* Thumbnails */}
                                                    {photos.length > 1 && (
                                                        <div className="flex gap-3 justify-center flex-wrap">
                                                            {photos.map((url, i) => {
                                                                const isActive = i === activePhotoIdx;
                                                                return (
                                                                    <button key={i} onClick={() => setActivePhotoIdx(i)} className="flex flex-col items-center gap-1.5">
                                                                        <div className="rounded-xl overflow-hidden border-2 transition-all" style={{ width: 96, height: 68, borderColor: isActive ? "#1a237e" : "#e8eaf6", boxShadow: isActive ? "0 0 0 2px #1a237e40" : "none" }}>
                                                                            <img src={resolveUrl(url)} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" onError={e => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }} />
                                                                        </div>
                                                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-[#1a237e]" : "text-gray-400"}`}>{photoLabel(i)}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                {/* ══ VUE : ALERTES ══ */}
                                {!selected.exam_blocked && modalView === "alerts" && (
                                    <div className="flex-1 overflow-y-auto p-5 space-y-2 bg-rose-50">
                                        {(selected.cheat_alerts || []).length === 0 ? (
                                            <p className="text-sm text-gray-400 text-center py-10">Aucune alerte enregistrée.</p>
                                        ) : (selected.cheat_alerts as string[]).map((alert, i) => (
                                            <div key={i} className="flex items-start gap-3 bg-white border border-rose-100 rounded-xl px-3 py-2.5 shadow-sm">
                                                <div className="h-5 w-5 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-black text-xs shrink-0 mt-0.5">{i + 1}</div>
                                                <p className="text-xs font-mono text-rose-900 leading-relaxed">{alert}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {previewFile && (
                <FilePreviewModal url={previewFile.url} title={previewFile.title} onClose={() => setPreviewFile(null)} />
            )}
        </div>
    );
}

// ─── Sous-composants ─────────────────────────────────────────────────────────

function InfoCard({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
            <div className="px-4 py-2 border-b" style={{ backgroundColor: "#e8eaf6", borderColor: "#d0d4f0" }}>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1a237e" }}>{label}</p>
            </div>
            <div className="px-4 py-3">{children}</div>
        </div>
    );
}

function ResultField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div>
            <p className="text-xs font-bold text-gray-500 mb-1">{label}</p>
            <p className={`text-sm font-bold ${highlight ? "text-2xl" : ""}`} style={{ color: highlight ? "#1a237e" : "#374151" }}>
                {value}
            </p>
        </div>
    );
}
