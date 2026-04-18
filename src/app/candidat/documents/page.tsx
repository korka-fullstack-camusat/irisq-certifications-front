"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Upload,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    FileText,
    Eye,
    Clock,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { candidateResubmitDocument, uploadFiles, type DocumentValidationEntry } from "@/lib/api";
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

export default function CandidateDocumentsPage() {
    const { dossier, loading, setDossier } = useCandidate();
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);
    const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

    async function handleResubmit(docKey: string, file: File) {
        try {
            setUploadingKey(docKey);
            setError(null);
            setToast(null);
            const form = new FormData();
            form.append("files", file);
            const { file_urls } = await uploadFiles(form);
            if (!file_urls?.[0]) throw new Error("Upload incomplet");
            const updated = await candidateResubmitDocument(docKey, file_urls[0]);
            setDossier(updated);
            setToast(`« ${docKey} » transmis à l'administration.`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur lors de l'envoi");
        } finally {
            setUploadingKey(null);
        }
    }

    if (loading || !dossier) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const validation = dossier.documents_validation || {};
    const flagged = Object.entries(DOC_LABELS)
        .map(([key, label]) => {
            const raw = dossier.answers?.[key];
            const url = extractUrl(raw);
            const v: DocumentValidationEntry = validation[key] || {};
            return { key, label, url, v };
        })
        .filter(d => d.v.resubmit_requested);

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
                    Renvoi de documents
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Téléversez directement le bon fichier pour les documents signalés par l&apos;administration. Une fois validés, les nouveaux fichiers apparaissent automatiquement dans votre dossier côté admin.
                </p>
            </header>

            {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    {error}
                </div>
            )}
            {toast && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm inline-flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> {toast}
                </div>
            )}

            {flagged.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
                    <h2 className="mt-3 font-black text-gray-800">Aucun document à renvoyer</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Si l&apos;administration signale un problème, vous pourrez téléverser le fichier corrigé depuis cette page.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <h2 className="text-sm font-black uppercase tracking-widest text-red-700">
                            Documents signalés
                        </h2>
                    </div>

                    <ul className="divide-y divide-gray-50">
                        {flagged.map(({ key, label, url, v }) => (
                            <li key={key} className="px-6 py-4">
                                <div className="flex items-start gap-3 flex-wrap">
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-red-50">
                                        <AlertTriangle className="h-4 w-4 text-red-600" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800">{label}</p>
                                        {v.resubmit_message && (
                                            <p className="text-xs text-red-700 mt-1 italic">« {v.resubmit_message} »</p>
                                        )}
                                        {url && (
                                            <button
                                                type="button"
                                                onClick={() => setPreviewFile({ url, title: `${label} — fichier actuel` })}
                                                className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                            >
                                                <Eye className="h-3 w-3" />
                                                Visualiser le fichier actuel
                                            </button>
                                        )}
                                    </div>
                                    <div className="shrink-0">
                                        <input
                                            ref={el => { fileInputs.current[key] = el; }}
                                            type="file"
                                            className="hidden"
                                            accept="application/pdf,image/jpeg,image/png,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                            onChange={e => {
                                                const f = e.target.files?.[0];
                                                if (f) handleResubmit(key, f);
                                                e.currentTarget.value = "";
                                            }}
                                        />
                                        <button
                                            disabled={uploadingKey === key}
                                            onClick={() => fileInputs.current[key]?.click()}
                                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            {uploadingKey === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                                            {uploadingKey === key ? "Envoi…" : "Téléverser"}
                                        </button>
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Recent resubmits awaiting review */}
            {(() => {
                const reviewing = Object.entries(DOC_LABELS)
                    .map(([key, label]) => {
                        const v: DocumentValidationEntry = validation[key] || {};
                        return { key, label, v };
                    })
                    .filter(d => d.v.resubmitted_at && !d.v.resubmit_requested && d.v.valid !== true);

                if (reviewing.length === 0) return null;
                return (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-600" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-amber-700">
                                En cours de revue
                            </h2>
                        </div>
                        <ul className="divide-y divide-gray-50">
                            {reviewing.map(({ key, label }) => (
                                <li key={key} className="px-6 py-3 flex items-center gap-3">
                                    <FileText className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm text-gray-700">{label}</span>
                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                        Nouveau fichier envoyé
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })()}

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
