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
    GraduationCap,
    Plus,
    User,
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
    return { bg: "#fff8e1", color: "#b45309", label: "En cours d’analyse" };
}

export default function CandidateDashboardPage() {
    const { account, loading } = useCandidate();

    if (loading || !account) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const displayName = `${account.first_name} ${account.last_name}`.trim();
    const initials = displayName.substring(0, 2).toUpperCase();

    // Collecte toutes les notifications de renvoi de document pour tous les dossiers
    const allIssues: { dossierId: string; publicId?: string; key: string; label: string; v: DocumentValidationEntry }[] = [];
    for (const dossier of account.dossiers) {
        const validation = dossier.documents_validation || {};
        for (const [key, label] of Object.entries(DOC_LABELS)) {
            const v: DocumentValidationEntry = validation[key] || {};
            if (v.resubmit_requested) {
                allIssues.push({ dossierId: dossier._id, publicId: dossier.public_id, key, label, v });
            }
        }
    }

    return (
        <div className="space-y-6">
            {/* Carte compte */}
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
                        {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>
                            Bonjour {account.first_name}
                        </h1>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            <span className="inline-flex items-center gap-1 font-mono px-2 py-1 rounded bg-gray-100">
                                <Hash className="h-3 w-3" /> {account.account_id}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {account.email}
                            </span>
                            {account.profile && (
                                <span className="inline-flex items-center gap-1">
                                    <User className="h-3 w-3" /> {account.profile}
                                </span>
                            )}
                        </div>
                    </div>
                    <div
                        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}
                    >
                        <GraduationCap className="h-3 w-3" />
                        {account.dossiers.length} dossier{account.dossiers.length !== 1 ? "s" : ""}
                    </div>
                </div>
            </motion.div>

            {/* Bouton Candidater */}
            <Link
                href="/candidat/certifications"
                className="flex items-center justify-between gap-3 bg-white rounded-2xl px-6 py-4 border border-gray-100 shadow-sm hover:-translate-y-0.5 transition-transform group"
            >
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#e8f5e9" }}>
                        <Plus className="h-5 w-5" style={{ color: "#2e7d32" }} />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Nouvelle candidature</p>
                        <p className="font-black text-gray-800">Voir les certifications disponibles</p>
                    </div>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-green-600 transition-colors" />
            </Link>

            {/* Notifications */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <BellRing className="h-4 w-4" style={{ color: "#1a237e" }} />
                    <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                        Notifications
                    </h2>
                </div>

                {allIssues.length === 0 ? (
                    <div className="p-8 text-center">
                        <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                        <p className="mt-2 text-sm text-gray-600">Aucune action requise pour le moment.</p>
                        <p className="text-xs text-gray-400">Vous serez notifié(e) ici si un document pose problème.</p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-50">
                        {allIssues.map(({ dossierId, publicId, key, label, v }) => (
                            <li key={`${dossierId}-${key}`} className="px-6 py-4 flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                                    <AlertTriangle className="h-5 w-5 text-red-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Document à renvoyer</p>
                                    <p className="font-bold text-gray-800">{label}</p>
                                    {publicId && <p className="text-xs text-gray-400 font-mono">{publicId}</p>}
                                    {v.resubmit_message && (
                                        <p className="text-xs text-red-700 mt-1 italic">« {v.resubmit_message} »</p>
                                    )}
                                </div>
                                <Link
                                    href={`/candidat/documents?dossier=${dossierId}`}
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

            {/* Dossiers récents */}
            {account.dossiers.length > 0 && (
                <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                            <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>Mes dossiers</h2>
                        </div>
                        <Link href="/candidat/dossiers" className="text-xs font-bold" style={{ color: "#2e7d32" }}>
                            Voir tout →
                        </Link>
                    </div>
                    <ul className="divide-y divide-gray-50">
                        {account.dossiers.slice(0, 3).map(dossier => {
                            const st = statusStyle(dossier.status);
                            const certName = dossier.answers?.["Certification souhaitée"] || "Certification";
                            return (
                                <li key={dossier._id} className="px-6 py-4 flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                        <ShieldCheck className="h-4 w-4" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-gray-800 truncate">{certName}</p>
                                        {dossier.public_id && (
                                            <p className="text-xs font-mono text-gray-400">{dossier.public_id}</p>
                                        )}
                                    </div>
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                                        style={{ backgroundColor: st.bg, color: st.color }}
                                    >
                                        {dossier.status === "approved" ? <CheckCircle2 className="h-2.5 w-2.5" /> : dossier.status === "rejected" ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                                        {st.label}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            )}

            {/* Liens rapides */}
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
