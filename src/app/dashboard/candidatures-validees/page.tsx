"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ShieldCheck,
    Mail,
    Clock,
    ChevronRight,
    CheckCircle2,
    Loader2,
    Search,
    CalendarDays,
    Download,
    Monitor,
    MapPin,
    Users,
    Award,
    GraduationCap,
    ClipboardCheck,
    Trophy,
    RotateCcw,
    Minus,
} from "lucide-react";
import { motion } from "framer-motion";

import {
    fetchSessions,
    fetchSessionResponses,
    downloadSessionDossiersZip,
    downloadAllDossiersZip,
    type Session,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pagination, usePaginatedSlice } from "@/components/Pagination";
import { ExportModal, type ExportScope } from "@/components/ExportModal";

interface Row {
    _id: string;
    public_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    session_id?: string;
    exam_mode?: "online" | "onsite" | string;
    exam_type?: "direct" | "after_formation" | string;
    exam_status?: string | null;
    exam_grade?: string | null;
    exam_document?: string | null;
    final_grade?: string | null;
    final_appreciation?: string | null;
    answers?: Record<string, any>;
}

type ProgressKey = "realized" | "passed" | "retake" | "none";

const PROGRESS_META: Record<ProgressKey, { label: string; icon: any; bg: string; color: string; border: string }> = {
    none: {
        label: "Pas encore",
        icon: Minus,
        bg: "#f3f4f6",
        color: "#6b7280",
        border: "#e5e7eb",
    },
    realized: {
        label: "Réalisé",
        icon: ClipboardCheck,
        bg: "#e8eaf6",
        color: "#1a237e",
        border: "#c5cae9",
    },
    passed: {
        label: "Réussi",
        icon: Trophy,
        bg: "#e8f5e9",
        color: "#2e7d32",
        border: "#c8e6c9",
    },
    retake: {
        label: "Rattrapage",
        icon: RotateCcw,
        bg: "#fff8e1",
        color: "#b26a00",
        border: "#ffe0b2",
    },
};

function deriveExamProgress(r: Row): ProgressKey {
    const es = (r.exam_status || "").toString().toLowerCase().trim();
    const hasFinal = !!(r.final_grade || r.final_appreciation);
    const hasExam = !!(r.exam_grade || r.exam_status || r.exam_document);
    if (es.includes("non acquis") || es === "rattrapage") return "retake";
    if (hasFinal || es === "acquis" || es === "admis") return "passed";
    if (hasExam) return "realized";
    return "none";
}

const FORMATION_FIELD = "Certification souhaitée";

type ExamModeTab = "all" | "online" | "onsite";

