"use client";

import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { type DocumentValidationEntry } from "@/lib/api";

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

export default function CandidateDashboardPage() {
    const { dossier, loading } = useCandidate();

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

                {issues.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                        <p className="mt-2 text-sm text-gray-600">Aucune action requise pour le moment.</p>
                        <p className="text-xs text-gray-400">Vous serez notifié(e) ici si un document pose problème.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
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
