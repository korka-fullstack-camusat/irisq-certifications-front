"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
    FileText,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ShieldCheck,
    Loader2,
    Mail,
    Hash,
    ArrowRight,
    Upload,
    BellRing,
    BookOpen,
    PlayCircle,
    CalendarDays,
    Send,
    Trophy,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExam, type CandidateExam, type DocumentValidationEntry } from "@/lib/api";

const DOC_LABELS: Record<string, string> = {
    "CV": "Curriculum Vitae",
    "Pièce d'identité": "Pièce d'identité",
    "Justificatif d'expérience": "Justificatif d'expérience",
    "Diplômes": "Diplômes / attestations",
};

function statusStyle(status?: string) {
    if (status === "approved") return { bg: "#e8f5e9", color: "#2e7d32", label: "Candidature validée" };
    if (status === "rejected") return { bg: "#ffebee", color: "#c62828", label: "Candidature refusée" };
    return { bg: "#fff8e1", color: "#b45309", label: "En cours d'analyse" };
}

function formatDateTime(iso: string) {
    try {
        return new Date(iso).toLocaleString("fr-FR", {
            weekday: "long", day: "2-digit", month: "long",
            year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

export default function CandidateDashboardPage() {
    const { dossier, loading } = useCandidate();
    const [exam, setExam] = useState<CandidateExam | null | undefined>(undefined);
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        fetchCandidateExam().then(setExam).catch(() => setExam(null));
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (loading || !dossier) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const validation = dossier.documents_validation || {};
    const issues = Object.entries(DOC_LABELS)
        .map(([key, label]) => {
            const v: DocumentValidationEntry = validation[key] || {};
            return { key, label, v };
        })
        .filter(d => d.v.resubmit_requested);

    const st = statusStyle(dossier.status);

    const hasToken = !!dossier.exam_token;
    const alreadySubmitted = dossier.exam_status === "submitted" || dossier.exam_status === "graded";
    const examGraded = dossier.exam_status === "graded";
    const examStarted = exam?.start_time ? new Date(exam.start_time).getTime() <= now : true;
    const examExpired =
        !!exam?.start_time &&
        !!exam?.duration_minutes &&
        new Date(exam.start_time).getTime() + exam.duration_minutes * 60 * 1000 < now;
    const showExamExpiredNotification = !!exam && hasToken && !alreadySubmitted && examExpired;
    const showExamNotification = !!exam && hasToken && !alreadySubmitted && !examExpired;
    const showExamDoneNotification = alreadySubmitted;
    const examIsUrgent = showExamNotification && examStarted;

    return (
        <div className="space-y-6">
            {/* Identity card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
            >
                <div className="flex items-start gap-4 flex-wrap">
                    <div
                        className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-black shrink-0"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        {(dossier.name || dossier.public_id || "??").substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>
                            Bonjour {dossier.name || "Candidat"}
                        </h1>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            {dossier.public_id && (
                                <span className="inline-flex items-center gap-1 font-mono px-2 py-1 rounded bg-gray-100">
                                    <Hash className="h-3 w-3" /> {dossier.public_id}
                                </span>
                            )}
                            {dossier.email && (
                                <span className="inline-flex items-center gap-1">
                                    <Mail className="h-3 w-3" /> {dossier.email}
                                </span>
                            )}
                            {dossier.answers?.["Certification souhaitée"] && (
                                <span className="inline-flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" /> {dossier.answers["Certification souhaitée"]}
                                </span>
                            )}
                        </div>
                    </div>
                    <span
                        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: st.bg, color: st.color }}
                    >
                        {dossier.status === "approved" ? <CheckCircle2 className="h-3 w-3" /> : dossier.status === "rejected" ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                        {st.label}
                    </span>
                </div>
            </motion.div>

            {/* Notifications */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <BellRing className="h-4 w-4" style={{ color: "#1a237e" }} />
                    <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                        Notifications
                    </h2>
                </div>

                {issues.length === 0 && !showExamNotification && !showExamDoneNotification && !showExamExpiredNotification ? (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                        <p className="mt-2 text-sm text-gray-600">Aucune action requise pour le moment.</p>
                        <p className="text-xs text-gray-400">Vous serez notifié(e) ici si un document pose problème.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {/* ── Notification examen expiré ── */}
                        {showExamExpiredNotification && exam && (
                            <li className="px-6 py-4 flex items-start gap-3 bg-rose-50/70">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-rose-100">
                                    <AlertTriangle className="h-5 w-5 text-rose-700" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-rose-700">
                                        Période d&apos;examen écoulée
                                    </p>
                                    <p className="font-bold text-gray-800">
                                        {exam.title || exam.certification}
                                    </p>
                                    <p className="text-xs text-rose-600 mt-0.5">
                                        Le délai imparti pour cette épreuve est dépassé. Veuillez contacter le responsable IRISQ.
                                    </p>
                                </div>
                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg shrink-0 bg-rose-100 text-rose-700">
                                    <AlertTriangle className="h-3 w-3" />
                                    Expiré
                                </span>
                            </li>
                        )}

                        {/* ── Notification examen terminé (soumis / corrigé) ── */}
                        {showExamDoneNotification && (
                            <li className={`px-6 py-4 flex items-start gap-3 ${examGraded ? "bg-emerald-50" : "bg-blue-50/60"}`}>
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${examGraded ? "bg-emerald-100" : "bg-blue-100"}`}>
                                    {examGraded
                                        ? <Trophy className="h-5 w-5 text-emerald-700" />
                                        : <Send className="h-5 w-5 text-blue-700" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${examGraded ? "text-emerald-700" : "text-blue-700"}`}>
                                        {examGraded ? "Résultats disponibles" : "Examen soumis — En cours de correction"}
                                    </p>
                                    <p className="font-bold text-gray-800">
                                        {exam?.title || exam?.certification || dossier.answers?.["Certification souhaitée"] || "Épreuve technique"}
                                    </p>
                                    {examGraded && dossier.final_grade != null && (
                                        <p className="text-xs text-emerald-700 mt-0.5 font-semibold">
                                            Note finale : <span className="font-black">{dossier.final_grade}</span>
                                            {dossier.final_appreciation && <span className="ml-1 font-normal italic">— {dossier.final_appreciation}</span>}
                                        </p>
                                    )}
                                    {!examGraded && (
                                        <p className="text-xs text-blue-600 mt-0.5">
                                            Votre copie a bien été transmise au correcteur. Vous recevrez vos résultats par email.
                                        </p>
                                    )}
                                </div>
                                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg shrink-0 ${examGraded ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                    {examGraded ? <Trophy className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                                    {examGraded ? "Corrigé" : "Soumis"}
                                </span>
                            </li>
                        )}

                        {/* ── Notification examen disponible ── */}
                        {showExamNotification && exam && (
                            <li className={`px-6 py-4 flex items-start gap-3 ${examIsUrgent ? "bg-emerald-50" : "bg-amber-50/60"}`}>
                                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${examIsUrgent ? "bg-emerald-100" : "bg-amber-100"}`}>
                                    {examIsUrgent
                                        ? <PlayCircle className="h-5 w-5 text-emerald-700" />
                                        : <CalendarDays className="h-5 w-5 text-amber-700" />
                                    }
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-[10px] font-bold uppercase tracking-widest ${examIsUrgent ? "text-emerald-700" : "text-amber-700"}`}>
                                        {examIsUrgent ? "Examen disponible — Commencez maintenant" : "Examen planifié"}
                                    </p>
                                    <p className="font-bold text-gray-800">{exam.title || exam.certification}</p>
                                    {exam.start_time && !examStarted && (
                                        <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                                            <Clock className="h-3 w-3 shrink-0" />
                                            Ouverture : {formatDateTime(exam.start_time)}
                                        </p>
                                    )}
                                    {exam.duration_minutes && (
                                        <p className="text-xs text-gray-500 mt-0.5">Durée : {exam.duration_minutes} min</p>
                                    )}
                                </div>
                                <Link
                                    href="/candidat/examen"
                                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg text-white shrink-0 transition-all hover:-translate-y-0.5 ${examIsUrgent ? "animate-pulse" : ""}`}
                                    style={{ backgroundColor: examIsUrgent ? "#2e7d32" : "#1a237e", boxShadow: examIsUrgent ? "0 4px 12px rgba(46,125,50,0.3)" : undefined }}
                                >
                                    <BookOpen className="h-3 w-3" />
                                    {examIsUrgent ? "Accéder" : "Voir"}
                                </Link>
                            </li>
                        )}

                        {/* ── Notifications documents ── */}
                        {issues.map(({ key, label, v }) => (
                            <li key={key} className="px-6 py-4 flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">
                                        Document à renvoyer
                                    </p>
                                    <p className="font-bold text-gray-800">{label}</p>
                                    {v.resubmit_message && (
                                        <p className="text-xs text-red-700 mt-1 italic">« {v.resubmit_message} »</p>
                                    )}
                                </div>
                                <Link
                                    href="/candidat/documents"
                                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-2 rounded-lg text-white shrink-0"
                                    style={{ backgroundColor: "#1a237e" }}
                                >
                                    <Upload className="h-3 w-3" /> Renvoyer
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-2">
                <Link
                    href="/candidat/dossiers"
                    className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                            <FileText className="h-5 w-5" style={{ color: "#1a237e" }} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Consulter</p>
                            <p className="font-black text-gray-800">Mes dossiers</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                </Link>
                <Link
                    href="/candidat/documents"
                    className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#e8f5e9" }}>
                            <Upload className="h-5 w-5" style={{ color: "#2e7d32" }} />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Action</p>
                            <p className="font-black text-gray-800">Renvoyer un document</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                    </div>
                </Link>
            </div>
        </div>
    );
}
