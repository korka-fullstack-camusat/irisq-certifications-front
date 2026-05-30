"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    BookOpen,
    CalendarDays,
    Send,
    Trophy,
    Upload,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExam, type CandidateExam, type DocumentValidationEntry } from "@/lib/api";

const DOC_LABELS: Record<string, string> = {
    "CV": "Curriculum Vitae",
    "Pièce d'identité": "Pièce d'identité",
    "Justificatif d'expérience": "Justificatif d'expérience",
    "Diplômes": "Diplômes / attestations",
};

export default function CandidateDashboardPage() {
    const { dossier, loading } = useCandidate();
    const [exam, setExam] = useState<CandidateExam | null | undefined>(undefined);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        fetchCandidateExam().then(setExam).catch(() => setExam(null));
        const id = setInterval(
            () => fetchCandidateExam().then(setExam).catch(() => {}),
            30_000,
        );
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (loading || !dossier) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
        );
    }

    // ── Calcul des notifications ────────────────────────────────
    const validation = dossier.documents_validation || {};
    const docIssues = Object.entries(DOC_LABELS)
        .map(([key, label]) => ({ key, label, v: (validation[key] || {}) as DocumentValidationEntry }))
        .filter(d => d.v.resubmit_requested);

    const hasToken        = !!dossier.exam_token;
    const alreadyDone     = dossier.exam_status === "submitted" || dossier.exam_status === "graded";
    const isGraded        = dossier.exam_status === "graded";
    const deadline        = exam?.deadline;
    const examExpired     = deadline ? new Date(deadline + "T23:59:59").getTime() < now : false;

    const showExpired     = !!exam && hasToken && !alreadyDone && examExpired;
    const showAvailable   = !!exam && hasToken && !alreadyDone && !examExpired;
    const showDone        = alreadyDone;

    const notifications = [
        ...docIssues.map(d => ({ type: "doc" as const, ...d })),
        ...(showExpired && exam   ? [{ type: "expired"   as const, exam }] : []),
        ...(showAvailable && exam ? [{ type: "available" as const, exam }] : []),
        ...(showDone              ? [{ type: "done"      as const }]        : []),
    ];

    const displayName = dossier.name || "Candidat";

    return (
        <div className="max-w-xl mx-auto space-y-8 py-4">

            {/* ── Nom ── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                    Espace candidat
                </p>
                <h1 className="text-3xl font-black leading-tight" style={{ color: "#1a237e" }}>
                    Bonjour, {displayName}&nbsp;👋
                </h1>
            </motion.div>

            {/* ── Notifications ── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.07 }}
                className="space-y-3"
            >
                <AnimatePresence initial={false}>
                    {notifications.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm"
                        >
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            <p className="text-sm text-gray-500">
                                Aucune action requise pour le moment.
                            </p>
                        </motion.div>
                    ) : (
                        notifications.map((n, i) => (
                            <motion.div
                                key={n.type === "doc" ? n.key : n.type}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                {/* Examen disponible */}
                                {n.type === "available" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                            <BookOpen className="h-5 w-5 text-emerald-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 text-sm leading-snug">
                                                {n.exam.title || n.exam.certification}
                                            </p>
                                            {deadline && (
                                                <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1 font-medium">
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    Limite&nbsp;: {new Date(deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                                                </p>
                                            )}
                                        </div>
                                        <Link
                                            href="/candidat/examen"
                                            className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 animate-pulse"
                                            style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 12px rgba(46,125,50,0.3)" }}
                                        >
                                            Accéder
                                        </Link>
                                    </div>
                                )}

                                {/* Examen soumis / corrigé */}
                                {n.type === "done" && (
                                    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-sm ${isGraded ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"}`}>
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isGraded ? "bg-emerald-100" : "bg-blue-100"}`}>
                                            {isGraded
                                                ? <Trophy className="h-5 w-5 text-emerald-700" />
                                                : <Send className="h-5 w-5 text-blue-700" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-sm ${isGraded ? "text-emerald-800" : "text-blue-800"}`}>
                                                {isGraded ? "Résultats disponibles" : "Copie en cours de correction"}
                                            </p>
                                            {isGraded && dossier.final_grade != null && (
                                                <p className="text-xs text-emerald-700 mt-0.5 font-semibold">
                                                    Note&nbsp;: <span className="font-black">{dossier.final_grade}</span>
                                                    {dossier.final_appreciation && (
                                                        <span className="font-normal italic ml-1">— {dossier.final_appreciation}</span>
                                                    )}
                                                </p>
                                            )}
                                            {!isGraded && (
                                                <p className="text-xs text-blue-600 mt-0.5">
                                                    Résultats envoyés par email après correction.
                                                </p>
                                            )}
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg ${isGraded ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                            {isGraded ? "Corrigé" : "Soumis"}
                                        </span>
                                    </div>
                                )}

                                {/* Examen expiré */}
                                {n.type === "expired" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                            <CalendarDays className="h-5 w-5 text-rose-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-rose-800 text-sm">Délai examen dépassé</p>
                                            <p className="text-xs text-rose-600 mt-0.5">
                                                Contactez le responsable IRISQ.
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700">
                                            Expiré
                                        </span>
                                    </div>
                                )}

                                {/* Document à renvoyer */}
                                {n.type === "doc" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-red-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 text-sm">{n.label}</p>
                                            {n.v.resubmit_message && (
                                                <p className="text-xs text-red-700 mt-0.5 italic truncate">
                                                    «&nbsp;{n.v.resubmit_message}&nbsp;»
                                                </p>
                                            )}
                                        </div>
                                        <Link
                                            href="/candidat/documents"
                                            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            <Upload className="h-3 w-3" /> Renvoyer
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
