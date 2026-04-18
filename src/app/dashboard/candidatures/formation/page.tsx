"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Folder,
    Mail,
    Clock,
    ChevronRight,
    CheckCircle2,
    AlertTriangle,
    ArrowLeft,
    FolderOpen,
    Loader2,
    Search,
    Filter,
    XCircle,
    Hourglass,
    Monitor,
    MapPin,
    Users,
    Award,
    GraduationCap,
    Download,
} from "lucide-react";
import { motion } from "framer-motion";

import { fetchSessionResponses, fetchSession, downloadSessionDossiersZip, type Session } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pagination, usePaginatedSlice } from "@/components/Pagination";
import { ExportModal, type ExportScope } from "@/components/ExportModal";

interface CandidatureRow {
    _id: string;
    public_id?: string;
    candidate_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    exam_mode?: "online" | "onsite" | string;
    exam_type?: "direct" | "after_formation" | string;
    answers?: Record<string, any>;
    documents_validation?: Record<string, { valid?: boolean; resubmit_requested?: boolean }>;
}

const FORMATION_FIELD = "Certification souhaitée";
const UNCATEGORIZED = "Sans formation renseignée";

type ExamModeTab = "all" | "online" | "onsite";

function getExamMode(r: CandidatureRow): "online" | "onsite" | "" {
    const raw = (r.exam_mode || "").toString().toLowerCase().trim();
    if (raw === "online" || raw === "onsite") return raw;
    // Fallback — tolère une valeur stockée dans answers ("En ligne" / "Présentiel").
    const fromAnswers = (r.answers?.["Mode d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("ligne")) return "online";
    if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
    return "";
}

function examTypeLabel(r: CandidatureRow): string | null {
    const raw = (r.exam_type || "").toString().toLowerCase().trim();
    if (raw === "direct") return "Examen direct";
    if (raw === "after_formation") return "Après formation IRISQ";
    const fromAnswers = (r.answers?.["Type d'examen"] || "").toString().trim();
    return fromAnswers || null;
}


function FormationFolderInner() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session") || "";
    const formationName = searchParams.get("name") || "";

    const [session, setSession] = useState<Session | null>(null);
    const [rows, setRows] = useState<CandidatureRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
    const [modeTab, setModeTab] = useState<ExamModeTab>("all");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [exportOpen, setExportOpen] = useState(false);

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
                    fetchSession(sessionId).catch(() => null),
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

    const inFormation = useMemo(() => rows.filter(r => {
        const raw = r.answers?.[FORMATION_FIELD];
        const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
        return name === formationName;
    }), [rows, formationName]);

    const onlineCount = useMemo(() => inFormation.filter(r => getExamMode(r) === "online").length, [inFormation]);
    const onsiteCount = useMemo(() => inFormation.filter(r => getExamMode(r) === "onsite").length, [inFormation]);
    const otherCount = inFormation.length - onlineCount - onsiteCount;

    const candidates = useMemo(() => {
        const q = query.trim().toLowerCase();
        return inFormation.filter(r => {
            if (modeTab === "online" && getExamMode(r) !== "online") return false;
            if (modeTab === "onsite" && getExamMode(r) !== "onsite") return false;
            if (statusFilter !== "all" && (r.status || "pending") !== statusFilter) return false;
            if (!q) return true;
            return (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q) ||
                (r.public_id || "").toLowerCase().includes(q);
        });
    }, [inFormation, query, statusFilter, modeTab]);

    useEffect(() => { setPage(1); }, [query, statusFilter, pageSize, formationName, modeTab]);

    const paginated = usePaginatedSlice(candidates, page, pageSize);

    function validationState(row: CandidatureRow): "all_valid" | "has_issue" | "pending" {
        const v = row.documents_validation || {};
        const entries = Object.values(v);
        if (entries.length === 0) return "pending";
        if (entries.some(e => e.resubmit_requested)) return "has_issue";
        if (entries.every(e => e.valid === true)) return "all_valid";
        return "pending";
    }

    if (isLoading || !user) return null;

    if (!sessionId || !formationName) {
        return (
            <div className="p-8 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                Paramètres manquants. <Link href="/dashboard/candidatures" className="font-bold underline">Retour</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/candidatures"
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="h-3 w-3" /> Retour aux formations
            </Link>

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4 flex-wrap">
                <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#fff8e1" }}
                >
                    <FolderOpen className="h-5 w-5" style={{ color: "#f59e0b" }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Formation
                    </p>
                    <h1 className="text-xl font-black truncate" style={{ color: "#1a237e" }}>
                        {formationName}
                    </h1>
                    {session && (
                        <p className="text-xs text-gray-500 mt-1">
                            Session : <span className="font-semibold">{session.name}</span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400">
                        {candidates.length} candidat{candidates.length > 1 ? "s" : ""}
                    </span>
                    <button
                        type="button"
                        onClick={() => setExportOpen(true)}
                        disabled={inFormation.length === 0}
                        title="Exporter les dossiers complets au format ZIP"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.20)" }}
                    >
                        <Download className="h-3.5 w-3.5" /> Exporter
                    </button>
                </div>
            </div>

            <ExportModal
                open={exportOpen}
                title="Exporter les dossiers"
                subtitle={`Formation : ${formationName}. Choisissez les candidats à inclure dans l'archive ZIP.`}
                counts={{ all: inFormation.length, online: onlineCount, onsite: onsiteCount }}
                onClose={() => setExportOpen(false)}
                onConfirm={async (scope: ExportScope) => {
                    if (!sessionId) return;
                    await downloadSessionDossiersZip(sessionId, session?.name, {
                        formation: formationName,
                        mode: scope === "all" ? "" : scope,
                    });
                }}
            />

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Sous-dossiers par mode d'examen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                    { key: "all", label: "Tous les candidats", count: inFormation.length, icon: Users, color: "#1a237e", bg: "#e8eaf6", desc: "Vue globale" },
                    { key: "online", label: "Candidats en ligne", count: onlineCount, icon: Monitor, color: "#1a237e", bg: "#e8eaf6", desc: "Examen à distance" },
                    { key: "onsite", label: "Candidats présentiel", count: onsiteCount, icon: MapPin, color: "#2e7d32", bg: "#e8f5e9", desc: "Examen sur site" },
                ] as const).map(t => {
                    const Icon = t.icon;
                    const active = modeTab === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setModeTab(t.key as ExamModeTab)}
                            className="text-left p-4 rounded-2xl border shadow-sm transition-all hover:-translate-y-0.5"
                            style={{
                                backgroundColor: active ? t.bg : "#ffffff",
                                borderColor: active ? t.color : "#e5e7eb",
                                boxShadow: active ? `0 6px 16px ${t.color}22` : undefined,
                            }}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ backgroundColor: t.bg }}
                                >
                                    <Icon className="h-5 w-5" style={{ color: t.color }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: active ? t.color : "#9ca3af" }}>
                                        {t.desc}
                                    </p>
                                    <p className="text-sm font-bold text-gray-800 truncate">{t.label}</p>
                                </div>
                                <span
                                    className="text-lg font-black shrink-0"
                                    style={{ color: t.color }}
                                >
                                    {t.count}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
            {modeTab === "all" && otherCount > 0 && (
                <p className="text-[11px] text-gray-400 -mt-2 ml-1">
                    {otherCount} candidat{otherCount > 1 ? "s" : ""} sans mode d&apos;examen renseigné (candidatures antérieures).
                </p>
            )}

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

            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm inline-flex items-center justify-center gap-2 w-full">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
            ) : candidates.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                    <Folder className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">Aucun candidat pour cette formation.</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3">
                        {paginated.map((r, i) => {
                            const state = validationState(r);
                            const status = (r.status || "pending") as "pending" | "approved" | "rejected";
                            const mode = getExamMode(r);
                            const typeLabel = examTypeLabel(r);
                            const isDirect = (r.exam_type || "").toString().toLowerCase() === "direct";
                            return (
                                <motion.div
                                    key={r._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                >
                                    <Link
                                        href={`/dashboard/candidatures/${r._id}`}
                                        className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                                    >
                                        <div
                                            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            {(r.name || "?").substring(0, 2).toUpperCase()}
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
                                                {state === "all_valid" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                                        <CheckCircle2 className="h-3 w-3" /> Docs OK
                                                    </span>
                                                )}
                                                {state === "has_issue" && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                                        <AlertTriangle className="h-3 w-3" /> Relance
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
                                                {typeLabel && (
                                                    <span
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: isDirect ? "#fff8e1" : "#ecfdf5",
                                                            color: isDirect ? "#b45309" : "#047857",
                                                        }}
                                                    >
                                                        {isDirect ? <Award className="h-3 w-3" /> : <GraduationCap className="h-3 w-3" />}
                                                        {typeLabel}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                                                {r.email && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {r.email}
                                                    </span>
                                                )}
                                                {r.submitted_at && (
                                                    <span className="inline-flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {new Date(r.submitted_at).toLocaleDateString("fr-FR")}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        {status === "approved" && (
                                            <span
                                                className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}
                                            >
                                                <CheckCircle2 className="h-4 w-4" /> Validée
                                            </span>
                                        )}
                                        {status === "rejected" && (
                                            <span
                                                className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}
                                            >
                                                <XCircle className="h-4 w-4" /> Rejetée
                                            </span>
                                        )}
                                        {status === "pending" && (
                                            <span
                                                className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: "#fff8e1", color: "#b26a00", border: "1px solid #ffe0b2" }}
                                            >
                                                <Hourglass className="h-4 w-4" /> En attente
                                            </span>
                                        )}
                                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>

                    <Pagination
                        total={candidates.length}
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

export default function FormationFolderPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>}>
            <FormationFolderInner />
        </Suspense>
    );
}
