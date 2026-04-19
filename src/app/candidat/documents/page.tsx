"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
    Upload,
    CheckCircle2,
    AlertTriangle,
    Loader2,
    FileText,
    FolderOpen,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { uploadFiles, candidateResubmitDocument } from "@/lib/api";

const DOC_LABELS: Record<string, string> = {
    "CV": "Curriculum Vitae (CV)",
    "Pièce d'identité": "Pièce d'identité",
    "Justificatif d'expérience": "Justificatif d'expérience",
    "Diplômes": "Diplômes / attestations",
};

export default function DocumentsPage() {
    const { account, loading, refresh } = useCandidate();
    const searchParams = useSearchParams();
    const targetDossierId = searchParams.get("dossier");

    const [uploading, setUploading] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    if (loading || !account) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    // Collecter tous les dossiers avec des documents à renvoyer
    const dossiersWithIssues = account.dossiers
        .filter(d => {
            if (targetDossierId && d._id !== targetDossierId) return false;
            const validation = d.documents_validation || {};
            return Object.values(validation).some(v => v.resubmit_requested);
        });

    async function handleResubmit(dossierId: string, docKey: string, file: File) {
        const key = `${dossierId}-${docKey}`;
        setUploading(key);
        setError(null);
        setSuccess(null);
        try {
            const fd = new FormData();
            fd.append("files", file);
            const { file_urls } = await uploadFiles(fd);
            await candidateResubmitDocument(dossierId, docKey, file_urls[0]);
            setSuccess(key);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors du renvoi");
        } finally {
            setUploading(null);
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Renvoyer un document</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Documents signalés par l’administration pour correction ou renvoi.
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />{error}
                </div>
            )}

            {dossiersWithIssues.length === 0 ? (
                <div className="text-center py-16">
                    <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-3" />
                    <p className="font-bold text-gray-700">Aucun document à renvoyer.</p>
                    <p className="text-xs text-gray-400 mt-1">Vous serez notifié(e) si un document nécessite votre action.</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {dossiersWithIssues.map(dossier => {
                        const validation = dossier.documents_validation || {};
                        const certName = dossier.answers?.["Certification souhaitée"] || "Certification";
                        const issues = Object.entries(DOC_LABELS).filter(([key]) => {
                            const v = validation[key];
                            return v?.resubmit_requested;
                        });

                        return (
                            <motion.div
                                key={dossier._id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4" style={{ color: "#1a237e" }} />
                                    <div>
                                        <p className="font-black text-sm" style={{ color: "#1a237e" }}>{certName}</p>
                                        {dossier.public_id && (
                                            <p className="text-xs text-gray-400 font-mono">{dossier.public_id}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="p-5 space-y-4">
                                    {issues.map(([docKey, docLabel]) => {
                                        const v = validation[docKey];
                                        const uploadKey = `${dossier._id}-${docKey}`;
                                        const isUploading = uploading === uploadKey;
                                        const isSuccess = success === uploadKey;

                                        return (
                                            <div key={docKey}>
                                                <div className="flex items-start gap-2 mb-2">
                                                    <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-sm font-bold text-gray-800">{docLabel}</p>
                                                        {v?.resubmit_message && (
                                                            <p className="text-xs text-red-600 italic mt-0.5">« {v.resubmit_message} »</p>
                                                        )}
                                                    </div>
                                                </div>

                                                {isSuccess ? (
                                                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: "#e8f5e9" }}>
                                                        <CheckCircle2 className="h-4 w-4" style={{ color: "#2e7d32" }} />
                                                        <span className="text-sm font-bold" style={{ color: "#2e7d32" }}>Document renvoyé avec succès</span>
                                                    </div>
                                                ) : (
                                                    <label
                                                        htmlFor={`file-${uploadKey}`}
                                                        className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all hover:bg-gray-50"
                                                        style={{ borderColor: "#e5e7eb" }}
                                                    >
                                                        <input
                                                            type="file"
                                                            id={`file-${uploadKey}`}
                                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                            className="hidden"
                                                            disabled={isUploading}
                                                            onChange={e => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleResubmit(dossier._id, docKey, file);
                                                            }}
                                                        />
                                                        {isUploading ? (
                                                            <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                                                        ) : (
                                                            <FileText className="h-4 w-4 text-gray-400" />
                                                        )}
                                                        <span className="text-sm text-gray-500">
                                                            {isUploading ? "Upload en cours…" : "Cliquer pour sélectionner le fichier à renvoyer"}
                                                        </span>
                                                        <Upload className="h-4 w-4 ml-auto text-gray-300" />
                                                    </label>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
