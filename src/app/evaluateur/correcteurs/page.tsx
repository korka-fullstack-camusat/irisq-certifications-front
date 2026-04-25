"use client";

import { useState, useEffect, useCallback } from "react";
import { UserCog, Plus, X, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, Trash2, UserCheck, Search, Bell, PenLine } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    fetchCorrecteurs,
    createCorrecteur,
    toggleCorrecteurStatus,
    deleteCorrecteur,
    fetchUnassignedResponses,
    bulkAssignCorrecteur,
    relancerCorrecteur,
    type Correcteur,
    type UnassignedResponse,
} from "@/lib/api";

// ─── helpers ────────────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{
                backgroundColor: active ? "#e8f5e9" : "#fce4ec",
                color: active ? "#2e7d32" : "#c62828",
            }}
        >
            {active ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
            {active ? "Actif" : "Désactivé"}
        </span>
    );
}

function initials(name?: string | null, email?: string) {
    if (name) {
        const parts = name.trim().split(/\s+/);
        return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
    }
    return (email ?? "??")[0].toUpperCase();
}

// ─── Assign modal ────────────────────────────────────────────────────────────

interface AssignModalProps {
    correcteur: Correcteur;
    onClose: () => void;
    onAssigned: (count: number) => void;
}

function AssignModal({ correcteur, onClose, onAssigned }: AssignModalProps) {
    const [candidates, setCandidates] = useState<UnassignedResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchUnassignedResponses()
            .then(setCandidates)
            .catch(() => setError("Erreur lors du chargement des candidats"))
            .finally(() => setLoading(false));
    }, []);

    const filtered = candidates.filter(c => {
        const q = search.toLowerCase();
        return (
            (c.name?.toLowerCase().includes(q) ?? false) ||
            (c.public_id?.toLowerCase().includes(q) ?? false) ||
            (c.profile?.toLowerCase().includes(q) ?? false)
        );
    });

    const allSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id));

    const toggleAll = () => {
        if (allSelected) {
            setSelected(prev => {
                const next = new Set(prev);
                filtered.forEach(c => next.delete(c.id));
                return next;
            });
        } else {
            setSelected(prev => {
                const next = new Set(prev);
                filtered.forEach(c => next.add(c.id));
                return next;
            });
        }
    };

    const toggle = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleAssign = async () => {
        if (selected.size === 0) return;
        setSaving(true);
        setError(null);
        try {
            const { assigned } = await bulkAssignCorrecteur(correcteur.email, [...selected]);
            onAssigned(assigned);
        } catch (err: any) {
            setError(err.message || "Erreur lors de l'assignation");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <motion.div
                key="assign-overlay"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                key="assign-modal"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto flex flex-col"
                    style={{ border: "2px solid #e8eaf6", maxHeight: "85vh" }}
                >
                    {/* Header */}
                    <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#1a237e" }}>
                        <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-white/80" />
                            <div>
                                <span className="text-sm font-bold uppercase tracking-widest text-white">Assigner des candidats</span>
                                <p className="text-white/60 text-xs mt-0.5">{correcteur.full_name || correcteur.email}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/60 hover:text-white">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Search + select all */}
                    <div className="px-5 py-3 shrink-0 border-b" style={{ borderColor: "#e8eaf6" }}>
                        <div className="relative mb-2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Rechercher par nom, matricule, profil…"
                                className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm outline-none"
                                style={{ borderColor: "#e8eaf6" }}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={toggleAll}
                                    className="rounded"
                                    disabled={filtered.length === 0}
                                />
                                Tout sélectionner ({filtered.length})
                            </label>
                            {selected.size > 0 && (
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                    {selected.size} sélectionné{selected.size > 1 ? "s" : ""}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Candidate list */}
                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#1a237e" }} />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-400 gap-2">
                                <UserCheck className="h-10 w-10 opacity-30" />
                                <p className="text-sm font-semibold">
                                    {search ? "Aucun résultat" : "Tous les candidats ont déjà un correcteur"}
                                </p>
                            </div>
                        ) : (
                            <ul className="divide-y" style={{ borderColor: "#e8eaf6" }}>
                                {filtered.map(c => (
                                    <li
                                        key={c.id}
                                        onClick={() => toggle(c.id)}
                                        className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors"
                                        style={{ backgroundColor: selected.has(c.id) ? "#e8eaf6" : "transparent" }}
                                        onMouseEnter={e => { if (!selected.has(c.id)) (e.currentTarget as HTMLElement).style.backgroundColor = "#f4f6f9"; }}
                                        onMouseLeave={e => { if (!selected.has(c.id)) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.has(c.id)}
                                            onChange={() => toggle(c.id)}
                                            onClick={e => e.stopPropagation()}
                                            className="rounded shrink-0"
                                        />
                                        <div
                                            className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            {(c.name ?? "??")[0].toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{c.name || "—"}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {c.public_id && (
                                                    <span className="text-xs text-gray-400 font-mono">{c.public_id}</span>
                                                )}
                                                {c.profile && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                                        {c.profile}
                                                    </span>
                                                )}
                                                {c.exam_mode && (
                                                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                                                        {c.exam_mode === "online" ? "En ligne" : "Présentiel"}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-4 shrink-0 border-t" style={{ borderColor: "#e8eaf6" }}>
                        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold border hover:bg-gray-50 transition-colors"
                                style={{ borderColor: "#e0e0e0", color: "#555" }}
                            >
                                Fermer
                            </button>
                            <button
                                onClick={handleAssign}
                                disabled={selected.size === 0 || saving}
                                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                            >
                                {saving
                                    ? <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                                    : `Assigner (${selected.size})`
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </>
    );
}

// ─── Create modal ────────────────────────────────────────────────────────────

interface CreateModalProps {
    onClose: () => void;
    onCreated: (c: Correcteur) => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
    const [form, setForm] = useState({ full_name: "", email: "", password: "" });
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.email || !form.password) {
            setError("Email et mot de passe requis");
            return;
        }
        if (form.password.length < 6) {
            setError("Le mot de passe doit contenir au moins 6 caractères");
            return;
        }
        setLoading(true);
        try {
            const created = await createCorrecteur({
                email: form.email,
                password: form.password,
                full_name: form.full_name || undefined,
            });
            onCreated(created);
        } catch (err: any) {
            setError(err.message || "Erreur lors de la création");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                onClick={onClose}
            />
            <motion.div
                key="modal"
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 16 }}
                transition={{ duration: 0.22 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                    style={{ border: "2px solid #e8eaf6" }}
                >
                    {/* Header */}
                    <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                        <div className="flex items-center gap-2">
                            <UserCog className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">
                                Nouveau Correcteur
                            </span>
                        </div>
                        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Nom complet</label>
                            <input
                                type="text"
                                value={form.full_name}
                                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                                placeholder="Ex. Mamadou Diallo"
                                className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2"
                                style={{ borderColor: "#e0e0e0", "--ring-color": "#1a237e" } as React.CSSProperties}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="correcteur@exemple.com"
                                className="w-full px-3 py-2 rounded-xl border text-sm outline-none focus:ring-2"
                                style={{ borderColor: "#e0e0e0" } as React.CSSProperties}
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-600 mb-1">Mot de passe <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    type={showPwd ? "text" : "password"}
                                    required
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder="Min. 6 caractères"
                                    className="w-full px-3 py-2 pr-10 rounded-xl border text-sm outline-none focus:ring-2"
                                    style={{ borderColor: "#e0e0e0" } as React.CSSProperties}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                                style={{ borderColor: "#e0e0e0", color: "#555" }}
                            >
                                Annuler
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                                style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Créer le compte"}
                            </button>
                        </div>
                    </form>
                </div>
            </motion.div>
        </>
    );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CorrecteurPage() {
    const [correcteurs, setCorrecteurs] = useState<Correcteur[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [toggling, setToggling] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Correcteur | null>(null);
    const [assignTarget, setAssignTarget] = useState<Correcteur | null>(null);
    const [relancing, setRelancing] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await fetchCorrecteurs();
            setCorrecteurs(data);
        } catch (err: any) {
            setError(err.message || "Erreur de chargement");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (id: string) => {
        setDeleting(id);
        try {
            await deleteCorrecteur(id);
            setCorrecteurs(prev => prev.filter(c => c.id !== id));
        } catch {
            // silently ignore
        } finally {
            setDeleting(null);
            setConfirmDelete(null);
        }
    };

    const handleRelancer = async (id: string) => {
        setRelancing(id);
        try {
            const { pending_count } = await relancerCorrecteur(id);
            alert(`Email de relance envoyé — ${pending_count} copie(s) en attente.`);
        } catch (err: any) {
            alert(err.message || "Erreur lors de la relance");
        } finally {
            setRelancing(null);
        }
    };

    const handleToggle = async (id: string) => {
        setToggling(id);
        try {
            const updated = await toggleCorrecteurStatus(id);
            setCorrecteurs(prev =>
                prev.map(c => c.id === id ? { ...c, is_active: updated.is_active } : c)
            );
        } catch {
            // silently ignore — user sees no change
        } finally {
            setToggling(null);
        }
    };

    const filtered = correcteurs.filter(c => {
        const q = search.toLowerCase();
        return (
            c.email.toLowerCase().includes(q) ||
            (c.full_name?.toLowerCase().includes(q) ?? false)
        );
    });

    const activeCount = correcteurs.filter(c => c.is_active).length;

    return (
        <div>
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                        Attribuer Correcteur
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Gérez les comptes correcteurs — activez et désactivez selon la période de correction.
                    </p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 shrink-0"
                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.2)" }}
                >
                    <Plus className="h-4 w-4" />
                    Nouveau correcteur
                </button>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                {[
                    { label: "Total correcteurs", value: correcteurs.length, color: "#1a237e" },
                    { label: "Actifs",             value: activeCount,       color: "#2e7d32" },
                    { label: "Désactivés",         value: correcteurs.length - activeCount, color: "#c62828" },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl px-5 py-4 shadow-sm" style={{ border: "1.5px solid #e8eaf6" }}>
                        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{s.label}</p>
                        <p className="text-3xl font-black mt-1" style={{ color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher par nom ou email…"
                    className="w-full sm:w-80 px-4 py-2.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor: "#e8eaf6", backgroundColor: "#fff" }}
                />
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#1a237e" }} />
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-700 rounded-2xl px-6 py-4 text-sm font-semibold">
                    {error}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                    <UserCog className="h-12 w-12 opacity-30" />
                    <p className="font-semibold">
                        {search ? "Aucun résultat pour cette recherche" : "Aucun correcteur enregistré"}
                    </p>
                    {!search && (
                        <button
                            onClick={() => setShowCreate(true)}
                            className="mt-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            Créer le premier correcteur
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden" style={{ border: "1.5px solid #e8eaf6" }}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr style={{ backgroundColor: "#f4f6f9", borderBottom: "2px solid #e8eaf6" }}>
                                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Correcteur</th>
                                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Email</th>
                                <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Statut</th>
                                <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-wide text-gray-500">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c, i) => (
                                <tr
                                    key={c.id}
                                    style={{
                                        borderBottom: i < filtered.length - 1 ? "1px solid #e8eaf6" : "none",
                                        opacity: c.is_active ? 1 : 0.6,
                                    }}
                                >
                                    <td className="px-5 py-4">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                                                style={{ backgroundColor: c.is_active ? "#1a237e" : "#9e9e9e" }}
                                            >
                                                {initials(c.full_name, c.email)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{c.full_name || "—"}</p>
                                                <p className="text-xs text-gray-400 sm:hidden">{c.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-gray-600 hidden sm:table-cell">{c.email}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex flex-col gap-1">
                                            <Badge active={c.is_active} />
                                            {(c as any).correction_signed_at && (
                                                <span className="inline-flex items-center gap-1 text-xs font-bold" style={{ color: "#2e7d32" }}>
                                                    <PenLine className="h-3 w-3" /> Signé
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {c.is_active && (
                                                <>
                                                    <button
                                                        onClick={() => setAssignTarget(c)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:-translate-y-0.5"
                                                        style={{ borderColor: "#2e7d32", color: "#2e7d32", backgroundColor: "#f1f8f1" }}
                                                    >
                                                        <UserCheck className="h-3 w-3" /> Assigner
                                                    </button>
                                                    <button
                                                        onClick={() => handleRelancer(c.id)}
                                                        disabled={relancing === c.id}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:-translate-y-0.5 disabled:opacity-60"
                                                        style={{ borderColor: "#1a237e", color: "#1a237e", backgroundColor: "#e8eaf6" }}
                                                        title="Envoyer un email de rappel"
                                                    >
                                                        {relancing === c.id
                                                            ? <Loader2 className="h-3 w-3 animate-spin" />
                                                            : <><Bell className="h-3 w-3" /> Relancer</>
                                                        }
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => handleToggle(c.id)}
                                                disabled={toggling === c.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:-translate-y-0.5 disabled:opacity-60"
                                                style={c.is_active
                                                    ? { borderColor: "#c62828", color: "#c62828", backgroundColor: "#fff8f8" }
                                                    : { borderColor: "#2e7d32", color: "#2e7d32", backgroundColor: "#f1f8f1" }
                                                }
                                            >
                                                {toggling === c.id
                                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                                    : c.is_active
                                                        ? <><EyeOff className="h-3 w-3" /> Désactiver</>
                                                        : <><Eye className="h-3 w-3" /> Activer</>
                                                }
                                            </button>
                                            {!c.is_active && (
                                                <button
                                                    onClick={() => setConfirmDelete(c)}
                                                    disabled={deleting === c.id}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all hover:-translate-y-0.5 disabled:opacity-60"
                                                    style={{ borderColor: "#c62828", color: "#c62828", backgroundColor: "#fff8f8" }}
                                                    title="Supprimer le compte"
                                                >
                                                    {deleting === c.id
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <Trash2 className="h-3 w-3" />
                                                    }
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Assign modal */}
            <AnimatePresence>
                {assignTarget && (
                    <AssignModal
                        correcteur={assignTarget}
                        onClose={() => setAssignTarget(null)}
                        onAssigned={(count) => {
                            setAssignTarget(null);
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Confirm delete modal */}
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
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }}
                            transition={{ duration: 0.22 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto" style={{ border: "2px solid #e8eaf6" }}>
                                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#c62828" }}>
                                    <div className="flex items-center gap-2">
                                        <Trash2 className="h-4 w-4 text-white/80" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-white">Supprimer le compte</span>
                                    </div>
                                    <button onClick={() => setConfirmDelete(null)} className="text-white/60 hover:text-white">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="px-6 py-6 text-center">
                                    <div className="h-14 w-14 rounded-full flex items-center justify-center text-sm font-black text-white mx-auto mb-4" style={{ backgroundColor: "#9e9e9e" }}>
                                        {initials(confirmDelete.full_name, confirmDelete.email)}
                                    </div>
                                    <p className="font-bold text-gray-800 mb-1">{confirmDelete.full_name || confirmDelete.email}</p>
                                    <p className="text-gray-400 text-sm mb-6">
                                        Cette action est <span className="font-bold text-red-600">irréversible</span>. Le compte sera définitivement supprimé.
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
                                            onClick={() => handleDelete(confirmDelete.id)}
                                            disabled={deleting === confirmDelete.id}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
                                            style={{ backgroundColor: "#c62828", boxShadow: "0 6px 16px rgba(198,40,40,0.25)" }}
                                        >
                                            {deleting === confirmDelete.id ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Supprimer"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Create modal */}
            <AnimatePresence>
                {showCreate && (
                    <CreateModal
                        onClose={() => setShowCreate(false)}
                        onCreated={(c) => {
                            setCorrecteurs(prev => [c, ...prev]);
                            setShowCreate(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
