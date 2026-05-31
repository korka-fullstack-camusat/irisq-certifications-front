"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
    FileText,
    Upload,
    Trash2,
    Loader2,
    Plus,
    X,
    ExternalLink,
    CalendarDays,
    Tag,
    FolderOpen,
    Eye,
    Mail,
    CheckCircle2,
} from "lucide-react";

import {
    fetchAdminDocuments,
    createAdminDocument,
    deleteAdminDocument,
    uploadFiles,
    sendTestEmail,
    type AdminDocument,
} from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const CATEGORIES = [
    "Conditions de validation",
    "Guide candidat",
    "Règlement d'examen",
    "Formulaire",
    "Autre",
];

function categoryColor(cat: string): { bg: string; text: string; border: string } {
    if (cat === "Conditions de validation") return { bg: "#e8f5e9", text: "#2e7d32", border: "#c8e6c9" };
    if (cat === "Guide candidat")          return { bg: "#e8eaf6", text: "#1a237e", border: "#c5cae9" };
    if (cat === "Règlement d'examen")      return { bg: "#fff8e1", text: "#b45309", border: "#ffe082" };
    if (cat === "Formulaire")              return { bg: "#fce4ec", text: "#c62828", border: "#f8bbd0" };
    return { bg: "#f3f4f6", text: "#555", border: "#e0e0e0" };
}

function fileIcon(name: string) {
    const ext = (name || "").split(".").pop()?.toLowerCase();
    const colors: Record<string, string> = { pdf: "#c62828", docx: "#1a237e", doc: "#1a237e", xlsx: "#2e7d32" };
    return colors[ext || ""] || "#555";
}

