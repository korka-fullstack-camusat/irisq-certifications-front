"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    Folder,
    User,
    Mail,
    Clock,
    ChevronRight,
    CalendarDays,
    CheckCircle2,
    AlertTriangle,
    Search,
    Filter,
    XCircle,
    Hourglass,
} from "lucide-react";
import { motion } from "framer-motion";

import { fetchSession, fetchSessionResponses, type Session } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pagination, usePaginatedSlice } from "@/components/Pagination";

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

export default function SessionDetailPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const sessionId = params?.id as string;

    const [session, setSession] = useState<Session | null>(null);
    const [rows, setRows] = useState<CandidatureRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    useEffect(() => {
        if (!sessionId) return;
        (async () => {
            try {
                setLoading(true);
                const [s, r] = await Promise.all([
                    fetchSession(sessionId),
                    fetchSessionResponses(sessionId),
                ]);
                setSession(s);
                setRows(r);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoading(false);
            }
        })();
    }, [sessionId]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return rows.filter(r => {
            if (statusFilter !== "all" && (r.status || "pending") !== statusFilter) return false;
            if (!q) return true;
            return (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q) ||
                (r.public_id || "").toLowerCase().includes(q);
        });
    }, [rows, query, statusFilter]);

    useEffect(() => { setPage(1); }, [query, statusFilter, pageSize]);

    const paginated = usePaginatedSlice(filtered, page, pageSize);

    function validationState(row: CandidatureRow): "all_valid" | "has_issue" | "pending" {
        const v = row.documents_validation || {};
        const entries = Object.values(v);
        if (entries.length === 0) return "pending";
        if (entries.some(e => e.resubmit_requested)) return "has_issue";
        if (entries.every(e => e.valid === true)) return "all_valid";
        return "pending";
    }

    if (isLoading || !user) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/sessions"
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="h-3 w-3" /> Retour aux sessions
            </Link>

            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <CalendarDays className="h-6 w-6" />
                        {session?.name || "Session"}
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Revue des demandes {rows.length > 0 && `— ${rows.length} dossier${rows.length > 1 ? "s" : ""}`}
                    </p>
                </div>
                {session && (
                    <span
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
                        style={{
                            backgroundColor: session.status === "active" ? "#e8f5e9" : "#ffebee",
                            color: session.status === "active" ? "#2e7d32" : "#c62828",
                        }}
                    >
                        {session.status}
                    </span>
                )}
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {!loading && rows.length > 0 && (
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Rechercher un candidat, un email, un code dossier…"
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
                            <option value="pending">En attente</option>
                            <option value="approved">Validée</option>
                            <option value="rejected">Rejetée</option>
                        </select>
                    </label>
                </div>
            )}

            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>
            ) : filtered.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                    <Folder className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">
                        {rows.length === 0 ? "Aucune candidature pour cette session." : "Aucune candidature ne correspond à ces critères."}
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3">
                        {paginated.map((r, i) => {
                            const state = validationState(r);
                            const status = (r.status || "pending") as "pending" | "approved" | "rejected";
                            return (
                                <motion.div
                                    key={r._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                >
                                    <Link
                                        href={`/dashboard/sessions/${sessionId}/candidats/${r._id}`}
                                        className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                                    >
                                        <div
                                            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: "#fff8e1" }}
                                        >
                                            <Folder className="h-5 w-5" style={{ color: "#f59e0b" }} />
                                        </div>
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
                                                {status === "approved" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                                                        <CheckCircle2 className="h-3 w-3" /> Validée
                                                    </span>
                                                )}
                                                {status === "rejected" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                                        <XCircle className="h-3 w-3" /> Rejetée
                                                    </span>
                                                )}
                                                {status === "pending" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                        <Hourglass className="h-3 w-3" /> En attente
                                                    </span>
                                                )}
                                                {state === "has_issue" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                                        <AlertTriangle className="h-3 w-3" /> Relance
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                                {r.email && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {r.email}
                                                    </span>
                                                )}
                                                {r.answers?.["Certification souhaitée"] && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <User className="h-3 w-3" /> {r.answers["Certification souhaitée"]}
                                                    </span>
                                                )}
                                                {r.submitted_at && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {new Date(r.submitted_at).toLocaleDateString("fr-FR")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                    </Link>
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