function getExamMode(r: Row): "online" | "onsite" | "" {
    const raw = (r.exam_mode || "").toString().toLowerCase().trim();
    if (raw === "online" || raw === "onsite") return raw;
    const fromAnswers = (r.answers?.["Mode d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("ligne")) return "online";
    if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
    return "";
}

function examTypeLabel(r: Row): string | null {
    const raw = (r.exam_type || "").toString().toLowerCase().trim();
    if (raw === "direct") return "Examen direct";
    if (raw === "after_formation") return "Après formation IRISQ";
    const fromAnswers = (r.answers?.["Type d'examen"] || "").toString().trim();
    return fromAnswers || null;
}

export default function CandidaturesValideesPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionId, setSessionId] = useState<string>("all");
    const [formation, setFormation] = useState<string>("all");
    const [modeTab, setModeTab] = useState<ExamModeTab>("all");
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [exportOpen, setExportOpen] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                const list = await fetchSessions();
                setSessions(list);
                const all = await Promise.all(list.map(s => fetchSessionResponses(s._id).catch(() => [] as Row[])));
                const merged: Row[] = all.flat();
                setRows(merged.filter(r => r.status === "approved"));
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const formations = useMemo(() => {
        const set = new Set<string>();
        for (const r of rows) {
            const raw = r.answers?.[FORMATION_FIELD];
            if (typeof raw === "string" && raw.trim()) set.add(raw.trim());
        }
        return Array.from(set).sort();
    }, [rows]);

    const baseFiltered = useMemo(() => {
        return rows.filter(r => {
            if (sessionId !== "all" && r.session_id !== sessionId) return false;
            if (formation !== "all") {
                const raw = r.answers?.[FORMATION_FIELD];
                const name = typeof raw === "string" ? raw.trim() : "";
                if (name !== formation) return false;
            }
            return true;
        });
    }, [rows, sessionId, formation]);

    const onlineCount = useMemo(() => baseFiltered.filter(r => getExamMode(r) === "online").length, [baseFiltered]);
    const onsiteCount = useMemo(() => baseFiltered.filter(r => getExamMode(r) === "onsite").length, [baseFiltered]);
    const otherCount = baseFiltered.length - onlineCount - onsiteCount;

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return baseFiltered.filter(r => {
            if (modeTab === "online" && getExamMode(r) !== "online") return false;
            if (modeTab === "onsite" && getExamMode(r) !== "onsite") return false;
            if (q) {
                const hay = `${r.name || ""} ${r.email || ""} ${r.public_id || ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [baseFiltered, modeTab, query]);

    useEffect(() => { setPage(1); }, [query, sessionId, formation, modeTab, pageSize]);

    const paginated = usePaginatedSlice(filtered, page, pageSize);

    async function handleExport(scope: ExportScope) {
        const mode = scope === "all" ? "" : scope;
        if (sessionId !== "all") {
            const s = sessions.find(x => x._id === sessionId);
            await downloadSessionDossiersZip(sessionId, s?.name, {
                mode,
                status: "approved",
                formation: formation !== "all" ? formation : undefined,
            });
        } else {
            await downloadAllDossiersZip({
                mode,
                status: "approved",
                formation: formation !== "all" ? formation : undefined,
            });
        }
    }

    if (isLoading || !user) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <ShieldCheck className="h-6 w-6" />
                        Candidatures validées
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Liste des dossiers dont la candidature a été approuvée par l&apos;équipe RH.
                    </p>
                </div>
                <button
                    onClick={() => setExportOpen(true)}
                    disabled={baseFiltered.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                >
                    <Download className="h-4 w-4" />
                    Exporter (ZIP)
                </button>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Sous-dossiers par mode d'examen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {([
                    { key: "all", label: "Tous les validés", count: baseFiltered.length, icon: Users, color: "#1a237e", bg: "#e8eaf6", desc: "Vue globale" },
                    { key: "online", label: "Validés en ligne", count: onlineCount, icon: Monitor, color: "#1a237e", bg: "#e8eaf6", desc: "Examen à distance" },
                    { key: "onsite", label: "Validés présentiel", count: onsiteCount, icon: MapPin, color: "#2e7d32", bg: "#e8f5e9", desc: "Examen sur site" },
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

            {/* Filters */}
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
                <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                    <ShieldCheck className="h-3 w-3" />
                    <select
                        value={formation}
                        onChange={e => setFormation(e.target.value)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:outline-none focus:border-indigo-400 max-w-[260px]"
                    >
                        <option value="all">Toutes les formations</option>
                        {formations.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                </label>
            </div>

            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm inline-flex items-center justify-center gap-2 w-full">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
            ) : paginated.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm">Aucune candidature validée ne correspond à ces critères.</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-3">
                        {paginated.map((r, i) => {
                            const mode = getExamMode(r);
                            const typeLabel = examTypeLabel(r);
                            const isDirect = (r.exam_type || "").toString().toLowerCase() === "direct";
                            const pk = deriveExamProgress(r);
                            const pmeta = PROGRESS_META[pk];
                            const PIcon = pmeta.icon;
                            return (
                                <motion.div
                                    key={r._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.02 }}
                                >
                                    <Link
                                        href={`/dashboard/candidatures-validees/${r._id}`}
                                        className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-green-200 transition-all"
                                    >
                                        <div
                                            className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                                            style={{ backgroundColor: "#2e7d32" }}
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
                                                {r.answers?.[FORMATION_FIELD] && (
                                                    <span className="truncate max-w-[260px]">
                                                        {r.answers[FORMATION_FIELD]}
                                                    </span>
                                                )}
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
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span
                                                className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full"
                                                style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}
                                            >
                                                <CheckCircle2 className="h-4 w-4" /> Validée
                                            </span>
                                            {pk !== "none" && (
                                                <span
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                    style={{ backgroundColor: pmeta.bg, color: pmeta.color, border: `1px solid ${pmeta.border}` }}
                                                    title="Progression de l'examen"
                                                >
                                                    <PIcon className="h-3 w-3" /> {pmeta.label}
                                                </span>
                                            )}
                                        </div>
                                        <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-green-600 transition-colors shrink-0" />
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

            <ExportModal
                open={exportOpen}
                title="Exporter les candidatures validées"
                subtitle={
                    sessionId !== "all"
                        ? `Session : ${sessions.find(s => s._id === sessionId)?.name || "—"}. Choisissez les candidats à inclure dans l'archive ZIP.`
                        : "Toutes sessions confondues. Choisissez les candidats à inclure dans l'archive ZIP."
                }
                counts={{ all: baseFiltered.length, online: onlineCount, onsite: onsiteCount }}
                onClose={() => setExportOpen(false)}
                onConfirm={handleExport}
            />
        </div>
    );
}
