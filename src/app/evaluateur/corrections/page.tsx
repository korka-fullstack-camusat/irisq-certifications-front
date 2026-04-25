"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, X, Eye, Loader2, ClipboardList,
    ShieldAlert, ShieldCheck, CheckCircle2, UserCheck,
    Edit3, Camera, FileText, AlertTriangle,
    ChevronLeft, ChevronRight,
} from "lucide-react";
import { fetchSessions, fetchSessionResponses, API_URL } from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const ITEMS_PER_PAGE = 10;

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveUrl(url: string) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_URL.replace("/api", "")}${url}`;
}

function generateId(r: any) {
    return r.public_id || r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CorrectionsPage() {
    const [responses, setResponses] = useState<any[]>([]);
    const [isLoading, setIsLoading]  = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selected, setSelected]    = useState<any>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

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
                        (r.exam_document || (r.exam_answers && r.exam_answers.length > 0))
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
                                return (
                                    <tr key={r._id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">
                                                    {generateId(r).slice(-4)}
                                                </div>
                                                <span className="font-bold text-gray-900 text-xs font-mono">{generateId(r)}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 hidden sm:table-cell">
                                            <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg">{r.profile || "—"}</span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {hasAlerts ? (
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
                                            {isGraded ? (
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
                        {/* Overlay */}
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
                            onClick={() => setSelected(null)}
                        />

                        {/* Modal */}
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
                                style={{ border: "2px solid #e8eaf6", maxWidth: "900px", maxHeight: "90vh" }}
                            >
                                {/* ── Header ── */}
                                <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#1a237e" }}>
                                    <div className="flex items-center gap-3">
                                        <div className="bg-white/10 p-2 rounded-xl">
                                            <ClipboardList className="h-4 w-4 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-bold text-white uppercase tracking-wide">Résultat de correction</h2>
                                            <p className="text-white/60 text-xs font-mono mt-0.5">{generateId(selected)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {/* Badge anti-triche dans le header */}
                                        {selected.cheat_alerts?.length > 0 && (
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500 text-white">
                                                <ShieldAlert className="h-3.5 w-3.5" />
                                                {selected.cheat_alerts.length} alerte(s)
                                            </span>
                                        )}
                                        <button onClick={() => setSelected(null)} className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* ── Body scrollable ── */}
                                <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f4f6f9" }}>
                                    <div className="p-5 space-y-5">

                                        {/* ── Info candidat + correcteur ── */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <InfoCard label="Candidat">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-black text-xs shrink-0">
                                                        {generateId(selected).slice(-4)}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-800 text-sm">{generateId(selected)}</p>
                                                        {selected.profile && <p className="text-xs text-gray-500">{selected.profile}</p>}
                                                    </div>
                                                </div>
                                            </InfoCard>
                                            <InfoCard label="Correcteur assigné">
                                                <div className="flex items-center gap-2">
                                                    <UserCheck className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                                                    <span className="text-sm font-semibold text-gray-700 truncate">
                                                        {selected.assigned_examiner_email || <em className="text-gray-400 font-normal">Aucun</em>}
                                                    </span>
                                                </div>
                                            </InfoCard>
                                        </div>

                                        {/* ── Résultat de correction ── */}
                                        {selected.exam_grade ? (
                                            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                                                <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ backgroundColor: "#e8eaf6", borderColor: "#d0d4f0" }}>
                                                    <CheckCircle2 className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                    <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1a237e" }}>Résultat de correction</p>
                                                </div>
                                                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                    <ResultField label="Note" value={selected.exam_grade} highlight />
                                                    <ResultField label="Statut" value={selected.exam_status || "—"} />
                                                    <ResultField label="Commentaires" value={selected.exam_comments || "—"} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-amber-700 text-sm font-semibold">
                                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                                Correction non encore effectuée
                                            </div>
                                        )}

                                        {/* ── Copie du candidat (iframe) ── */}
                                        {selected.exam_document && (
                                            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                                                <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ backgroundColor: "#e8eaf6", borderColor: "#d0d4f0" }}>
                                                    <div className="flex items-center gap-2">
                                                        <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1a237e" }}>Copie du candidat</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setPreviewFile({ url: resolveUrl(selected.exam_document), title: `Copie — ${generateId(selected)}` })}
                                                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg hover:bg-[#d0d4f0] transition-colors"
                                                        style={{ color: "#1a237e" }}
                                                    >
                                                        <Eye className="h-3.5 w-3.5" /> Plein écran
                                                    </button>
                                                </div>
                                                <div style={{ height: "360px", backgroundColor: "#f0f0f0" }}>
                                                    <iframe
                                                        src={resolveUrl(selected.exam_document)}
                                                        className="w-full h-full"
                                                        title={`Copie — ${generateId(selected)}`}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Anti-triche ── */}
                                        {selected.cheat_alerts && selected.cheat_alerts.length > 0 && (
                                            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#fca5a5" }}>
                                                <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ backgroundColor: "#fef2f2", borderColor: "#fca5a5" }}>
                                                    <ShieldAlert className="h-4 w-4 text-rose-600" />
                                                    <p className="text-xs font-bold uppercase tracking-wide text-rose-700">
                                                        Rapport Anti-Triche — {selected.cheat_alerts.length} alerte(s)
                                                    </p>
                                                </div>
                                                <div className="p-4 space-y-2 max-h-48 overflow-y-auto bg-rose-50">
                                                    {selected.cheat_alerts.map((alert: string, i: number) => (
                                                        <div key={i} className="flex items-start gap-3 bg-white border border-rose-100 rounded-xl px-3 py-2.5 shadow-sm">
                                                            <div className="h-5 w-5 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-black text-xs shrink-0 mt-0.5">
                                                                {i + 1}
                                                            </div>
                                                            <p className="text-xs font-mono text-rose-900 leading-relaxed">{alert}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Photos de surveillance ── */}
                                        {selected.candidate_photos && selected.candidate_photos.length > 0 && (
                                            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                                                <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ backgroundColor: "#e8eaf6", borderColor: "#d0d4f0" }}>
                                                    <div className="flex items-center gap-2">
                                                        <Camera className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "#1a237e" }}>Surveillance webcam</p>
                                                    </div>
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#fff", color: "#1a237e" }}>
                                                        {selected.candidate_photos.length} photo(s)
                                                    </span>
                                                </div>
                                                <div className="p-4 flex gap-4 overflow-x-auto">
                                                    {selected.candidate_photos.map((photoUrl: string, i: number) => {
                                                        const full = resolveUrl(photoUrl);
                                                        const labels = ["Début d'épreuve", "Milieu d'épreuve", "Fin d'épreuve"];
                                                        const label = i === 0 ? labels[0] : i === selected.candidate_photos.length - 1 ? labels[2] : labels[1];
                                                        return (
                                                            <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5">
                                                                <button
                                                                    onClick={() => setPreviewFile({ url: full, title: `Surveillance ${i + 1} — ${generateId(selected)}` })}
                                                                    className="h-24 w-32 rounded-xl overflow-hidden border-2 hover:border-[#1a237e] transition-colors"
                                                                    style={{ borderColor: "#e8eaf6" }}
                                                                >
                                                                    <img src={full} alt={`Capture ${i + 1}`} className="w-full h-full object-cover" />
                                                                </button>
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* ── Footer ── */}
                                <div className="px-6 py-4 shrink-0 border-t flex justify-end" style={{ borderColor: "#e8eaf6" }}>
                                    <button
                                        onClick={() => setSelected(null)}
                                        className="px-6 py-2.5 rounded-xl text-sm font-bold border hover:bg-gray-50 transition-colors"
                                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                                    >
                                        Fermer
                                    </button>
                                </div>
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
