"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    Award,
    CheckCircle2,
    AlertTriangle,
    Clock,
    ClipboardCheck,
    FolderOpen,
    Hash,
    Loader2,
    Calendar,
    GraduationCap,
    ShieldCheck,
} from "lucide-react";

import { useCandidateAccount } from "@/lib/account-context";

function statusStyle(status?: string) {
    if (status === "approved") return { bg: "#e8f5e9", color: "#2e7d32", label: "Validée" };
    if (status === "rejected") return { bg: "#ffebee", color: "#c62828", label: "Refusée" };
    if (status === "evaluated") return { bg: "#e3f2fd", color: "#1565c0", label: "Évaluée" };
    return { bg: "#fff8e1", color: "#b45309", label: "En cours" };
}

export default function CandidateDossiersPage() {
    const { applications, loading } = useCandidateAccount();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm"
            >
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                            <FolderOpen className="h-6 w-6" style={{ color: "#1a237e" }} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>
                                Mes candidatures
                            </h1>
                            <p className="text-sm text-gray-500">
                                Historique de vos dossiers déposés auprès d&apos;IRISQ.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/candidat/candidater"
                        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.22)" }}
                    >
                        <ClipboardCheck className="h-4 w-4" /> Nouvelle candidature
                    </Link>
                </div>
            </motion.div>

            {applications.length === 0 ? (
                <div className="bg-white rounded-2xl p-10 border border-gray-100 shadow-sm text-center">
                    <GraduationCap className="h-12 w-12 mx-auto text-gray-300" />
                    <p className="mt-4 text-sm font-bold text-gray-700">Aucune candidature pour l&apos;instant</p>
                    <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                        Votre code de codification (ex. IC26D01L-0003) sera généré uniquement lors de votre première candidature.
                    </p>
                    <Link
                        href="/candidat/candidater"
                        className="mt-6 inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
                    >
                        <ClipboardCheck className="h-4 w-4" /> Postuler à une certification
                    </Link>
                </div>
            ) : (
                <ul className="space-y-3">
                    {applications.map(app => {
                        const st = statusStyle(app.status);
                        return (
                            <li
                                key={app.id}
                                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-start gap-3 flex-wrap"
                            >
                                <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                    <Award className="h-5 w-5" style={{ color: "#1a237e" }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 truncate">
                                        {app.certification || "Certification IRISQ"}
                                    </p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
                                        {app.public_id && (
                                            <span className="inline-flex items-center gap-1 font-mono px-2 py-0.5 rounded bg-gray-100">
                                                <Hash className="h-3 w-3" /> {app.public_id}
                                            </span>
                                        )}
                                        {app.exam_mode && (
                                            <span className="inline-flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3" />
                                                {app.exam_mode === "online" ? "En ligne" : "Présentiel"}
                                            </span>
                                        )}
                                        {app.submitted_at && (
                                            <span className="inline-flex items-center gap-1">
                                                <Calendar className="h-3 w-3" />
                                                {new Date(app.submitted_at).toLocaleDateString("fr-FR")}
                                            </span>
                                        )}
                                    </div>
                                    {app.exam_grade && (
                                        <p className="text-[11px] text-gray-500 mt-1">
                                            Note d&apos;examen : <strong className="text-gray-700">{app.exam_grade}</strong>
                                        </p>
                                    )}
                                </div>
                                <span
                                    className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: st.bg, color: st.color }}
                                >
                                    {app.status === "approved" ? (
                                        <CheckCircle2 className="h-3 w-3" />
                                    ) : app.status === "rejected" ? (
                                        <AlertTriangle className="h-3 w-3" />
                                    ) : (
                                        <Clock className="h-3 w-3" />
                                    )}
                                    {st.label}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
