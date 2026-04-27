"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    FileText,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Eye,
    Loader2,
    ShieldCheck,
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

function extractUrl(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") return value[0];
    return null;
}

function statusStyle(status?: string) {
    if (status === "approved") return { bg: "#e8f5e9", color: "#2e7d32", label: "Validée" };
    if (status === "rejected") return { bg: "#ffebee", color: "#c62828", label: "Refusée" };
    return { bg: "#fff8e1", color: "#b45309", label: "En attente" };
}

function DossierDocuments({ d, onPreview }: { d: CandidateDossier; onPreview: (url: string, title?: string) => void }) {
    const validation = d.documents_validation || {};
    const entries = Object.entries(DOC_LABELS).map(([key, label]) => {
        const raw = d.answers?.[key];
        const url = extractUrl(raw);
        const v: DocumentValidationEntry = validation[key] || {};
        return { key, label, url, v };
    });

    return (
        <ul className="divide-y divide-gray-50">
            {entries.map(({ key, label, url, v }) => {
                const isValid = v.valid === true;
                const needResubmit = !!v.resubmit_requested;
                const justResubmitted = !!v.resubmitted_at && !needResubmit && !isValid;

                const badge = needResubmit
                    ? { label: "À renvoyer", bg: "bg-red-50", color: "text-red-700", icon: <AlertTriangle className="h-3 w-3" /> }
                    : isValid
                        ? { label: "Validé", bg: "bg-green-50", color: "text-green-700", icon: <CheckCircle2 className="h-3 w-3" /> }
                        : justResubmitted
                            ? { label: "En revue", bg: "bg-amber-50", color: "text-amber-700", icon: <Clock className="h-3 w-3" /> }
                            : url
                                ? { label: "Transmis", bg: "bg-gray-100", color: "text-gray-700", icon: <Clock className="h-3 w-3" /> }
                                : { label: "Non fourni", bg: "bg-gray-50", color: "text-gray-400", icon: <Clock className="h-3 w-3" /> };

                return (
                    <li key={key} className="px-6 py-4 flex items-start gap-3 flex-wrap">
                        <div
                            className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                                backgroundColor: needResubmit ? "#fff5f5" : isValid ? "#e8f5e9" : "#f3f4f6",
                            }}
                        >
                            <FileText className="h-4 w-4" style={{ color: needResubmit ? "#dc2626" : isValid ? "#2e7d32" : "#64748b" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-gray-800">{label}</p>
                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.color}`}>
                                    {badge.icon} {badge.label}
                                </span>
                            </div>
                            {url ? (
                                <button
                                    type="button"
                                    onClick={() => onPreview(url, label)}
                                    className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                >
                                    <Eye className="h-3 w-3" />
                                    Visualiser le document
                                </button>
                            ) : (
                                <p className="mt-1 text-xs text-gray-400">Aucun fichier transmis pour ce document.</p>
                            )}
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

export default function CandidateDossiersPage() {
    const { dossier, dossiers, loading } = useCandidate();
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

    if (loading || !dossier) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const hasMultiple = dossiers.length > 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
        >
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                    Espace candidat
                </p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                    Mes dossiers
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Consultez les documents que vous avez transmis et leur état de validation.
                </p>
            </header>

            {/* Mode multi-candidatures : une carte par dossier */}
            {hasMultiple ? (
                <div className="space-y-4">
                    {dossiers.map((d, idx) => {
                        const cert = d.answers?.["Certification souhaitée"] || d.public_id || `Dossier ${idx + 1}`;
                        const st = statusStyle(d.status);
                        return (
                            <div key={d._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                {/* Dossier header */}
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: "#f8f9ff" }}>
                                    <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-black truncate" style={{ color: "#1a237e" }}>{cert}</p>
                                        {d.public_id && (
                                            <p className="text-[10px] font-mono text-gray-400">{d.public_id}</p>
                                        )}
                                    </div>
                                    <span
                                        className="text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0"
                                        style={{ backgroundColor: st.bg, color: st.color }}
                                    >
                                        {st.label}
                                    </span>
                                </div>
                                <DossierDocuments d={d} onPreview={(url, title) => setPreviewFile({ url, title })} />
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Mode candidature unique (comportement original) */
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                        <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                            Documents transmis
                        </h2>
                    </div>
                    <DossierDocuments d={dossier} onPreview={(url, title) => setPreviewFile({ url, title })} />
                </div>
            )}

            {previewFile && (
                <FilePreviewModal
                    url={previewFile.url}
                    title={previewFile.title}
                    onClose={() => setPreviewFile(null)}
                />
            )}
        </motion.div>
    );
}
