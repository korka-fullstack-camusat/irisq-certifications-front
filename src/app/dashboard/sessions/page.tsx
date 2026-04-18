"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    CalendarDays,
    Plus,
    Trash2,
    CheckCircle2,
    XCircle,
    Power,
    PowerOff,
    Loader2,
    Search,
    Filter,
} from "lucide-react";
import { motion } from "framer-motion";

import {
    fetchSessions,
    deleteSession,
    updateSession,
    type Session,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pagination, usePaginatedSlice } from "@/components/Pagination";

export default function SessionsPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    async function load() {
        try {
            setLoading(true);
            const list = await fetchSessions();
            setSessions(list);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    async function toggleStatus(s: Session) {
        try {
            setTogglingId(s._id);
            const next = s.status === "active" ? "closed" : "active";
            await updateSession(s._id, { status: next });
            await load();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur");
        } finally {
            setTogglingId(null);
        }
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return sessions.filter(s => {
            if (statusFilter !== "all" && s.status !== statusFilter) return false;
            if (!q) return true;
            return (s.name || "").toLowerCase().includes(q) ||
                (s.description || "").toLowerCase().includes(q);
        });
    }, [sessions, query, statusFilter]);

    useEffect(() => { setPage(1); }, [query, statusFilter, pageSize]);

    const paginated = usePaginatedSlice(filtered, page, pageSize);

    async function handleDelete(id: string) {
        if (!confirm("Supprimer cette session ? Les candidatures rattachées resteront visibles mais orphelines.")) return;
        try {
            await deleteSession(id);
            await load();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur");
        }
    }

    if (isLoading || !user) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                        Sessions de certification
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Créez une session et activez-la pour que les candidats puissent postuler.
                    </p>
                </div>
                <Link
                    href="/dashboard/sessions/create"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                >
                    <Plus className="h-4 w-4" />
                    Nouvelle session
                </Link>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Rechercher une session…"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                    <Filter className="h-3 w-3" />
                    <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400"
                    >
                        <option value="all">Tous les statuts</option>
                        <option value="active">Actives</option>
                        <option value="closed">Fermées</option>
                    </select>
                </label>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                    <CalendarDays className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">
                        {sessions.length === 0 ? "Aucune session créée pour le moment." : "Aucune session ne correspond à ces critères."}
                    </p>
                </div>
            ) : (
                <>
                <div className="grid gap-4 md:grid-cols-2">
                    {paginated.map((s, i) => {
                        const isActive = s.status === "active";
                        const isBusy = togglingId === s._id;
                        return (
                            <motion.div
                                key={s._id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col"
                            >
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="h-9 w-9 rounded-xl flex items-center justify-center"
                                            style={{ backgroundColor: "#e8eaf6" }}
                                        >
                                            <CalendarDays className="h-4 w-4" style={{ color: "#1a237e" }} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-800 leading-tight">{s.name}</h3>
                                            <p className="text-[11px] text-gray-400 mt-0.5">
                                                {s.start_date || "—"} {s.end_date ? `→ ${s.end_date}` : ""}
                                            </p>
                                        </div>
                                    </div>
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
                                        style={{
                                            backgroundColor: isActive ? "#e8f5e9" : "#ffebee",
                                            color: isActive ? "#2e7d32" : "#c62828",
                                        }}
                                    >
                                        {isActive ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                        {s.status}
                                    </span>
                                </div>
                                {s.description && (
                                    <p className="text-xs text-gray-500 mb-4 line-clamp-2">{s.description}</p>
                                )}
                                <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
                                    <button
                                        onClick={() => toggleStatus(s)}
                                        disabled={isBusy}
                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
                                        style={{
                                            backgroundColor: isActive ? "#c62828" : "#2e7d32",
                                        }}
                                        title={isActive ? "Désactiver la session" : "Activer la session"}
                                    >
                                        {isBusy ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : isActive ? (
                                            <PowerOff className="h-3 w-3" />
                                        ) : (
                                            <Power className="h-3 w-3" />
                                        )}
                                        {isActive ? "Désactiver" : "Activer"}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(s._id)}
                                        className="text-gray-400 hover:text-red-500 transition-colors"
                                        title="Supprimer"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
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
        </div>
    );
}
