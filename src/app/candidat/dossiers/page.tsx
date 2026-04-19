"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Eye,
    Loader2,
    ChevronDown,
    ChevronUp,
    ShieldCheck,
    GraduationCap,
    Monitor,
    MapPin,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { type DocumentValidationEntry, type CandidateDossier } from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const DOC_LABELS: Record<string, string> = {
    "CV": "Curriculum Vitae",
    "Pièce d'identité": "Pièce d'identité",
    "Justificatif d'expérience": "Justificatif d'expérience",
    "Diplômes": "Diplômes / attestations",
};

function statusStyle(status?: string) {
    if (status === "approved") return { bg: "#e8f5e9", color: "#2e7d32", label: "Validée" };
    if (status === "rejected") return { bg: "#ffebee", color: "#c62828", label: "Refusée" };
    return { bg: "#fff8e1", color: "#b45309", label: "En cours" };
}

function extractUrl(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") return value[0];
    return null;
}

function DossierCard({ dossier }: { dossier: CandidateDossier }) {
    const [expanded, setExpanded] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

    const st = statusStyle(dossier.status);
    const certName = dossier.answers?.["Certification souhaitée"] || "Certification";
    const validation = dossier.documents_validation || {};
    const examModeLabel = dossier.exam_mode === "online" ? "En ligne" : dossier.exam_mode === "onsite" ? "Présentiel" : null;
    const examTypeLabel = dossier.exam_type === "direct" ? "Examen direct" : dossier.exam_type === "after_formation" ? "Après formation" : null;

    const entries = Object.entries(DOC_LABELS).map(([key, label]) => {
        const raw = dossier.answers?.[key];
        const url = extractUrl(raw);
        const v: DocumentValidationEntry = validation[key] || {};
        return { key, label, url, v };
    }).filter(e => e.url);

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
            {/* En-tête dossier */}
            <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors"
            >
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                    <ShieldCheck className="h-5 w-5" style={{ color: "#1a237e" }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 truncate">{certName}</p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {dossier.public_id && (
                            <span className="text-xs font-mono text-gray-400">{dossier.public_id}</span>
                        )}
                        {dossier.submitted_at && (
                            <span className="text-xs text-gray-400">
                                {new Date(dossier.submitted_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: st.bg, color: st.color }}
                    >
                        {dossier.status === "approved" ? <CheckCircle2 className="h-2.5 w-2.5" /> : dossier.status === "rejected" ? <AlertTriangle className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
                        {st.label}
                    </span>
                    {expanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                </div>
            </button>

            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-6 pb-5 pt-1 space-y-4 border-t border-gray-100">
                            {/* Mode & type */}
                            <div className="flex gap-3 flex-wrap">
                                {examModeLabel && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                        {dossier.exam_mode === "online" ? <Monitor className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                                        {examModeLabel}
                                    </span>
                                )}
                                {examTypeLabel && (
                                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                                        <GraduationCap className="h-3 w-3" />
                                        {examTypeLabel}
                                    </span>
                                )}
                            </div>

                            {/* Documents */}
                            {entries.length > 0 && (
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Documents fournis</p>
                                    <ul className="space-y-2">
                                        {entries.map(({ key, label, url, v }) => {
                                            const isValid = v.valid === true;
                                            const needResubmit = !!v.resubmit_requested;
                                            return (
                                                <li key={key} className="flex items-center gap-3">
                                                    <FileText className="h-4 w-4 shrink-0" style={{ color: needResubmit ? "#dc2626" : isValid ? "#2e7d32" : "#64748b" }} />
                                                    <span className="text-sm text-gray-700 flex-1">{label}</span>
                                                    {needResubmit && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">À renvoyer</span>
                                                    )}
                                                    {isValid && (
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Validé</span>
                                                    )}
                                                    {url && (
                                                        <button
                                                            onClick={() => setPreviewFile({ url: url!, title: label })}
                                                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                                        >
                                                            <Eye className="h-3 w-3" /> Voir
                                                        </button>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {/* Évaluation finale */}
                            {(dossier.final_grade || dossier.exam_grade) && (
                                <div className="p-3 rounded-xl" style={{ backgroundColor: "#f8f9fa" }}>
                                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Évaluation</p>
                                    {dossier.exam_grade && <p className="text-sm text-gray-700">Note examen : <strong>{dossier.exam_grade}</strong></p>}
                                    {dossier.final_grade && <p className="text-sm text-gray-700">Note finale : <strong>{dossier.final_grade}</strong></p>}
                                    {dossier.final_appreciation && <p className="text-sm text-gray-500 italic mt-1">{dossier.final_appreciation}</p>}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {previewFile && (
                <FilePreviewModal url={previewFile.url} title={previewFile.title} onClose={() => setPreviewFile(null)} />
            )}
        </motion.div>
    );
}

export default function CandidateDossiersPage() {
    const { account, loading } = useCandidate();

    if (loading || !account) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Espace candidat</p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Mes dossiers</h1>
                <p className="text-sm text-gray-500 mt-1">
                    {account.dossiers.length === 0
                        ? "Vous n'avez pas encore de dossier de candidature."
                        : `${account.dossiers.length} dossier${account.dossiers.length > 1 ? "s" : ""} de candidature.`
                    }
                </p>
            </header>

            {account.dossiers.length === 0 ? (
                <div className="text-center py-16">
                    <ShieldCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Aucun dossier pour le moment.</p>
                    <a href="/candidat/certifications" className="mt-3 inline-block text-sm font-bold hover:underline" style={{ color: "#2e7d32" }}>
                        Voir les certifications disponibles →
                    </a>
                </div>
            ) : (
                <div className="space-y-4">
                    {account.dossiers.map(dossier => (
                        <DossierCard key={dossier._id} dossier={dossier} />
                    ))}
                </div>
            )}
        </div>
    );
}