export default function DashboardDocumentsPage() {
    const [docs, setDocs] = useState<AdminDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Upload form
    const [formOpen, setFormOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [fileObj, setFileObj] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<AdminDocument | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Preview
    const [preview, setPreview] = useState<{ url: string; title?: string } | null>(null);

    // Test email
    const [testEmailOpen, setTestEmailOpen] = useState(false);
    const [testEmailAddr, setTestEmailAddr] = useState("");
    const [testEmailLoading, setTestEmailLoading] = useState(false);
    const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; msg: string } | null>(null);

    async function handleTestEmail() {
        if (!testEmailAddr.trim()) return;
        try {
            setTestEmailLoading(true);
            setTestEmailResult(null);
            const r = await sendTestEmail(testEmailAddr.trim());
            setTestEmailResult({ ok: true, msg: r.message });
        } catch (e) {
            setTestEmailResult({ ok: false, msg: e instanceof Error ? e.message : "Erreur inconnue" });
        } finally {
            setTestEmailLoading(false);
        }
    }

    async function load() {
        try {
            setLoading(true);
            setError(null);
            setDocs(await fetchAdminDocuments());
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function resetForm() {
        setTitle("");
        setDescription("");
        setCategory(CATEGORIES[0]);
        setFileObj(null);
        setFormError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim()) { setFormError("Le titre est obligatoire."); return; }
        if (!fileObj) { setFormError("Veuillez sélectionner un fichier."); return; }

        try {
            setUploading(true);
            setFormError(null);

            const form = new FormData();
            form.append("files", fileObj);
            const { file_urls } = await uploadFiles(form);
            if (!file_urls?.[0]) throw new Error("Upload incomplet");

            await createAdminDocument({
                title: title.trim(),
                description: description.trim(),
                category,
                file_url: file_urls[0],
                original_name: fileObj.name,
            });

            resetForm();
            setFormOpen(false);
            await load();
        } catch (e) {
            setFormError(e instanceof Error ? e.message : "Erreur lors de l'envoi");
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        try {
            setDeleting(true);
            await deleteAdminDocument(deleteTarget._id);
            setDeleteTarget(null);
            await load();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de la suppression");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <div className="space-y-6">
            {/* ── En-tête ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <FolderOpen className="h-6 w-6" />
                        Documents officiels
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Publiez ici les documents que les candidats pourront consulter et télécharger depuis leur espace.
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => { setTestEmailResult(null); setTestEmailAddr(""); setTestEmailOpen(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all hover:-translate-y-0.5"
                        style={{ borderColor: "#c5cae9", color: "#1a237e", backgroundColor: "#e8eaf6" }}
                    >
                        <Mail className="h-4 w-4" />
                        Tester l&apos;email
                    </button>
                    <button
                        onClick={() => { resetForm(); setFormOpen(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                    >
                        <Plus className="h-4 w-4" />
                        Ajouter un document
                    </button>
                </div>
            </div>

            {/* ── Modal test email ── */}
            {testEmailOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ scale: 0.93, opacity: 0, y: 12 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                    >
                        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                            <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-white/80" />
                                <span className="text-sm font-bold uppercase tracking-widest text-white">Test de l&apos;email</span>
                            </div>
                            <button onClick={() => setTestEmailOpen(false)} className="text-white/60 hover:text-white">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="px-6 py-6 space-y-4">
                            <p className="text-sm text-gray-500">
                                Envoyez un email de test pour vérifier que la configuration Brevo fonctionne correctement.
                            </p>
                            <div>
                                <label className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5 block">
                                    Adresse email de test
                                </label>
                                <input
                                    type="email"
                                    value={testEmailAddr}
                                    onChange={e => setTestEmailAddr(e.target.value)}
                                    placeholder="ex: admin@irisq.sn"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2"
                                    style={{ "--tw-ring-color": "#c5cae9" } as React.CSSProperties}
                                    onKeyDown={e => { if (e.key === "Enter") handleTestEmail(); }}
                                />
                            </div>
                            {testEmailResult && (
                                <div
                                    className="rounded-xl p-3 text-sm flex items-start gap-2"
                                    style={{
                                        backgroundColor: testEmailResult.ok ? "#e8f5e9" : "#ffebee",
                                        color: testEmailResult.ok ? "#2e7d32" : "#c62828",
                                    }}
                                >
                                    {testEmailResult.ok
                                        ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                                        : <X className="h-4 w-4 shrink-0 mt-0.5" />
                                    }
                                    <span>{testEmailResult.msg}</span>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button
                                    onClick={() => setTestEmailOpen(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-gray-50 transition-colors"
                                    style={{ borderColor: "#e0e0e0", color: "#555" }}
                                >
                                    Fermer
                                </button>
                                <button
                                    onClick={handleTestEmail}
                                    disabled={testEmailLoading || !testEmailAddr.trim()}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
                                    style={{ backgroundColor: "#1a237e" }}
                                >
                                    {testEmailLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                    {testEmailLoading ? "Envoi…" : "Envoyer"}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* ── Modal ajout document ── */}
            {formOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 16 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                    >
                        {/* Header */}
                        <div
                            className="px-6 py-4 flex items-center justify-between"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            <div className="flex items-center gap-2">
                                <Upload className="h-4 w-4 text-white/80" />
                                <span className="text-sm font-bold uppercase tracking-widest text-white">
                                    Nouveau document
                                </span>
                            </div>
                            <button
                                onClick={() => { setFormOpen(false); resetForm(); }}
                                className="text-white/60 hover:text-white transition-colors"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                                    {formError}
                                </div>
                            )}

                            {/* Titre */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">
                                    Titre <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Ex : Guide de validation ISO 9001:2015"
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    autoFocus
                                />
                            </div>

                            {/* Catégorie */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">
                                    Catégorie
                                </label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                                >
                                    {CATEGORIES.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">
                                    Description <span className="text-gray-300">(optionnel)</span>
                                </label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    rows={3}
                                    placeholder="Courte description visible par les candidats…"
                                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>

                            {/* Fichier — zone large en bas */}
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1.5">
                                    Fichier <span className="text-red-500">*</span>
                                </label>
                                <div
                                    className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-6 cursor-pointer transition-colors"
                                    style={{
                                        borderColor: fileObj ? "#1a237e" : "#d1d5db",
                                        backgroundColor: fileObj ? "#e8eaf6" : "#fafafa",
                                    }}
                                    onClick={() => fileInputRef.current?.click()}
                                    onMouseEnter={e => { if (!fileObj) (e.currentTarget as HTMLElement).style.borderColor = "#6366f1"; }}
                                    onMouseLeave={e => { if (!fileObj) (e.currentTarget as HTMLElement).style.borderColor = "#d1d5db"; }}
                                >
                                    <div
                                        className="h-10 w-10 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: fileObj ? "#c5cae9" : "#e5e7eb" }}
                                    >
                                        <Upload className="h-5 w-5" style={{ color: fileObj ? "#1a237e" : "#9ca3af" }} />
                                    </div>
                                    {fileObj ? (
                                        <>
                                            <p className="text-sm font-bold text-center" style={{ color: "#1a237e" }}>
                                                {fileObj.name}
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {(fileObj.size / 1024).toFixed(0)} Ko · Cliquez pour changer
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-sm font-semibold text-gray-600">
                                                Cliquez pour sélectionner un fichier
                                            </p>
                                            <p className="text-xs text-gray-400">PDF, DOCX, JPG, PNG — max 15 Mo</p>
                                        </>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,image/jpeg,image/png"
                                        onChange={e => setFileObj(e.target.files?.[0] || null)}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setFormOpen(false); resetForm(); }}
                                    disabled={uploading}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={uploading}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                                    style={{ backgroundColor: "#1a237e", boxShadow: uploading ? "none" : "0 6px 16px rgba(26,35,126,0.25)" }}
                                >
                                    {uploading
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                                        : <><Upload className="h-4 w-4" /> Publier</>
                                    }
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}

            {/* ── Contenu ── */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : error ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
            ) : docs.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-dashed border-gray-200 p-14 text-center"
                >
                    <div
                        className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: "#e8eaf6" }}
                    >
                        <FileText className="h-8 w-8" style={{ color: "#1a237e" }} />
                    </div>
                    <p className="font-bold text-gray-700 mb-1">Aucun document publié</p>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">
                        Cliquez sur « Ajouter un document » pour publier votre premier document officiel.
                    </p>
                </motion.div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {docs.map((doc, i) => {
                        const col = categoryColor(doc.category || "Autre");
                        const iconColor = fileIcon(doc.original_name || "");
                        const date = doc.uploaded_at
                            ? new Date(doc.uploaded_at).toLocaleDateString("fr-FR", {
                                day: "2-digit", month: "short", year: "numeric",
                              })
                            : null;

                        return (
                            <motion.div
                                key={doc._id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.04 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
                            >
                                {/* Card header */}
                                <div className="px-5 pt-5 pb-4 flex items-start gap-3 flex-1">
                                    <div
                                        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: "#f4f6f9" }}
                                    >
                                        <FileText className="h-5 w-5" style={{ color: iconColor }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-gray-800 leading-snug line-clamp-2 text-sm">
                                            {doc.title}
                                        </p>
                                        {doc.description && (
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{doc.description}</p>
                                        )}
                                        {doc.original_name && (
                                            <p className="text-[10px] text-gray-400 font-mono mt-1 truncate">
                                                {doc.original_name}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Footer */}
                                <div
                                    className="px-5 py-3 flex items-center justify-between gap-2 border-t"
                                    style={{ borderColor: "#f0f0f0", backgroundColor: "#fafafa" }}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span
                                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0"
                                            style={{ backgroundColor: col.bg, color: col.text, border: `1px solid ${col.border}` }}
                                        >
                                            <Tag className="h-2.5 w-2.5" />
                                            {doc.category || "Autre"}
                                        </span>
                                        {date && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                                                <CalendarDays className="h-2.5 w-2.5" />
                                                {date}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => setPreview({ url: doc.file_url, title: doc.title })}
                                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Aperçu"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        <a
                                            href={`https://irisq-certifications-api.onrender.com${doc.file_url}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="p-2 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                            title="Ouvrir"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                        <button
                                            onClick={() => setDeleteTarget(doc)}
                                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                            title="Supprimer"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Modal suppression ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "#c62828" }}>
                            <Trash2 className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">Supprimer le document</span>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-700">
                                Voulez-vous supprimer <strong>« {deleteTarget.title} »</strong> ?
                                Les candidats ne pourront plus y accéder.
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    disabled={deleting}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                    style={{ backgroundColor: "#c62828" }}
                                >
                                    {deleting
                                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Suppression…</>
                                        : <><Trash2 className="h-4 w-4" /> Supprimer</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {preview && (
                <FilePreviewModal
                    url={preview.url}
                    title={preview.title}
                    onClose={() => setPreview(null)}
                />
            )}
        </div>
    );
}
