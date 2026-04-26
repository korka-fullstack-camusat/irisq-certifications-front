"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    FolderOpen,
    Users,
    Hourglass,
    CheckCircle2,
    XCircle,
    Trophy,
    Clock,
    Loader2,
    ArrowLeft,
    ShieldCheck,
} from "lucide-react";
import { motion } from "framer-motion";

import { fetchSessionResponses, fetchSession, type Session } from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface CandidatureRow {
    _id: string;
    public_id?: string;
    name?: string;
    submitted_at?: string;
    answers?: Record<string, any>;
    exam_grade?: string;
    exam_appreciation?: string;
    jury_grade?: string;
    jury_appreciation?: string;
    final_decision?: string;
    rejection_reason?: string;
    assigned_examiner_email?: string;
}

const FORMATION_FIELD = "Certification souhaitée";
const UNCATEGORIZED = "Sans certification renseignée";

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
            className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3"
        >
            <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div className="min-w-0">
                <p className="text-2xl font-black" style={{ color }}>{value}</p>
                <p className="text-xs text-gray-400 truncate">{label}</p>
            </div>
        </motion.div>
    );
}


function ComiteFormationInner() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("session") || "";
    const formationName = searchParams.get("name") || "";

    const [session, setSession] = useState<Session | null>(null);
    const [rows, setRows] = useState<CandidatureRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "COMITE")) router.replace("/comite");
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

    // Only the copies for this formation that are in the comité queue (have exam_grade)
    const inFormation = useMemo(() => rows.filter(r => {
        const raw = r.answers?.[FORMATION_FIELD];
        const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
        return name === formationName && !!(r as any).exam_grade;
    }), [rows, formationName]);

    const stats = useMemo(() => ({
        total:   inFormation.length,
        pending: inFormation.filter(r => !r.final_decision).length,
        certified: inFormation.filter(r => r.final_decision === "certified").length,
        rejected:  inFormation.filter(r => r.final_decision === "rejected").length,
        withJury:  inFormation.filter(r => !!r.jury_grade).length,
    }), [inFormation]);

    if (isLoading || !user) return null;

    if (!sessionId || !formationName) {
        return (
            <div className="p-8 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-sm">
                Paramètres manquants.{" "}
                <Link href="/comite/dashboard" className="font-bold underline">Retour au tableau de bord</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">

            <Link href="/comite/dashboard"
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700">
                <ArrowLeft className="h-3 w-3" /> Retour au tableau de bord
            </Link>

            {/* ── Header ── */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-4 flex-wrap">
                <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100">
                    <FolderOpen className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certification</p>
                    <h1 className="text-xl font-black leading-snug text-gray-800">{formationName}</h1>
                    {session && (
                        <p className="text-xs text-gray-400 mt-1">
                            Session : <span className="font-semibold text-gray-600">{session.name}</span>
                            <span className="ml-2 text-[10px] font-bold uppercase border border-gray-300 text-gray-500 px-1.5 py-0.5 rounded">
                                {session.status}
                            </span>
                        </p>
                    )}
                </div>
                <Link
                    href={`/comite?formation=${encodeURIComponent(formationName)}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 shrink-0"
                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.20)" }}
                >
                    <ShieldCheck className="h-4 w-4" />
                    Valider les copies
                </Link>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            )}

            {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
            ) : (
                <>
                    {/* ── Vue d'ensemble ── */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Vue d'ensemble</p>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <StatCard label="Total copies"    value={stats.total}     icon={Users}        color="#1a237e" bg="#e8eaf6" delay={0}    />
                            <StatCard label="En attente"      value={stats.pending}   icon={Hourglass}    color="#e65100" bg="#fff3e0" delay={0.04} />
                            <StatCard label="Certifiés"       value={stats.certified} icon={Trophy}       color="#2e7d32" bg="#e8f5e9" delay={0.08} />
                            <StatCard label="Rejetés"         value={stats.rejected}  icon={XCircle}      color="#c62828" bg="#ffebee" delay={0.12} />
                        </div>
                    </div>

                    {/* ── Répartition notes ── */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Avancement jury</p>
                        <div className="grid grid-cols-2 gap-3">
                            <StatCard label="Note jury posée"   value={stats.withJury}              icon={CheckCircle2} color="#1565c0" bg="#e3f2fd" delay={0.16} />
                            <StatCard label="Note jury manquante" value={stats.total - stats.withJury} icon={Clock}       color="#9ca3af" bg="#f3f4f6" delay={0.20} />
                        </div>
                    </div>

                </>
            )}
        </div>
    );
}

export default function ComiteFormationPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>}>
            <ComiteFormationInner />
        </Suspense>
    );
}
