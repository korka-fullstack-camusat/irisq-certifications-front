"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    Upload,
    AlertTriangle,
    CheckCircle2,
    Loader2,
    FileText,
    Eye,
    Clock,
    ExternalLink,
    Tag,
    CalendarDays,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { candidateResubmitDocument, uploadFiles, fetchAdminDocumentsPublic, type DocumentValidationEntry, type AdminDocument } from "@/lib/api";
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

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://irisq-certifications-api.onrender.com";

function categoryColor(cat: string): { bg: string; text: string; border: string } {
    if (cat === "Conditions de validation") return { bg: "#e8f5e9", text: "#2e7d32", border: "#c8e6c9" };
    if (cat === "Guide candidat")          return { bg: "#e8eaf6", text: "#1a237e", border: "#c5cae9" };
    if (cat === "Règlement d'examen")      return { bg: "#fff8e1", text: "#b45309", border: "#ffe082" };
    if (cat === "Formulaire")              return { bg: "#fce4ec", text: "#c62828", border: "#f8bbd0" };
    return { bg: "#f3f4f6", text: "#555", border: "#e0e0e0" };
}

export default function CandidateDocumentsPage() {
    const { dossier, loading, setDossier } = useCandidate();
    const [uploadingKey, setUploadingKey] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);
    const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

    // Documents officiels
    const [officialDocs, setOfficialDocs] = useState<AdminDocument[]>([]);
    const [loadingDocs, setLoadingDocs] = useState(true);

    useEffect(() => {
        fetchAdminDocumentsPublic()
            .then(setOfficialDocs)
            .catch(() => setOfficialDocs([]))
            .finally(() => setLoadingDocs(false));
    }, []);

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
                    Documents
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Consultez les documents officiels publiés par IRISQ et gérez vos documents de dossier.
                </p>
            </header>

            {/* ── Section : Documents officiels ── */}
            <section className="space-y-3">
                <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                    Documents officiels
                </h2>

                {loadingDocs ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                    </div>
                ) : officialDocs.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
                        <FileText className="h-8 w-8 mx-auto text-gray-200 mb-2" />
                        <p className="text-sm text-gray-400">Aucun document officiel disponible pour le moment.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {officialDocs.map((doc) => {
                            const col = categoryColor(doc.category || "Autre");
                            const date = doc.uploaded_at
                                ? new Date(doc.uploaded_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                                : null;
                            const fullUrl = doc.file_url.startsWith("http")
                                ? doc.file_url
                                : `${API_BASE}${doc.file_url}`;

                            return (
                                <div
                                    key={doc._id}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-start gap-4"
                                >
                                    <div
                                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: "#e8eaf6" }}
                                    >
                                        <FileText className="h-5 w-5" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 text-sm leading-snug">{doc.title}</p>
                                        {doc.description && (
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{doc.description}</p>
                                        )}
                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                            <span
                                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: col.bg, color: col.text, border: `1px solid ${col.border}` }}
                                            >
                                                <Tag className="h-2.5 w-2.5" />
                                                {doc.category || "Autre"}
                                            </span>
                                            {date && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-400">
                                                    <CalendarDays className="h-2.5 w-2.5" />
                                                    {date}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => setPreviewFile({ url: doc.file_url, title: doc.title })}
                                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Aperçu"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        <a
                                            href={fullUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Télécharger"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* ── Séparateur ── */}
            <div className="border-t border-gray-100 pt-2">
                <h2 className="font-bold text-gray-700 text-sm flex items-center gap-2 mb-3">
                    <Upload className="h-4 w-4" style={{ color: "#1a237e" }} />
                    Renvoi de documents signalés
                </h2>
            </div>

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
