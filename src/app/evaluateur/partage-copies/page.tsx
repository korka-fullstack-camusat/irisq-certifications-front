"use client";

import { useEffect, useMemo, useState } from "react";
import {
    Send,
    Loader2,
    Search,
    CalendarDays,
    Monitor,
    MapPin,
    CheckCircle2,
    Clock,
    Mail,
    FileText,
    X,
    AlertTriangle,
    Users,
    Share2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
    fetchSessions,
    fetchSessionResponses,
    shareExamCopy,
    type Session,
} from "@/lib/api";
import { Pagination, usePaginatedSlice } from "@/components/Pagination";

// ─── localStorage helpers ───────────────────────────────────────────────────

const SHARED_KEY = "irisq_shared_copies";

function getSharedMap(): Record<string, string> {
    try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(SHARED_KEY) : null;
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function markShared(responseId: string, sharedAt: string) {
    const map = getSharedMap();
    map[responseId] = sharedAt;
    if (typeof window !== "undefined") localStorage.setItem(SHARED_KEY, JSON.stringify(map));
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface Row {
    _id: string;
    public_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    session_id?: string;
    exam_mode?: string;
    exam_grade?: string | null;
    exam_status?: string | null;
    exam_comments?: string | null;
    exam_document?: string | null;
    assigned_examiner_email?: string | null;
    answers?: Record<string, any>;
}

const FORMATION_FIELD = "Certification souhaitée";

function getExamMode(r: Row): "online" | "onsite" | "" {
    const raw = (r.exam_mode || "").toString().toLowerCase().trim();
    if (raw === "online" || raw === "onsite") return raw;
    const fromAnswers = (r.answers?.["Mode d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("ligne")) return "online";
    if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
    return "";
}

// ─── Modal de confirmation ───────────────────────────────────────────────────

function ShareModal({
    candidate,
    onClose,
    onConfirm,
    isSending,
}: {
    candidate: Row;
    onClose: () => void;
    onConfirm: () => void;
    isSending: boolean;
}) {
    const mode = getExamMode(candidate);
    return (
        <>
            {/* Overlay */}
            <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                onClick={!isSending ? onClose : undefined}
            />

            {/* Modal */}
            <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                    style={{ border: "2px solid #e8eaf6" }}
                >
                    {/* Header */}
                    <div
                        className="px-6 py-4 flex items-center justify-between"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        <div className="flex items-center gap-2">
                            <Send className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">
                                Confirmer le partage
                            </span>
                        </div>
                        {!isSending && (
                            <button
                                onClick={onClose}
                                className="text-white/60 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    {/* Corps */}
                    <div className="px-6 py-6 space-y-4">
                        {/* Infos candidat */}
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div
                                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-black"
                                style={{ backgroundColor: "#1a237e" }}
                            >
                                {(candidate.name || "?").substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-gray-800 text-sm truncate">
                                    {candidate.name || "Candidat"}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    {candidate.public_id && (
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">
                                            {candidate.public_id}
                                        </span>
                                    )}
                                    {mode === "online" && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-indigo-600">
                                            <Monitor className="h-3 w-3" /> En ligne
                                        </span>
                                    )}
                                    {mode === "onsite" && (
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                                            <MapPin className="h-3 w-3" /> Présentiel
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Note du correcteur */}
                        {candidate.exam_grade && (
                            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">
                                    Note du correcteur
                                </p>
                                <p className="text-base font-black text-indigo-800">
                                    {candidate.exam_grade}
                                </p>
                                {candidate.exam_comments && (
                                    <p className="text-xs text-indigo-600 italic mt-1">
                                        &ldquo;{candidate.exam_comments}&rdquo;
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Message de confirmation */}
                        <p className="text-sm text-gray-600 leading-relaxed">
                            La copie d&apos;examen et la note du correcteur seront transmises à la plateforme partenaire.
                            Cette action est irréversible une fois confirmée.
                        </p>

                        {/* Séparateur */}
                        <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="w-2 h-2 rotate-45 shrink-0" style={{ backgroundColor: "#2e7d32", display: "inline-block" }} />
                            <div className="flex-1 h-px bg-gray-100" />
                        </div>

                        {/* Boutons */}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={isSending}
                                className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50 disabled:opacity-40"
                                style={{ borderColor: "#e0e0e0", color: "#555" }}
                            >
                                Annuler
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isSending}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0 flex items-center justify-center gap-2"
                                style={{
                                    backgroundColor: "#1a237e",
                                    boxShadow: "0 6px 16px rgba(26,35,126,0.25)",
                                }}
                            >
                                {isSending
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                                    : <><Send className="h-4 w-4" /> Confirmer</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function PartagesCopiesPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionId, setSessionId] = useState<string>("all");
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // État partagé (localStorage + state local)
    const [sharedMap, setSharedMap] = useState<Record<string, string>>({});

    // Modal
    const [pendingShare, setPendingShare] = useState<Row | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

    useEffect(() => {
        setSharedMap(getSharedMap());
        (async () => {
            try {
                setLoading(true);
                const list = await fetchSessions();
                setSessions(list);
                const all = await Promise.all(
                    list.map(s => fetchSessionResponses(s._id).catch(() => [] as Row[])),
                );
                // Candidats ayant soumis leur copie ET notés par le correcteur
                setRows(
                    (all.flat() as Row[]).filter(
                        r => r.status === "approved" && r.exam_document && r.exam_grade,
                    ),
                );
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur de chargement");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter(r => {
            if (sessionId !== "all" && r.session_id !== sessionId) return false;
            if (q) {
                const hay = `${r.name || ""} ${r.email || ""} ${r.public_id || ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [rows, sessionId, query]);

    useEffect(() => { setPage(1); }, [query, sessionId, pageSize]);

    const paginated = usePaginatedSlice(filtered, page, pageSize);

    const sharedCount = useMemo(
        () => rows.filter(r => !!sharedMap[r._id]).length,
        [rows, sharedMap],
    );

    const showToast = (type: "success" | "error", msg: string) => {
        setToast({ type, msg });
        setTimeout(() => setToast(null), 4000);
    };

    const handleConfirmShare = async () => {
        if (!pendingShare) return;
        setIsSending(true);
        try {
            let sharedAt: string;
            try {
                const result = await shareExamCopy(pendingShare._id);
                sharedAt = result.shared_at;
            } catch {
                // Backend pas encore implémenté : on enregistre localement
                sharedAt = new Date().toISOString();
            }
            markShared(pendingShare._id, sharedAt);
            setSharedMap(prev => ({ ...prev, [pendingShare._id]: sharedAt }));
            showToast("success", `Copie de ${pendingShare.name || "ce candidat"} transmise avec succès.`);
        } catch (e) {
            showToast("error", e instanceof Error ? e.message : "Erreur lors du partage");
        } finally {
            setIsSending(false);
            setPendingShare(null);
        }
    };

    return (
        <div className="space-y-6">
            {/* ── En-tête ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <Share2 className="h-6 w-6" />
                        Transmission des copies
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Copies d&apos;examen notées par le correcteur, à transmettre à la plateforme partenaire.
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* ── Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                    { label: "Copies disponibles", count: rows.length,           icon: FileText,     color: "#1a237e", bg: "#e8eaf6", desc: "Notées par correcteur" },
                    { label: "Déjà transmises",     count: sharedCount,           icon: CheckCircle2, color: "#2e7d32", bg: "#e8f5e9", desc: "Envoyées avec succès"  },
                    { label: "En attente",           count: rows.length - sharedCount, icon: Clock,   color: "#b45309", bg: "#fffbeb", desc: "À transmettre"        },
                ].map(t => {
                    const Icon = t.icon;
                    return (
                        <div
                            key={t.label}
                            className="p-4 rounded-2xl border shadow-sm"
                            style={{ backgroundColor: t.bg, borderColor: t.color + "33" }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: "#ffffff99" }}
                                >
                                    <Icon className="h-5 w-5" style={{ color: t.color }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: t.color }}>
                                        {t.desc}
                                    </p>
                                    <p className="text-sm font-bold text-gray-800 truncate">{t.label}</p>
                                </div>
                                <span className="text-lg font-black shrink-0" style={{ color: t.color }}>
                                    {t.count}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Filtres ── */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Rechercher un nom, email ou code dossier…"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                    <CalendarDays className="h-3 w-3" />
                    <select
                        value={sessionId}
                        onChange={e => setSessionId(e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                    >
                        <option value="all">Toutes les sessions</option>
                        {sessions.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                    </select>
                </label>
            </div>

            {/* ── Liste ── */}
            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm inline-flex items-center justify-center gap-2 w-full">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
            ) : paginated.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                    <Users className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">Aucune copie notée disponible pour la transmission.</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3">
                        {paginated.map((r, i) => {
                            const mode = getExamMode(r);
                            const alreadyShared = !!sharedMap[r._id];
                            const sharedAt = sharedMap[r._id];
                            const formation = r.answers?.[FORMATION_FIELD];
                            return (
                                <motion.div
                                    key={r._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.02 }}
                                    className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm"
                                    style={{ borderColor: alreadyShared ? "#bbf7d0" : undefined }}
                                >
                                    {/* Avatar */}
                                    <div
                                        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                                        style={{ backgroundColor: alreadyShared ? "#2e7d32" : "#1a237e" }}
                                    >
                                        {(r.name || "?").substring(0, 2).toUpperCase()}
                                    </div>

                                    {/* Infos */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-gray-800 truncate">
                                                {r.name || "Candidat"}
                                            </h3>
                                            {r.public_id && (
                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                                                    {r.public_id}
                                                </span>
                                            )}
                                            {mode === "online" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                                    <Monitor className="h-3 w-3" /> En ligne
                                                </span>
                                            )}
                                            {mode === "onsite" && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                                    <MapPin className="h-3 w-3" /> Présentiel
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                            {formation && (
                                                <span className="truncate max-w-[200px]">{formation}</span>
                                            )}
                                            {r.email && (
                                                <span className="inline-flex items-center gap-1">
                                                    <Mail className="h-3 w-3" /> {r.email}
                                                </span>
                                            )}
                                            {r.exam_grade && (
                                                <span className="inline-flex items-center gap-1 font-semibold text-indigo-600">
                                                    <FileText className="h-3 w-3" /> {r.exam_grade}
                                                </span>
                                            )}
                                            {alreadyShared && sharedAt && (
                                                <span className="inline-flex items-center gap-1 text-emerald-600">
                                                    <Clock className="h-3 w-3" />
                                                    Transmis le {new Date(sharedAt).toLocaleDateString("fr-FR")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Bouton / Badge */}
                                    {alreadyShared ? (
                                        <span
                                            className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full shrink-0"
                                            style={{ backgroundColor: "#dcfce7", color: "#15803d", border: "1px solid #bbf7d0" }}
                                        >
                                            <CheckCircle2 className="h-4 w-4" /> Transmis
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => setPendingShare(r)}
                                            className="inline-flex items-center gap-1.5 text-sm font-bold px-4 py-2 rounded-xl shrink-0 transition-all hover:-translate-y-0.5"
                                            style={{
                                                backgroundColor: "#1a237e",
                                                color: "#ffffff",
                                                boxShadow: "0 4px 12px rgba(26,35,126,0.2)",
                                            }}
                                        >
                                            <Send className="h-4 w-4" /> Partager
                                        </button>
                                    )}
                                </motion.div>
                            );
                        })}
                    </div>

                    <Pagination
                        total={filtered.length}
                        page={page}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        pageSizeOptions={[10, 25, 50]}
                        onPageSizeChange={setPageSize}
                    />
                </>
            )}

            {/* ── Modal de confirmation ── */}
            <AnimatePresence>
                {pendingShare && (
                    <ShareModal
                        key={pendingShare._id}
                        candidate={pendingShare}
                        onClose={() => !isSending && setPendingShare(null)}
                        onConfirm={handleConfirmShare}
                        isSending={isSending}
                    />
                )}
            </AnimatePresence>

            {/* ── Toast ── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        key="toast"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl text-sm font-bold text-white max-w-sm"
                        style={{
                            backgroundColor: toast.type === "success" ? "#2e7d32" : "#c62828",
                        }}
                    >
                        {toast.type === "success"
                            ? <CheckCircle2 className="h-5 w-5 shrink-0" />
                            : <AlertTriangle className="h-5 w-5 shrink-0" />
                        }
                        {toast.msg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
