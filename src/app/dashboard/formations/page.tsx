"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    GraduationCap, Plus, Pencil, Trash2, Loader2,
    CheckCircle2, XCircle, X, AlertCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
    fetchFormations, createFormation, updateFormation, deleteFormation,
    type Formation,
} from "@/lib/api";

export default function FormationsPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [formations, setFormations] = useState<Formation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Formation | null>(null);
    const [form, setForm] = useState({ title: "", description: "", is_active: true });
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Formation | null>(null);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) router.replace("/dashboard");
    }, [isLoading, user, router]);

    async function load() {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchFormations();
            setFormations(data);
        } catch {
            setError("Impossible de charger les formations.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    function openCreate() {
        setEditing(null);
        setForm({ title: "", description: "", is_active: true });
        setSaveError(null);
        setShowModal(true);
    }

    function openEdit(f: Formation) {
        setEditing(f);
        setForm({ title: f.title, description: f.description ?? "", is_active: f.is_active });
        setSaveError(null);
        setShowModal(true);
    }

    async function handleSave() {
        if (!form.title.trim()) { setSaveError("Le titre est obligatoire."); return; }
        setSaving(true);
        setSaveError(null);
        try {
            if (editing) {
                const updated = await updateFormation(editing.id, {
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    is_active: form.is_active,
                });
                setFormations(prev => prev.map(f => f.id === updated.id ? updated : f));
            } else {
                const created = await createFormation({
                    title: form.title.trim(),
                    description: form.description.trim() || undefined,
                    is_active: form.is_active,
                });
                setFormations(prev => [created, ...prev]);
            }
            setShowModal(false);
        } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Erreur lors de la sauvegarde.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(f: Formation) {
        setDeletingId(f.id);
        try {
            await deleteFormation(f.id);
            setFormations(prev => prev.filter(x => x.id !== f.id));
        } catch {
            setError("Impossible de supprimer la formation.");
        } finally {
            setDeletingId(null);
            setConfirmDelete(null);
        }
    }

    async function toggleActive(f: Formation) {
        try {
            const updated = await updateFormation(f.id, { is_active: !f.is_active });
            setFormations(prev => prev.map(x => x.id === updated.id ? updated : x));
        } catch {
            setError("Impossible de modifier le statut.");
        }
    }

    return (
        <div className="space-y-6">

            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: "#e8eaf6" }}
                    >
                        <GraduationCap className="h-5 w-5" style={{ color: "#1a237e" }} />
                    </div>
                    <div>
                        <h1 className="text-xl font-black tracking-tight" style={{ color: "#0f172a" }}>
                            Formations
                        </h1>
                        <p className="text-xs text-gray-400 font-medium">
                            {formations.length} formation{formations.length !== 1 ? "s" : ""} enregistrée{formations.length !== 1 ? "s" : ""}
                        </p>
                    </div>
                </div>

                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                    style={{ backgroundColor: "#1a237e", boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}
                >
                    <Plus className="h-4 w-4" />
                    Nouvelle formation
                </button>
            </div>

            {/* ── Erreur globale ── */}
            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl text-sm font-medium"
                    style={{ backgroundColor: "#fff5f5", border: "1px solid #fecaca", color: "#991b1b" }}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                </div>
            )}

            {/* ── Contenu ── */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#1a237e" }} />
                </div>
            ) : formations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4">
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center"
                        style={{ backgroundColor: "#e8eaf6" }}>
                        <GraduationCap className="h-8 w-8" style={{ color: "#1a237e" }} />
                    </div>
                    <p className="text-gray-400 text-sm font-medium">Aucune formation créée pour le moment.</p>
                    <button
                        onClick={openCreate}
                        className="text-sm font-bold px-4 py-2 rounded-xl text-white"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        Créer la première formation
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {formations.map((f, i) => (
                        <motion.div
                            key={f.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="bg-white rounded-2xl p-4 flex items-center gap-4"
                            style={{ border: "1px solid #e8eaf6", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
                        >
                            {/* Icône */}
                            <div
                                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: f.is_active ? "#e8f5e9" : "#f1f5f9" }}
                            >
                                <GraduationCap
                                    className="h-5 w-5"
                                    style={{ color: f.is_active ? "#2e7d32" : "#94a3b8" }}
                                />
                            </div>

                            {/* Infos */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{f.title}</p>
                                {f.description && (
                                    <p className="text-xs text-gray-400 truncate mt-0.5">{f.description}</p>
                                )}
                            </div>

                            {/* Badge statut */}
                            <span
                                className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                                style={{
                                    backgroundColor: f.is_active ? "#e8f5e9" : "#f1f5f9",
                                    color: f.is_active ? "#2e7d32" : "#94a3b8",
                                }}
                            >
                                {f.is_active ? "Active" : "Inactive"}
                            </span>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                                <button
                                    onClick={() => toggleActive(f)}
                                    title={f.is_active ? "Désactiver" : "Activer"}
                                    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                >
                                    {f.is_active
                                        ? <XCircle className="h-4 w-4 text-gray-400" />
                                        : <CheckCircle2 className="h-4 w-4" style={{ color: "#2e7d32" }} />
                                    }
                                </button>
                                <button
                                    onClick={() => openEdit(f)}
                                    title="Modifier"
                                    className="p-2 rounded-lg transition-colors hover:bg-gray-100"
                                >
                                    <Pencil className="h-4 w-4" style={{ color: "#1a237e" }} />
                                </button>
                                <button
                                    onClick={() => setConfirmDelete(f)}
                                    title="Supprimer"
                                    className="p-2 rounded-lg transition-colors hover:bg-red-50"
                                    disabled={deletingId === f.id}
                                >
                                    {deletingId === f.id
                                        ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                        : <Trash2 className="h-4 w-4" style={{ color: "#c62828" }} />
                                    }
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* ══ MODAL CRÉATION / ÉDITION ══ */}
            <AnimatePresence>
                {showModal && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => !saving && setShowModal(false)}
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.93, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 12 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                                style={{ border: "2px solid #e8eaf6" }}>

                                {/* Header */}
                                <div className="px-6 py-4 flex items-center justify-between"
                                    style={{ backgroundColor: "#1a237e" }}>
                                    <div className="flex items-center gap-2">
                                        <GraduationCap className="h-4 w-4 text-white/80" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-white">
                                            {editing ? "Modifier la formation" : "Nouvelle formation"}
                                        </span>
                                    </div>
                                    <button onClick={() => !saving && setShowModal(false)}
                                        className="text-white/60 hover:text-white transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="px-6 py-6 space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-600">
                                            Titre <span style={{ color: "#c62828" }}>*</span>
                                        </label>
                                        <input
                                            value={form.title}
                                            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                            placeholder="ex: Junior Implementor ISO 9001:2015"
                                            className="w-full bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1a237e] transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-gray-600">
                                            Description
                                        </label>
                                        <textarea
                                            value={form.description}
                                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                            placeholder="Description optionnelle de la formation…"
                                            rows={3}
                                            className="w-full bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#1a237e] transition-all resize-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                                            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
                                            style={{ backgroundColor: form.is_active ? "#2e7d32" : "#d1d5db" }}
                                        >
                                            <span
                                                className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                                                style={{ transform: form.is_active ? "translateX(22px)" : "translateX(2px)" }}
                                            />
                                        </button>
                                        <span className="text-sm font-medium text-gray-600">
                                            {form.is_active ? "Active — visible dans le formulaire" : "Inactive — masquée du formulaire"}
                                        </span>
                                    </div>

                                    {saveError && (
                                        <div className="flex items-center gap-2 text-sm p-3 rounded-xl"
                                            style={{ backgroundColor: "#fff5f5", color: "#991b1b" }}>
                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                            {saveError}
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="px-6 pb-6 flex gap-3">
                                    <button
                                        onClick={() => !saving && setShowModal(false)}
                                        disabled={saving}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50 disabled:opacity-50"
                                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:translate-y-0"
                                        style={{ backgroundColor: "#1a237e", boxShadow: "0 4px 14px rgba(26,35,126,0.25)" }}
                                    >
                                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                                        {editing ? "Enregistrer" : "Créer"}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ══ MODAL CONFIRMATION SUPPRESSION ══ */}
            <AnimatePresence>
                {confirmDelete && (
                    <>
                        <motion.div
                            key="del-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => setConfirmDelete(null)}
                        />
                        <motion.div
                            key="del-modal"
                            initial={{ opacity: 0, scale: 0.93, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.93, y: 12 }}
                            transition={{ duration: 0.2 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto"
                                style={{ border: "2px solid #e8eaf6" }}>
                                <div className="px-6 py-4 flex items-center justify-between"
                                    style={{ backgroundColor: "#c62828" }}>
                                    <span className="text-sm font-bold uppercase tracking-widest text-white">
                                        Supprimer la formation
                                    </span>
                                    <button onClick={() => setConfirmDelete(null)}
                                        className="text-white/60 hover:text-white">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="px-6 py-6">
                                    <p className="text-sm text-gray-600 mb-1">Vous allez supprimer :</p>
                                    <p className="font-bold text-gray-800 mb-4">{confirmDelete.title}</p>
                                    <p className="text-xs text-gray-400 mb-6">
                                        Cette action est irréversible. La formation sera retirée du formulaire de demande.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setConfirmDelete(null)}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50 transition-colors"
                                            style={{ borderColor: "#e0e0e0", color: "#555" }}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={() => handleDelete(confirmDelete)}
                                            disabled={deletingId === confirmDelete.id}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                                            style={{ backgroundColor: "#c62828" }}
                                        >
                                            {deletingId === confirmDelete.id && <Loader2 className="h-4 w-4 animate-spin" />}
                                            Supprimer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
