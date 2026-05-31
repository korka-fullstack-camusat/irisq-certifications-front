"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    FileText, Loader2, Eye, ExternalLink, Tag, CalendarDays,
} from "lucide-react";

import { fetchAdminDocumentsPublic, type AdminDocument } from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "https://irisq-certifications-api.onrender.com";

function categoryColor(cat: string): { bg: string; text: string; border: string } {
    if (cat === "Conditions de validation") return { bg: "#e8f5e9", text: "#2e7d32", border: "#c8e6c9" };
    if (cat === "Guide candidat")           return { bg: "#e8eaf6", text: "#1a237e", border: "#c5cae9" };
    if (cat === "Règlement d'examen")       return { bg: "#fff8e1", text: "#b45309", border: "#ffe082" };
    if (cat === "Formulaire")               return { bg: "#fce4ec", text: "#c62828", border: "#f8bbd0" };
    return                                         { bg: "#f3f4f6", text: "#555",    border: "#e0e0e0" };
}

export default function DocumentsOfficielsPage() {
    const [docs,    setDocs]    = useState<AdminDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState<{ url: string; title?: string } | null>(null);

    useEffect(() => {
        fetchAdminDocumentsPublic()
            .then(setDocs)
            .catch(() => setDocs([]))
            .finally(() => setLoading(false));
    }, []);

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Espace candidat</p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Documents officiels</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Consultez les documents officiels publiés par IRISQ — guides, règlements, formulaires.
                </p>
            </header>

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                </div>
            ) : docs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
                    <FileText className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                    <p className="font-bold text-gray-700">Aucun document disponible</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Les documents officiels publiés par l&apos;administration apparaîtront ici.
                    </p>
                </div>
            ) : (
                <div className="space-y-2">
                    {docs.map((doc, i) => {
                        const col     = categoryColor(doc.category || "Autre");
                        const date    = doc.uploaded_at
                            ? new Date(doc.uploaded_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
                            : null;
                        const fullUrl = doc.file_url.startsWith("http")
                            ? doc.file_url
                            : `${API_BASE}${doc.file_url}`;

                        return (
                            <motion.div
                                key={doc._id}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
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
                                                <CalendarDays className="h-2.5 w-2.5" />{date}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => setPreview({ url: doc.file_url, title: doc.title })}
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
                                        title="Télécharger / ouvrir"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {preview && (
                <FilePreviewModal url={preview.url} title={preview.title} onClose={() => setPreview(null)} />
            )}
        </motion.div>
    );
}
