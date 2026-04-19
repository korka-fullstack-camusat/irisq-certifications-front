"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    ClipboardCheck,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Loader2,
    Mail,
    Hash,
    ArrowRight,
    ShieldCheck,
    Award,
    GraduationCap,
    Calendar,
    FileText,
} from "lucide-react";

import { useCandidateAccount } from "@/lib/account-context";

function statusStyle(status?: string) {
    if (status === "approved") return { bg: "#e8f5e9", color: "#2e7d32", label: "Validée" };
    if (status === "rejected") return { bg: "#ffebee", color: "#c62828", label: "Refusée" };
    if (status === "evaluated") return { bg: "#e3f2fd", color: "#1565c0", label: "Évaluée" };
    return { bg: "#fff8e1", color: "#b45309", label: "En cours" };
}

export default function CandidateDashboardPage() {
    const { account, applications, loading } = useCandidateAccount();

    if (loading || !account) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const displayName = `${account.prenom} ${account.nom}`.trim() || account.email;
    const hasApplications = applications.length > 0;

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
                        {displayName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>
                            Bonjour {account.prenom || "Candidat"}
                        </h1>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {account.email}
                            </span>
                            {hasApplications && applications[0]?.public_id && (
                                <span className="inline-flex items-center gap-1 font-mono px-2 py-1 rounded bg-gray-100">
                                    <Hash className="h-3 w-3" /> {applications[0].public_id}
                                </span>
                            )}
                        </div>
                    </div>
                    <Link
                        href="/candidat/candidater"
                        className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl text-white shrink-0 transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.22)" }}
                    >
                        <ClipboardCheck className="h-4 w-4" />
                        Postuler à une certification
                    </Link>
                </div>
            </motion.div>

            {/* Applications section */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                    <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                        Mes candidatures
                    </h2>
                    {hasApplications && (
                        <span className="ml-auto text-xs text-gray-400">{applications.length} au total</span>
                    )}
                </div>

                {!hasApplications ? (
                    <div className="p-8 text-center">
                        <GraduationCap className="h-10 w-10 mx-auto text-gray-300" />
                        <p className="mt-3 text-sm text-gray-600 font-bold">Aucune candidature pour le moment.</p>
                        <p className="text-xs text-gray-400 mt-1">
                            Postulez à une certification pour recevoir un code de codification (ex. IC26D01L-0003).
                        </p>
                        <Link
                            href="/candidat/candidater"
                            className="mt-5 inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
                        >
                            <ClipboardCheck className="h-4 w-4" /> Postuler maintenant
                        </Link>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {applications.map(app => {
                            const st = statusStyle(app.status);
                            return (
                                <li key={app.id} className="px-6 py-4 flex items-start gap-3 flex-wrap">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
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
            </section>

            {/* Quick links */}
            <div className="grid gap-4 sm:grid-cols-3">
                <Link
                    href="/candidat/candidater"
                    className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#e8f5e9" }}>
                            <ClipboardCheck className="h-5 w-5" style={{ color: "#2e7d32" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Action</p>
                            <p className="font-black text-gray-800">Postuler</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
                    </div>
                </Link>
                <Link
                    href="/candidat/dossiers"
                    className="group bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                            <FileText className="h-5 w-5" style={{ color: "#1a237e" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Consulter</p>
                            <p className="font-black text-gray-800">Mes dossiers</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                    </div>
                </Link>
                <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#fff8e1" }}>
                            <GraduationCap className="h-5 w-5" style={{ color: "#b45309" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">À venir</p>
                            <p className="font-black text-gray-800 truncate">Formations</p>
                            <p className="text-[11px] text-gray-400">Dates &amp; liens Teams</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
