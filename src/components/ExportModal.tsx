"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Loader2, Monitor, MapPin, Users, X } from "lucide-react";

export type ExportScope = "all" | "online" | "onsite";

const OPTIONS: {
    value: ExportScope;
    label: string;
    desc: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
}[] = [
    {
        value: "all",
        label: "Tous les candidats",
        desc: "Télécharge tous les dossiers disponibles",
        icon: Users,
        color: "#1a237e",
        bg: "#e8eaf6",
        border: "#c5cae9",
    },
    {
        value: "online",
        label: "Candidats en ligne",
        desc: "Uniquement les dossiers « examen en ligne »",
        icon: Monitor,
        color: "#1a237e",
        bg: "#e8eaf6",
        border: "#c5cae9",
    },
    {
        value: "onsite",
        label: "Candidats présentiel",
        desc: "Uniquement les dossiers « examen présentiel »",
        icon: MapPin,
        color: "#2e7d32",
        bg: "#e8f5e9",
        border: "#c8e6c9",
    },
];

interface ExportModalProps {
    open: boolean;
    title?: string;
    subtitle?: string;
    counts?: Partial<Record<ExportScope, number>>;
    onClose: () => void;
    onConfirm: (scope: ExportScope) => Promise<void> | void;
}

export function ExportModal({
    open,
    title = "Exporter les dossiers",
    subtitle = "Choisissez les candidats à inclure dans l'archive ZIP.",
    counts,
    onClose,
    onConfirm,
}: ExportModalProps) {
    const [scope, setScope] = useState<ExportScope>("all");
    const [busy, setBusy] = useState(false);

    async function handleConfirm() {
        if (busy) return;
        try {
            setBusy(true);
            await onConfirm(scope);
            onClose();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de l'export");
        } finally {
            setBusy(false);
        }
    }

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        key="ovl"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                        onClick={() => !busy && onClose()}
                    />
                    <motion.div
                        key="mdl"
                        initial={{ opacity: 0, scale: 0.94, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 16 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                            style={{ border: "2px solid #e8eaf6" }}
                        >
                            <div
                                className="px-6 py-4 flex items-center justify-between"
                                style={{ backgroundColor: "#1a237e" }}
                            >
                                <div className="flex items-center gap-2">
                                    <Download className="h-4 w-4 text-white/80" />
                                    <span className="text-sm font-bold uppercase tracking-widest text-white">
                                        {title}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => !busy && onClose()}
                                    className="text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="px-6 py-5 space-y-4">
                                <p className="text-sm text-gray-500">{subtitle}</p>
                                <div className="space-y-2">
                                    {OPTIONS.map(opt => {
                                        const Icon = opt.icon;
                                        const active = scope === opt.value;
                                        const count = counts?.[opt.value];
                                        return (
                                            <button
                                                key={opt.value}
                                                type="button"
                                                onClick={() => setScope(opt.value)}
                                                disabled={busy}
                                                className="w-full text-left p-3 rounded-xl border transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                                style={{
                                                    backgroundColor: active ? opt.bg : "#ffffff",
                                                    borderColor: active ? opt.color : "#e5e7eb",
                                                    boxShadow: active ? `0 6px 16px ${opt.color}22` : undefined,
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                                                        style={{ backgroundColor: opt.bg }}
                                                    >
                                                        <Icon className="h-4 w-4" style={{ color: opt.color }} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-gray-800 truncate">{opt.label}</p>
                                                        <p className="text-[11px] text-gray-500 truncate">{opt.desc}</p>
                                                    </div>
                                                    {typeof count === "number" && (
                                                        <span
                                                            className="text-xs font-black shrink-0"
                                                            style={{ color: opt.color }}
                                                        >
                                                            {count}
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="flex items-center gap-3 pt-2">
                                    <div className="flex-1 h-px bg-gray-100" />
                                    <span
                                        className="w-2 h-2 rotate-45"
                                        style={{ backgroundColor: "#c62828", display: "inline-block" }}
                                    />
                                    <div className="flex-1 h-px bg-gray-100" />
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => !busy && onClose()}
                                        disabled={busy}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
                                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleConfirm}
                                        disabled={busy}
                                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                        style={{
                                            backgroundColor: "#2e7d32",
                                            boxShadow: "0 6px 16px rgba(46,125,50,0.25)",
                                        }}
                                    >
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                        {busy ? "Préparation…" : "Télécharger"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
