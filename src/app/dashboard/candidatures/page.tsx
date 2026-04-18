"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    Folder,
    CalendarDays,
    FolderOpen,
    Loader2,
    ChevronRight,
    Users,
    Download,
} from "lucide-react";
import { motion } from "framer-motion";

import {
    fetchSessions,
    fetchSessionResponses,
    downloadSessionDossiersZip,
    type Session,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface CandidatureRow {
    _id: string;
    public_id?: string;
    candidate_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    answers?: Record<string, any>;
    documents_validation?: Record<string, { valid?: boolean; resubmit_requested?: boolean }>;
}

const FORMATION_FIELD = "Certification souhaitée";
const UNCATEGORIZED = "Sans formation renseignée";

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

export default function CandidaturesPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [rows, setRows] = useState<CandidatureRow[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingRows, setLoadingRows] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    useEffect(() => {
        (async () => {
            try {
                setLoadingSessions(true);
                const list = await fetchSessions();
                setSessions(list);
                const firstActive = list.find(s => s.status === "active") || list[0];
                if (firstActive) setSelectedId(firstActive._id);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoadingSessions(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedId) {
            setRows([]);
            return;
        }
        (async () => {
            try {
                setLoadingRows(true);
                const r = await fetchSessionResponses(selectedId);
                setRows(r);
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

    const formations = useMemo(() => {
        const map = new Map<string, CandidatureRow[]>();
        for (const name of PREDEFINED_FORMATIONS) map.set(name, []);

        for (const r of rows) {
            const raw = r.answers?.[FORMATION_FIELD];
            const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
            if (!map.has(name)) map.set(name, []);
            map.get(name)!.push(r);
        }

        return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
    }, [rows]);

    async function handleExport() {
        if (!selectedId || exporting) return;
        try {
            setExporting(true);
            await downloadSessionDossiersZip(selectedId, selectedSession?.name);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de l'export");
        } finally {
            setExporting(false);
        }
    }

    if (isLoading || !user) return null;

    const totalCandidats = rows.length;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <FolderOpen className="h-6 w-6" />
                        Revue des demandes
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Sélectionnez une formation pour consulter les demandes associées.
                    </p>
                </div>
                {selectedId && (
                    <button
                        onClick={handleExport}
                        disabled={exporting || totalCandidats === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                        title="Télécharger tous les dossiers en ZIP"
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {exporting ? "Préparation…" : "Exporter (ZIP)"}
                    </button>
                )}
            </div>

            {/* Session picker */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                {loadingSessions ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des sessions…
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-sm text-gray-500">
                        Aucune session créée. Rendez-vous sur{" "}
                        <Link href="/dashboard/sessions" className="font-bold text-indigo-600 hover:underline">
                            Sessions
                        </Link>{" "}
                        pour en créer une.
                    </div>
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
                                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
                                style={{
                                    backgroundColor: selectedSession.status === "active" ? "#e8f5e9" : "#ffebee",
                                    color: selectedSession.status === "active" ? "#2e7d32" : "#c62828",
                                }}
                            >
                                {selectedSession.status}
                            </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                            {totalCandidats} dossier{totalCandidats > 1 ? "s" : ""}
                        </span>
                    </div>
                )}
            </div>


            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Formation folders */}
            {loadingRows ? (
                <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
            ) : !selectedId ? null : formations.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                    <Folder className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">Aucun dossier disponible.</p>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {formations.map((f, i) => {
                        const pending = f.items.filter(r => !r.status || r.status === "pending").length;
                        const approved = f.items.filter(r => r.status === "approved").length;
                        const isEmpty = f.items.length === 0;
                        return (
                            <motion.div
                                key={f.name}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.03 }}
                            >
                                <Link
                                    href={`/dashboard/candidatures/formation?session=${encodeURIComponent(selectedId)}&name=${encodeURIComponent(f.name)}`}
                                    className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all h-full"
                                >
                                    <div
                                        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: isEmpty ? "#f3f4f6" : "#fff8e1" }}
                                    >
                                        <Folder className="h-5 w-5" style={{ color: isEmpty ? "#9ca3af" : "#f59e0b" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 leading-snug line-clamp-2">
                                            {f.name}
                                        </h3>
                                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                                            <span className="inline-flex items-center gap-1">
                                                <Users className="h-3 w-3" /> {f.items.length} candidat{f.items.length > 1 ? "s" : ""}
                                            </span>
                                            {pending > 0 && (
                                                <span className="inline-flex items-center gap-1 text-amber-700">
                                                    {pending} en attente
                                                </span>
                                            )}
                                            {approved > 0 && (
                                                <span className="inline-flex items-center gap-1 text-green-700">
                                                    {approved} validé{approved > 1 ? "s" : ""}
                                                </span>
                                            )}
                                            {isEmpty && (
                                                <span className="text-gray-400 italic">Vide</span>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                </Link>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
