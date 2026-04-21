"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    FolderOpen,
    Users,
    Monitor,
    MapPin,
    Hourglass,
    CheckCircle2,
    XCircle,
    Download,
    Award,
    GraduationCap,
    Loader2,
    ChevronDown,
    ArrowLeft,
} from "lucide-react";
import { motion } from "framer-motion";

import { fetchSessionResponses, fetchSession, downloadSessionDossiersZip, type Session } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ExportModal, type ExportScope } from "@/components/ExportModal";

interface CandidatureRow {
    _id: string;
    public_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    exam_mode?: string;
    exam_type?: string;
    answers?: Record<string, any>;
    documents_validation?: Record<string, { valid?: boolean; resubmit_requested?: boolean }>;
}

const FORMATION_FIELD = "Certification souhaitée";
const UNCATEGORIZED = "Sans formation renseignée";

function getExamMode(r: CandidatureRow): "online" | "onsite" | "" {
    const raw = (r.exam_mode || "").toString().toLowerCase().trim();
    if (raw === "online" || raw === "onsite") return raw;
    const fromAnswers = (r.answers?.["Mode d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("ligne")) return "online";
    if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
    return "";
}

function getExamType(r: CandidatureRow): "direct" | "after_formation" | "" {
    const raw = (r.exam_type || "").toString().toLowerCase().trim();
    if (raw === "direct") return "direct";
    if (raw === "after_formation") return "after_formation";
    const fromAnswers = (r.answers?.["Type d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("direct")) return "direct";
    if (fromAnswers.includes("formation")) return "after_formation";
    return "";
}

function StatCard({
    label,
    value,
    icon: Icon,
    color,
    bg,
    delay = 0,
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    color: string;
    bg: string;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4"
        >
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-xs font-semibold text-gray-500 truncate">{label}</p>
            </div>
        </motion.div>
    );
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
    const [exportOpen, setExportOpen] = useState(false);
    const [detailOpen, setDetailOpen] = useState(false);
    const detailRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) router.replace("/dashboard");
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

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (detailRef.current && !detailRef.current.contains(e.target as Node)) setDetailOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const inFormation = useMemo(() => rows.filter(r => {
        const raw = r.answers?.[FORMATION_FIELD];
        const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
        return name === formationName;
    }), [rows, formationName]);

    const stats = useMemo(() => {
        const total = inFormation.length;
        const pending = inFormation.filter(r => !r.status || r.status === "pending").length;
        const approved = inFormation.filter(r => r.status === "approved").length;
        const rejected = inFormation.filter(r => r.status === "rejected").length;
        const online = inFormation.filter(r => getExamMode(r) === "online").length;
        const onsite = inFormation.filter(r => getExamMode(r) === "onsite").length;
        const direct = inFormation.filter(r => getExamType(r) === "direct").length;
        const afterFormation = inFormation.filter(r => getExamType(r) === "after_formation").length;
        return { total, pending, approved, rejected, online, onsite, direct, afterFormation };
    }, [inFormation]);

    if (isLoading || !user) return null;

    if (!sessionId || !formationName) {
        return (
            <div className="p-8 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-sm">
                Paramètres manquants. <Link href="/dashboard" className="font-bold underline">Retour au tableau de bord</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="h-3 w-3" /> Retour au tableau de bord
            </Link>

            {/* Header */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4 flex-wrap">
                <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#fff8e1" }}>
                    <FolderOpen className="h-5 w-5" style={{ color: "#f59e0b" }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Formation</p>
                    <h1 className="text-xl font-black leading-snug" style={{ color: "#1a237e" }}>{formationName}</h1>
                    {session && (
                        <p className="text-xs text-gray-500 mt-1">
                            Session : <span className="font-semibold">{session.name}</span>
                            <span
                                className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                                style={{
                                    backgroundColor: session.status === "active" ? "#e8f5e9" : "#ffebee",
                                    color: session.status === "active" ? "#2e7d32" : "#c62828",
                                }}
                            >
                                {session.status}
                            </span>
                        </p>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => setExportOpen(true)}
                        disabled={stats.total === 0}
                        className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.20)" }}
                    >
                        <Download className="h-3.5 w-3.5" /> Exporter
                    </button>

                    {/* Voir les candidatures dropdown */}
                    <div className="relative" ref={detailRef}>
                        <button
                            type="button"
                            onClick={() => setDetailOpen(v => !v)}
                            className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.20)" }}
                        >
                            Voir les candidatures
                            <ChevronDown
                                className="h-3.5 w-3.5"
                                style={{ transform: detailOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                            />
                        </button>
                        {detailOpen && (
                            <div className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden py-1">
                                <Link
                                    href="/dashboard/candidatures?mode=online"
                                    onClick={() => setDetailOpen(false)}
                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <Monitor className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                                    Candidature en ligne
                                </Link>
                                <Link
                                    href="/dashboard/candidatures?mode=onsite"
                                    onClick={() => setDetailOpen(false)}
                                    className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                                >
                                    <MapPin className="h-4 w-4 shrink-0" style={{ color: "#2e7d32" }} />
                                    Candidature présentiel
                                </Link>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ExportModal
                open={exportOpen}
                title="Exporter les dossiers"
                subtitle={`Formation : ${formationName}. Choisissez les candidats à inclure dans l'archive ZIP.`}
                counts={{ all: stats.total, online: stats.online, onsite: stats.onsite }}
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
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
            ) : (
                <>
                    {/* Statistiques principales */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Vue d'ensemble</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard label="Total candidats"   value={stats.total}    icon={Users}         color="#1a237e" bg="#e8eaf6" delay={0}    />
                            <StatCard label="En attente"        value={stats.pending}  icon={Hourglass}     color="#b26a00" bg="#fff8e1" delay={0.04} />
                            <StatCard label="Validées"          value={stats.approved} icon={CheckCircle2}  color="#2e7d32" bg="#e8f5e9" delay={0.08} />
                            <StatCard label="Rejetées"          value={stats.rejected} icon={XCircle}       color="#c62828" bg="#ffebee" delay={0.12} />
                        </div>
                    </div>

                    {/* Répartition par mode et type */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Répartition</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard label="En ligne"              value={stats.online}        icon={Monitor}        color="#1a237e" bg="#e8eaf6" delay={0.16} />
                            <StatCard label="Présentiel"            value={stats.onsite}        icon={MapPin}         color="#2e7d32" bg="#e8f5e9" delay={0.20} />
                            <StatCard label="Examen direct"         value={stats.direct}        icon={Award}          color="#b45309" bg="#fff8e1" delay={0.24} />
                            <StatCard label="Après formation IRISQ" value={stats.afterFormation} icon={GraduationCap} color="#047857" bg="#ecfdf5" delay={0.28} />
                        </div>
                    </div>
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
