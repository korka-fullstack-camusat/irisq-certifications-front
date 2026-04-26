"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Bell,
    Clock,
    CalendarDays,
    CheckCircle2,
    Loader2,
    Folder,
    Users,
    ChevronRight,
    Trophy,
    XCircle,
} from "lucide-react";

import {
    fetchSessions,
    fetchSessionResponses,
    type Session,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface CandidatureRow {
    _id: string;
    public_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    exam_mode?: string;
    answers?: Record<string, any>;
    exam_grade?: string;
    jury_grade?: string;
    final_decision?: string;
}

const FORMATION_FIELD = "Certification souhaitée";
const UNCATEGORIZED = "Sans certification renseignée";

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

function formatRelative(iso?: string) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function generateId(r: CandidatureRow) {
    return (r as any).candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;
}

export default function ComiteDashboardPage() {
    const { user, isLoading } = useAuth();

    const SELECTED_SESSION_KEY = "irisq_comite_dashboard_session";

    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedId, setSelectedId] = useState<string>(() =>
        typeof window !== "undefined" ? localStorage.getItem(SELECTED_SESSION_KEY) || "" : ""
    );
    const [rows, setRows] = useState<CandidatureRow[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingRows, setLoadingRows] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const cachedId = typeof window !== "undefined" ? localStorage.getItem(SELECTED_SESSION_KEY) || "" : "";

        const sessionsPromise = fetchSessions().then(list => {
            setSessions(list);
            const valid = cachedId && list.some((s: Session) => s._id === cachedId);
            if (!valid) {
                const firstActive = list.find((s: Session) => s.status === "active") || list[0];
                if (firstActive) {
                    setSelectedId(firstActive._id);
                    localStorage.setItem(SELECTED_SESSION_KEY, firstActive._id);
                }
            }
            return list;
        }).catch(e => {
            setError(e instanceof Error ? e.message : "Erreur");
            return [];
        }).finally(() => setLoadingSessions(false));

        const rowsPromise = cachedId
            ? fetchSessionResponses(cachedId).then(data => { setRows(data); }).catch(() => {})
            : Promise.resolve();

        setLoadingRows(!!cachedId);
        Promise.all([sessionsPromise, rowsPromise]).finally(() => setLoadingRows(false));
    }, []);

    const isFirstMount = useRef(true);
    useEffect(() => {
        if (isFirstMount.current) { isFirstMount.current = false; return; }
        if (!selectedId) { setRows([]); return; }
        localStorage.setItem(SELECTED_SESSION_KEY, selectedId);
        (async () => {
            try {
                setLoadingRows(true);
                setRows(await fetchSessionResponses(selectedId));
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoadingRows(false);
            }
        })();
    }, [selectedId]);

    const selectedSession = useMemo(
        () => sessions.find(s => s._id === selectedId) || null,
        [sessions, selectedId],
    );

    // Copies in the comité queue (corrected)
    const correctedRows = useMemo(() => rows.filter(r => !!(r as any).exam_grade), [rows]);

    // Pending jury decisions (no final_decision yet)
    const pendingDecision = useMemo(() => correctedRows.filter(r => !r.final_decision), [correctedRows]);

    const formations = useMemo(() => {
        const map = new Map<string, CandidatureRow[]>();
        for (const name of PREDEFINED_FORMATIONS) map.set(name, []);
        for (const r of correctedRows) {
            const raw = r.answers?.[FORMATION_FIELD];
            const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
            if (!map.has(name)) map.set(name, []);
            map.get(name)!.push(r);
        }
        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [correctedRows]);

    if (isLoading || !user) return null;

    return (
        <div className="space-y-6">

            {/* ── En-tête ── */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
                        Tableau de bord
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Vue d&apos;ensemble des copies corrigées par certification.
                    </p>
                </div>
            </div>

            {/* ── Session picker ── */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                {loadingSessions ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des sessions…
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-sm text-gray-500">Aucune session disponible.</div>
                ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Session
                        </label>
                        <select
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-w-[240px]"
                        >
                            {sessions.map(s => (
                                <option key={s._id} value={s._id}>
                                    {s.name} {s.status === "active" ? "• active" : "• fermée"}
                                </option>
                            ))}
                        </select>
                        {selectedSession && (
                            <span
                                className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full border"
                                style={{
                                    borderColor: selectedSession.status === "active" ? "#2e7d32" : "#9ca3af",
                                    color: selectedSession.status === "active" ? "#2e7d32" : "#6b7280",
                                }}
                            >
                                {selectedSession.status}
                            </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                            {correctedRows.length} copie{correctedRows.length > 1 ? "s" : ""} corrigée{correctedRows.length > 1 ? "s" : ""}
                        </span>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            {/* ── Copies par certification ── */}
            {selectedId && !loadingRows && (
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Copies par certification</p>
                    {formations.every(f => f.items.length === 0) ? (
                        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                            <Folder className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-500 text-sm">Aucune copie corrigée disponible pour cette session.</p>
                        </div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {formations.map((f, i) => {
                                const pendingCount = f.items.filter(r => !r.final_decision).length;
                                const certifiedCount = f.items.filter(r => r.final_decision === "certified").length;
                                const rejectedCount = f.items.filter(r => r.final_decision === "rejected").length;
                                const isEmpty = f.items.length === 0;
                                return (
                                    <motion.div
                                        key={f.name}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                    >
                                        <Link
                                            href={`/comite/dashboard/formation?session=${encodeURIComponent(selectedId)}&name=${encodeURIComponent(f.name)}`}
                                            className="group flex items-start gap-4 p-4 rounded-xl bg-white border border-gray-200 hover:border-gray-400 hover:shadow-sm transition-all h-full"
                                        >
                                            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100">
                                                <Folder className="h-5 w-5 text-gray-500" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-800 text-sm leading-snug line-clamp-2">{f.name}</h3>
                                                <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Users className="h-3 w-3" /> {f.items.length} copie{f.items.length > 1 ? "s" : ""}
                                                    </span>
                                                    {pendingCount > 0 && <span>{pendingCount} en attente</span>}
                                                    {certifiedCount > 0 && <span className="text-green-600">{certifiedCount} certifié{certifiedCount > 1 ? "s" : ""}</span>}
                                                    {rejectedCount > 0 && <span className="text-red-500">{rejectedCount} rejeté{rejectedCount > 1 ? "s" : ""}</span>}
                                                    {isEmpty && <span className="italic">Vide</span>}
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors shrink-0 mt-0.5" />
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {loadingRows && selectedId && (
                <div className="p-8 flex justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                </div>
            )}

            {/* ── Décisions en cours ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                    <h2 className="text-sm font-black uppercase tracking-widest inline-flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <Bell className="h-4 w-4" />
                        Décisions en cours
                    </h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">
                        {pendingDecision.length} en attente
                    </span>
                </div>

                {loadingRows ? (
                    <div className="p-10 flex justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    </div>
                ) : !selectedId ? (
                    <div className="p-10 text-center text-sm text-gray-500">
                        Aucune session sélectionnée.
                    </div>
                ) : pendingDecision.length === 0 ? (
                    <div className="p-10 text-center">
                        <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                        <p className="text-sm text-gray-500">
                            {correctedRows.length === 0
                                ? "Aucune copie corrigée pour cette session."
                                : "Toutes les copies ont une décision finale."}
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {pendingDecision.slice(0, 8).map((r, i) => {
                            const id = generateId(r);
                            const certification = r.answers?.[FORMATION_FIELD];
                            return (
                                <motion.li
                                    key={r._id}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                >
                                    <Link
                                        href={`/comite${certification ? `?formation=${encodeURIComponent(certification)}` : ""}`}
                                        className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-gray-100">
                                            {r.jury_grade ? (
                                                <Trophy className="h-4 w-4 text-gray-500" />
                                            ) : (
                                                <Clock className="h-4 w-4 text-gray-400" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-bold text-gray-800 font-mono truncate">{id}</p>
                                                {(r as any).exam_grade && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                                        style={{ background: "#fff5f5", color: "#c62828", borderColor: "#fecaca" }}>
                                                        Correcteur : {(r as any).exam_grade}
                                                    </span>
                                                )}
                                                {r.jury_grade && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                                                        style={{ background: "#e3f2fd", color: "#1a237e", borderColor: "#90caf9" }}>
                                                        Jury : {r.jury_grade}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 mt-0.5 truncate">
                                                {r.jury_grade
                                                    ? "Note jury posée — décision finale à prendre"
                                                    : "En attente de la note jury"}
                                                {certification ? ` • ${certification}` : ""}
                                            </p>
                                        </div>
                                        <div className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                                            {formatRelative(r.submitted_at)}
                                        </div>
                                    </Link>
                                </motion.li>
                            );
                        })}
                    </ul>
                )}

                {pendingDecision.length > 8 && (
                    <div className="px-5 py-3 border-t border-gray-100 text-center">
                        <Link href="/comite" className="text-xs font-bold hover:underline" style={{ color: "#1a237e" }}>
                            Voir les {pendingDecision.length - 8} autres copies en attente →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
