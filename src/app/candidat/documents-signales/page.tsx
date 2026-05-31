"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    AlertTriangle, CheckCircle2, FileText, Loader2,
    ShieldCheck, Upload,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import {
    candidateResubmitDocument,
    uploadFiles,
    type DocumentValidationEntry,
    type CandidateDossier,
} from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

// ── Constantes ────────────────────────────────────────────────────────────────
const DOC_LABELS: Record<string, string> = {
    "CV":                          "Curriculum Vitae",
    "Pièce d'identité":            "Pièce d'identité",
    "Justificatif d'expérience":   "Justificatif d'expérience",
    "Diplômes":                    "Diplômes / attestations",
};

// ── Panneau de renvoi pour un dossier ──────────────────────────────────────
function FlaggedDocPanel({
    d,
    onPreview,
    onResubmit,
    uploadingKey,
}: {
    d: CandidateDossier;
    onPreview: (url: string, title?: string) => void;
    onResubmit: (dossier: CandidateDossier, docKey: string, file: File) => void;
    uploadingKey: string | null;
}) {
    const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
    const validation = d.documents_validation || {};

    const flagged = Object.entries(DOC_LABELS)
        .map(([key, label]) => {
            const v: DocumentValidationEntry = validation[key] || {};
            return { key, label, v };
        })
        .filter(({ v }) => v.resubmit_requested);

    if (flagged.length === 0) return null;

    const cert = d.answers?.["Certification souhaitée"] || d.public_id || "Dossier";

    return (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* En-tête dossier */}
            <div
                className="px-5 py-3 flex items-center gap-3"
                style={{ backgroundColor: "#fff8e1", borderBottom: "1px solid #ffe082" }}
            >
                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#b45309" }} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{cert}</p>
                    {d.public_id && (
                        <p className="text-[10px] text-gray-400 font-mono">{d.public_id}</p>
                    )}
                </div>
                <span
                    className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "#ffecb3", color: "#b45309" }}
                >
                    {flagged.length} doc{flagged.length > 1 ? "s" : ""} à renvoyer
                </span>
            </div>

            {/* Liste des documents signalés */}
            <ul className="divide-y divide-gray-50">
                {flagged.map(({ key, label, v }) => {
                    const uploading = uploadingKey === `${d._id}__${key}`;
                    return (
                        <li key={key} className="px-5 py-4 flex items-start gap-3 flex-wrap">
                            <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: "#fff5f5" }}
                            >
                                <FileText className="h-4 w-4" style={{ color: "#dc2626" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-gray-800 text-sm">{label}</p>
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                                        <AlertTriangle className="h-3 w-3" />À renvoyer
                                    </span>
                                </div>
                                {v.resubmit_message && (
                                    <p className="text-xs text-red-700 mt-1 italic leading-relaxed">
                                        «&nbsp;{v.resubmit_message}&nbsp;»
                                    </p>
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
                                        if (f) onResubmit(d, key, f);
                                        e.currentTarget.value = "";
                                    }}
                                />
                                <button
                                    disabled={!!uploading}
                                    onClick={() => fileInputs.current[key]?.click()}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all hover:-translate-y-0.5"
                                    style={{ backgroundColor: "#1a237e", boxShadow: "0 4px 12px rgba(26,35,126,0.2)" }}
                                >
                                    {uploading
                                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Envoi…</>
                                        : <><Upload className="h-3.5 w-3.5" />Renvoyer</>
                                    }
                                </button>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function DocumentsSignalesPage() {
    const { dossiers, loading, setDossier } = useCandidate();
    const [uploadingKey, setUploadingKey]   = useState<string | null>(null);
    const [toastMsg, setToastMsg]           = useState<string | null>(null);
    const [errorMsg, setErrorMsg]           = useState<string | null>(null);
    const [previewFile, setPreviewFile]     = useState<{ url: string; title?: string } | null>(null);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const handleResubmit = async (d: CandidateDossier, docKey: string, file: File) => {
        const compositeKey = `${d._id}__${docKey}`;
        try {
            setUploadingKey(compositeKey);
            setErrorMsg(null);
            setToastMsg(null);
            const form = new FormData();
            form.append("files", file);
            const { file_urls } = await uploadFiles(form);
            if (!file_urls?.[0]) throw new Error("Upload incomplet");
            const updated = await candidateResubmitDocument(docKey, file_urls[0]);
            setDossier(updated);
            setToastMsg(`« ${docKey} » transmis avec succès.`);
        } catch (e) {
            setErrorMsg(e instanceof Error ? e.message : "Erreur lors de l'envoi");
        } finally {
            setUploadingKey(null);
        }
    };

    // Dossiers ayant au moins un document signalé
    const dossiersAvecSignalement = dossiers.filter(d => {
        const validation = d.documents_validation || {};
        return Object.keys(DOC_LABELS).some(key => {
            const v: DocumentValidationEntry = validation[key] || {};
            return v.resubmit_requested;
        });
    });

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* ── En-tête ── */}
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Espace candidat</p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Documents signalés</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Renvoyez les documents signalés par l&apos;administration pour compléter votre dossier.
                </p>
            </header>

            {/* Toast / Erreur */}
            <AnimatePresence>
                {toastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"
                        onAnimationComplete={() => setTimeout(() => setToastMsg(null), 3000)}
                    >
                        <CheckCircle2 className="h-4 w-4 shrink-0" />{toastMsg}
                    </motion.div>
                )}
                {errorMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
                    >
                        <AlertTriangle className="h-4 w-4 shrink-0" />{errorMsg}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Contenu ── */}
            {dossiersAvecSignalement.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
                    <div
                        className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: "#e8f5e9" }}
                    >
                        <CheckCircle2 className="h-7 w-7" style={{ color: "#2e7d32" }} />
                    </div>
                    <p className="font-bold text-gray-700">Aucun document signalé</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Tous vos documents sont en ordre. L&apos;administration vous contactera si nécessaire.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {dossiersAvecSignalement.map(d => (
                        <FlaggedDocPanel
                            key={d._id}
                            d={d}
                            onPreview={(url, title) => setPreviewFile({ url, title })}
                            onResubmit={handleResubmit}
                            uploadingKey={uploadingKey}
                        />
                    ))}
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
