"use client";

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    FileText, CheckCircle2, AlertTriangle, Clock, Eye,
    Loader2, ShieldCheck, ChevronDown, ChevronUp, Upload,
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

function getDossierStatus(d: CandidateDossier) {
    if (d.final_decision === "certified") return { label: "Certifié ✓",   bg: "#e8f5e9", color: "#2e7d32" };
    if (d.exam_status === "graded")       return { label: "Noté",          bg: "#e8eaf6", color: "#1a237e" };
    if (d.exam_status === "submitted")    return { label: "Examen soumis", bg: "#e3f2fd", color: "#1565c0" };
    if (d.status === "approved")          return { label: "Validée",       bg: "#e8f5e9", color: "#2e7d32" };
    if (d.status === "rejected")          return { label: "Refusée",       bg: "#ffebee", color: "#c62828" };
    return                                       { label: "En attente",    bg: "#fff8e1", color: "#b45309" };
}

// ── Panneau documents d'un dossier ─────────────────────────────────────────
function DossierDocPanel({
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

    const entries = Object.entries(DOC_LABELS).map(([key, label]) => {
        const raw = d.answers?.[key];
        const url = extractUrl(raw);
        const v: DocumentValidationEntry = validation[key] || {};
        return { key, label, url, v };
    });

    const hasFlagged = entries.some(e => e.v.resubmit_requested);

    return (
        <div>
            {hasFlagged && (
                <div
                    className="mx-4 mt-3 mb-0 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-medium"
                    style={{ backgroundColor: "#fff8e1", color: "#b45309", border: "1px solid #ffe082" }}
                >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Des documents nécessitent votre attention.
                </div>
            )}
            <ul className="divide-y divide-gray-50">
                {entries.map(({ key, label, url, v }) => {
                    const isValid      = v.valid === true;
                    const needResubmit = !!v.resubmit_requested;
                    const justRe       = !!v.resubmitted_at && !needResubmit && !isValid;
                    const uploading    = uploadingKey === `${d._id}__${key}`;

                    const badge = needResubmit
                        ? { label: "À renvoyer", bg: "bg-red-50",    text: "text-red-700",   icon: <AlertTriangle className="h-3 w-3" /> }
                        : isValid
                            ? { label: "Validé",     bg: "bg-green-50",  text: "text-green-700", icon: <CheckCircle2  className="h-3 w-3" /> }
                            : justRe
                                ? { label: "En revue",   bg: "bg-amber-50",  text: "text-amber-700", icon: <Clock        className="h-3 w-3" /> }
                                : url
                                    ? { label: "Transmis",   bg: "bg-gray-100",  text: "text-gray-700",  icon: <Clock        className="h-3 w-3" /> }
                                    : { label: "Non fourni", bg: "bg-gray-50",   text: "text-gray-400",  icon: <Clock        className="h-3 w-3" /> };

                    return (
                        <li key={key} className="px-4 py-3 flex items-start gap-3 flex-wrap">
                            <div
                                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: needResubmit ? "#fff5f5" : isValid ? "#e8f5e9" : "#f3f4f6" }}
                            >
                                <FileText
                                    className="h-4 w-4"
                                    style={{ color: needResubmit ? "#dc2626" : isValid ? "#2e7d32" : "#64748b" }}
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-bold text-gray-800 text-sm">{label}</p>
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                                        {badge.icon}{badge.label}
                                    </span>
                                </div>
                                {needResubmit && v.resubmit_message && (
                                    <p className="text-xs text-red-700 mt-0.5 italic">«&nbsp;{v.resubmit_message}&nbsp;»</p>
                                )}
                                {url && (
                                    <button
                                        type="button"
                                        onClick={() => onPreview(url, label)}
                                        className="mt-1 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                                    >
                                        <Eye className="h-3 w-3" />Visualiser
                                    </button>
                                )}
                            </div>
                            {needResubmit && (
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white disabled:opacity-50"
                                        style={{ backgroundColor: "#1a237e" }}
                                    >
                                        {uploading
                                            ? <><Loader2 className="h-3 w-3 animate-spin" />Envoi…</>
                                            : <><Upload className="h-3 w-3" />Renvoyer</>
                                        }
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function MonDossierPage() {
    const { dossiers, loading, setDossier } = useCandidate();
    const [openIds,    setOpenIds]    = useState<Set<string>>(new Set());
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [toastMsg, setToastMsg]     = useState<string | null>(null);
    const [errorMsg, setErrorMsg]     = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const toggleOpen = (id: string) => {
        setOpenIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

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

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Espace candidat</p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Mon dossier</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Consultez et gérez les documents transmis pour chacune de vos candidatures.
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

            {dossiers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                    <FileText className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                    <p className="font-bold text-gray-700">Aucun dossier disponible</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {dossiers.map((d, idx) => {
                        const cert  = d.answers?.["Certification souhaitée"] || d.public_id || `Dossier ${idx + 1}`;
                        const st    = getDossierStatus(d);
                        const isOpen = openIds.has(d._id);

                        const flaggedCount = Object.keys(DOC_LABELS).filter(key => {
                            const v: DocumentValidationEntry = (d.documents_validation || {})[key] || {};
                            return v.resubmit_requested;
                        }).length;

                        return (
                            <div key={d._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                                {/* Header de la carte dossier */}
                                <button
                                    onClick={() => toggleOpen(d._id)}
                                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-gray-50 transition-colors"
                                >
                                    <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                        <ShieldCheck className="h-5 w-5" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 text-sm truncate">{cert}</p>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: st.bg, color: st.color }}>
                                                {st.label}
                                            </span>
                                            {d.public_id && (
                                                <span className="text-[10px] text-gray-400 font-mono">{d.public_id}</span>
                                            )}
                                            {flaggedCount > 0 && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                                                    {flaggedCount} doc{flaggedCount > 1 ? "s" : ""} à renvoyer
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {isOpen
                                        ? <ChevronUp  className="h-4 w-4 text-gray-400 shrink-0" />
                                        : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                                    }
                                </button>

                                {/* Corps — documents */}
                                <AnimatePresence initial={false}>
                                    {isOpen && (
                                        <motion.div
                                            key="content"
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="overflow-hidden border-t border-gray-100"
                                        >
                                            <DossierDocPanel
                                                d={d}
                                                onPreview={(url, title) => setPreviewFile({ url, title })}
                                                onResubmit={handleResubmit}
                                                uploadingKey={uploadingKey}
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
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
