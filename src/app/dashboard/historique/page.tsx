"use client";

import { useEffect, useState, useCallback } from "react";
import {
    History,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Filter,
    X,
    User,
    CalendarDays,
    FileText,
    CheckCircle2,
    XCircle,
    Clock,
    Tag,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
    fetchAuditLogs,
    fetchAuditActionTypes,
    getCachedActionTypes,
    setCachedActionTypes,
    AuditLog,
    AuditLogsFilters,
} from "@/lib/api";

// ─────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────

// Only decision/validation actions are shown by default
const DEFAULT_ACTIONS = [
    "response_status_updated",
    "response_deleted",
    "final_evaluation_submitted",
    "documents_validation_updated",
].join(",");

const ACTION_COLORS: Record<string, { bg: string; text: string; dot: string; icon: React.ElementType }> = {
    response_status_updated:      { bg: "#fff3e0", text: "#e65100", dot: "#e65100", icon: Clock },
    response_deleted:             { bg: "#fce4ec", text: "#c62828", dot: "#c62828", icon: XCircle },
    final_evaluation_submitted:   { bg: "#f3e5f5", text: "#6a1b9a", dot: "#6a1b9a", icon: CheckCircle2 },
    documents_validation_updated: { bg: "#e8f5e9", text: "#2e7d32", dot: "#2e7d32", icon: CheckCircle2 },
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
    approved:  { label: "Approuvé",  color: "#2e7d32", bg: "#e8f5e9" },
    rejected:  { label: "Rejeté",    color: "#c62828", bg: "#fce4ec" },
    pending:   { label: "En attente", color: "#e65100", bg: "#fff3e0" },
    evaluated: { label: "Évalué",    color: "#6a1b9a", bg: "#f3e5f5" },
};

const ROLE_LABELS: Record<string, string> = {
    RH: "Admin RH",
    EVALUATEUR: "Évaluateur",
    CORRECTEUR: "Correcteur",
};

// ─────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────

function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit", month: "2-digit", year: "numeric",
            hour: "2-digit", minute: "2-digit", second: "2-digit",
        }).format(new Date(iso));
    } catch { return iso; }
}

function ActionBadge({ action, label }: { action: string; label: string }) {
    const style = ACTION_COLORS[action] || { bg: "#f5f5f5", text: "#555", dot: "#9e9e9e", icon: Clock };
    const Icon = style.icon;
    return (
        <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
            style={{ backgroundColor: style.bg, color: style.text }}
        >
            <Icon className="h-3 w-3 shrink-0" />
            {label}
        </span>
    );
}

function StatusPill({ status }: { status: string }) {
    const s = STATUS_LABELS[status];
    if (!s) return <span className="text-xs text-gray-400 italic">{status}</span>;
    return (
        <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ backgroundColor: s.bg, color: s.color }}
        >
            {status === "approved" && <CheckCircle2 className="h-3 w-3" />}
            {status === "rejected" && <XCircle className="h-3 w-3" />}
            {status === "pending" && <Clock className="h-3 w-3" />}
            {s.label}
        </span>
    );
}

// ─────────────────────────────────────────────────
// Detail Modal
// ─────────────────────────────────────────────────

function DetailModal({ log, onClose }: { log: AuditLog; onClose: () => void }) {
    const actionStyle = ACTION_COLORS[log.action] || { bg: "#f5f5f5", text: "#555", dot: "#9e9e9e", icon: Clock };
    const detailRows: { key: string; value: React.ReactNode }[] = [];
    const d = log.details || {};

    if (d.new_status) detailRows.push({ key: "Nouveau statut", value: <StatusPill status={String(d.new_status)} /> });
    if (d.reason) detailRows.push({ key: "Motif de rejet", value: <span className="text-gray-700 text-sm">{String(d.reason)}</span> });
    if (d.final_grade) detailRows.push({ key: "Note finale", value: <span className="font-bold" style={{ color: "#6a1b9a" }}>{String(d.final_grade)}</span> });
    if (d.final_appreciation) detailRows.push({ key: "Appréciation", value: <span className="text-gray-700 text-sm">{String(d.final_appreciation)}</span> });
    if (d.name) detailRows.push({ key: "Candidat", value: <span className="font-semibold text-gray-800">{String(d.name)}</span> });
    if (d.certification) detailRows.push({ key: "Certification", value: <span className="text-gray-700 text-sm">{String(d.certification)}</span> });

    return (
        <AnimatePresence>
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
                    initial={{ opacity: 0, scale: 0.94, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94, y: 16 }}
                    transition={{ duration: 0.22 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden pointer-events-auto"
                        style={{ border: "2px solid #e8eaf6" }}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                            <div className="flex items-center gap-2 min-w-0">
                                <History className="h-4 w-4 text-white/80 shrink-0" />
                                <span className="text-sm font-bold uppercase tracking-widest text-white truncate">
                                    Détails de l&apos;action
                                </span>
                            </div>
                            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors shrink-0 ml-3">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Séparateur losange */}
                        <div className="flex items-center gap-3 px-6 pt-5">
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: "#1a237e" }} />
                            <div className="flex-1 h-px bg-gray-100" />
                        </div>

                        <div className="px-6 py-5 space-y-5">
                            {/* Action + date */}
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <ActionBadge action={log.action} label={log.action_label} />
                                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                    {formatDate(log.timestamp)}
                                </div>
                            </div>

                            {/* Dossier concerné */}
                            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#f4f6f9" }}>
                                <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: actionStyle.bg }}>
                                    <FileText className="h-4 w-4" style={{ color: actionStyle.text }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs text-gray-400 font-medium">
                                        {log.resource_type === "response" ? "Candidature" : "Session"}
                                    </p>
                                    <p className="text-sm font-black truncate" style={{ color: "#1a237e" }}>
                                        {log.resource_label}
                                    </p>
                                </div>
                            </div>

                            {/* Auteur */}
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                                    Action effectuée par
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0" style={{ backgroundColor: "#2e7d32" }}>
                                        {log.user_name?.substring(0, 2).toUpperCase() || "?"}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{log.user_name}</p>
                                        <p className="text-xs text-gray-400 truncate">{log.user_email}</p>
                                    </div>
                                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                        {ROLE_LABELS[log.user_role] || log.user_role}
                                    </span>
                                </div>
                            </div>

                            {/* Détails décision */}
                            {detailRows.length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
                                        Détails de la décision
                                    </p>
                                    <div className="space-y-2">
                                        {detailRows.map(({ key, value }) => (
                                            <div key={key} className="flex items-start justify-between gap-3 py-2 border-b last:border-b-0" style={{ borderColor: "#f0f0f0" }}>
                                                <span className="text-xs font-semibold text-gray-400 shrink-0">{key}</span>
                                                <span className="text-right">{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Séparateur */}
                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: "#c62828" }} />
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                                style={{ borderColor: "#e0e0e0", color: "#555" }}
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </motion.div>
            </>
        </AnimatePresence>
    );
}

// ─────────────────────────────────────────────────
// Filter Modal
// ─────────────────────────────────────────────────

interface FilterModalProps {
    open: boolean;
    onClose: () => void;
    actionTypes: { value: string; label: string }[];
    fAction: string; setFAction: (v: string) => void;
    fUser: string; setFUser: (v: string) => void;
    fDateFrom: string; setFDateFrom: (v: string) => void;
    fDateTo: string; setFDateTo: (v: string) => void;
    hasActiveFilters: boolean;
    onApply: () => void;
    onClear: () => void;
}

function FilterModal({
    open, onClose,
    actionTypes,
    fAction, setFAction,
    fUser, setFUser,
    fDateFrom, setFDateFrom,
    fDateTo, setFDateTo,
    hasActiveFilters,
    onApply, onClear,
}: FilterModalProps) {
    return (
        <AnimatePresence>
            {open && (
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
                        initial={{ opacity: 0, scale: 0.94, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: 16 }}
                        transition={{ duration: 0.22 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto"
                            style={{ border: "2px solid #e8eaf6" }}
                        >
                            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                                <div className="flex items-center gap-2">
                                    <Filter className="h-4 w-4 text-white/80" />
                                    <span className="text-sm font-bold uppercase tracking-widest text-white">Filtres</span>
                                </div>
                                <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 px-6 pt-5">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: "#1a237e" }} />
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            <div className="px-6 pb-6 pt-4 space-y-4">
                                {/* Type d'action */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                        <Tag className="h-3.5 w-3.5" /> Type de décision
                                    </label>
                                    <select
                                        value={fAction}
                                        onChange={e => setFAction(e.target.value)}
                                        className="w-full text-sm rounded-xl px-3 py-2.5 border outline-none transition-all"
                                        style={{ borderColor: "#e0e0e0" }}
                                    >
                                        <option value="">Toutes les décisions</option>
                                        {actionTypes.map(a => (
                                            <option key={a.value} value={a.value}>{a.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Utilisateur */}
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                        <User className="h-3.5 w-3.5" /> Administrateur (email)
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Rechercher par email…"
                                            value={fUser}
                                            onChange={e => setFUser(e.target.value)}
                                            className="w-full text-sm rounded-xl pl-8 pr-3 py-2.5 border outline-none transition-all"
                                            style={{ borderColor: "#e0e0e0" }}
                                        />
                                    </div>
                                </div>

                                {/* Plage de dates */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                            <CalendarDays className="h-3.5 w-3.5" /> Date début
                                        </label>
                                        <input
                                            type="date"
                                            value={fDateFrom}
                                            onChange={e => setFDateFrom(e.target.value)}
                                            className="w-full text-sm rounded-xl px-3 py-2.5 border outline-none transition-all"
                                            style={{ borderColor: "#e0e0e0" }}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                                            <CalendarDays className="h-3.5 w-3.5" /> Date fin
                                        </label>
                                        <input
                                            type="date"
                                            value={fDateTo}
                                            onChange={e => setFDateTo(e.target.value)}
                                            className="w-full text-sm rounded-xl px-3 py-2.5 border outline-none transition-all"
                                            style={{ borderColor: "#e0e0e0" }}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 pt-1">
                                    <div className="flex-1 h-px bg-gray-100" />
                                    <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: "#c62828" }} />
                                    <div className="flex-1 h-px bg-gray-100" />
                                </div>

                                <div className="flex gap-3 pt-1">
                                    {hasActiveFilters && (
                                        <button
                                            onClick={() => { onClear(); onClose(); }}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                                            style={{ borderColor: "#e0e0e0", color: "#555" }}
                                        >
                                            Réinitialiser
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { onApply(); onClose(); }}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                        style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                                    >
                                        Appliquer
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

// ─────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function HistoriquePage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [total, setTotal] = useState(0);
    const [pages, setPages] = useState(1);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [actionTypes, setActionTypes] = useState<{ value: string; label: string }[]>([]);
    const [showFilterModal, setShowFilterModal] = useState(false);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    const [filters, setFilters] = useState<AuditLogsFilters>({
        page: 1,
        limit: PAGE_SIZE,
        actions: DEFAULT_ACTIONS,
    });

    // Filter form state
    const [fAction, setFAction] = useState("");
    const [fUser, setFUser] = useState("");
    const [fDateFrom, setFDateFrom] = useState("");
    const [fDateTo, setFDateTo] = useState("");

    const load = useCallback(async (f: AuditLogsFilters) => {
        setLoading(true);
        try {
            const data = await fetchAuditLogs(f);
            setLogs(data.logs);
            setTotal(data.total);
            setPages(data.pages);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Load action types from cache instantly, refresh in background
        const cached = getCachedActionTypes();
        if (cached) setActionTypes(cached.filter(t => DEFAULT_ACTIONS.includes(t.value)));

        fetchAuditActionTypes()
            .then(types => {
                const filtered = types.filter((t: { value: string; label: string }) => DEFAULT_ACTIONS.includes(t.value));
                setActionTypes(filtered);
                setCachedActionTypes(types);
            })
            .catch(console.error);
    }, []);

    useEffect(() => {
        load(filters);
    }, [filters, load]);

    function applyFilters() {
        const f: AuditLogsFilters = { page: 1, limit: PAGE_SIZE };
        if (fAction) f.action = fAction;
        else f.actions = DEFAULT_ACTIONS;
        if (fUser) f.user_email = fUser;
        if (fDateFrom) f.date_from = fDateFrom;
        if (fDateTo) f.date_to = fDateTo;
        setPage(1);
        setFilters(f);
    }

    function clearFilters() {
        setFAction(""); setFUser(""); setFDateFrom(""); setFDateTo("");
        setPage(1);
        setFilters({ page: 1, limit: PAGE_SIZE, actions: DEFAULT_ACTIONS });
    }

    function goToPage(p: number) {
        setPage(p);
        setFilters(f => ({ ...f, page: p }));
    }

    const hasActiveFilters = !!(fAction || fUser || fDateFrom || fDateTo);

    return (
        <div className="space-y-6">
            {/* Detail Modal */}
            {selectedLog && (
                <DetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
            )}

            {/* Filter Modal */}
            <FilterModal
                open={showFilterModal}
                onClose={() => setShowFilterModal(false)}
                actionTypes={actionTypes}
                fAction={fAction} setFAction={setFAction}
                fUser={fUser} setFUser={setFUser}
                fDateFrom={fDateFrom} setFDateFrom={setFDateFrom}
                fDateTo={fDateTo} setFDateTo={setFDateTo}
                hasActiveFilters={hasActiveFilters}
                onApply={applyFilters}
                onClear={clearFilters}
            />

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                        Historiques des actions
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        Validations et rejets effectués par les administrateurs
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => load(filters)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold border transition-all hover:-translate-y-0.5"
                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Actualiser
                    </button>
                    <button
                        onClick={() => setShowFilterModal(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                        style={{
                            backgroundColor: hasActiveFilters ? "#1a237e" : "#e8eaf6",
                            color: hasActiveFilters ? "#fff" : "#1a237e",
                        }}
                    >
                        <Filter className="h-4 w-4" />
                        Filtres
                        {hasActiveFilters && (
                            <span
                                className="ml-1 w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center"
                                style={{ backgroundColor: "#c62828", color: "#fff" }}
                            >
                                !
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── Stats bar ─── */}
            <div
                className="flex items-center gap-4 px-5 py-3 rounded-2xl text-sm"
                style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}
            >
                <History className="h-4 w-4 shrink-0" />
                <span className="font-semibold">
                    {loading ? "Chargement…" : `${total} décision${total !== 1 ? "s" : ""} enregistrée${total !== 1 ? "s" : ""}`}
                </span>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="ml-auto flex items-center gap-1.5 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
                    >
                        <X className="h-3 w-3" /> Effacer les filtres
                    </button>
                )}
            </div>

            {/* ─── Log list ─── */}
            <div className="space-y-2">
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ backgroundColor: "#f0f0f0" }} />
                    ))
                ) : logs.length === 0 ? (
                    <div
                        className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
                        style={{ backgroundColor: "#f4f6f9" }}
                    >
                        <History className="h-12 w-12 mb-3 opacity-20" style={{ color: "#1a237e" }} />
                        <p className="text-gray-500 font-semibold">Aucune décision enregistrée</p>
                        <p className="text-gray-400 text-sm mt-1">Les validations et rejets effectués apparaîtront ici</p>
                    </div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {logs.map((log, idx) => {
                            const d = log.details || {};
                            return (
                                <motion.button
                                    key={log._id}
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.02 }}
                                    onClick={() => setSelectedLog(log)}
                                    className="w-full text-left bg-white rounded-2xl px-5 py-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
                                    style={{ border: "1.5px solid #f0f0f0" }}
                                >
                                    <div className="flex flex-wrap items-start gap-3">
                                        {/* Action badge */}
                                        <ActionBadge action={log.action} label={log.action_label} />

                                        {/* Status pill if present */}
                                        {!!d.new_status && (
                                            <StatusPill status={String(d.new_status)} />
                                        )}

                                        {/* Dossier */}
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <FileText className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                                            <span className="font-bold" style={{ color: "#1a237e" }}>
                                                {log.resource_label}
                                            </span>
                                        </div>

                                        {/* Timestamp */}
                                        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 whitespace-nowrap">
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                                            {formatDate(log.timestamp)}
                                        </div>
                                    </div>

                                    {/* User + hint */}
                                    <div className="flex items-center gap-2 mt-2">
                                        <div
                                            className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                                            style={{ backgroundColor: "#2e7d32" }}
                                        >
                                            {log.user_name?.substring(0, 2).toUpperCase() || "?"}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700">{log.user_name}</span>
                                        <span className="text-xs text-gray-400 hidden sm:inline">{log.user_email}</span>
                                        <span
                                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                            style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}
                                        >
                                            {ROLE_LABELS[log.user_role] || log.user_role}
                                        </span>
                                        <span className="ml-auto text-[10px] text-gray-300 font-medium hidden sm:block">
                                            Cliquer pour les détails →
                                        </span>
                                    </div>
                                </motion.button>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>

            {/* ─── Pagination ─── */}
            {pages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        onClick={() => goToPage(Math.max(1, page - 1))}
                        disabled={page === 1}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40"
                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                    >
                        <ChevronLeft className="h-4 w-4" /> Précédent
                    </button>

                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                            let p: number;
                            if (pages <= 7) p = i + 1;
                            else if (page <= 4) p = i + 1;
                            else if (page >= pages - 3) p = pages - 6 + i;
                            else p = page - 3 + i;
                            return (
                                <button
                                    key={p}
                                    onClick={() => goToPage(p)}
                                    className="w-9 h-9 rounded-xl text-sm font-bold transition-all"
                                    style={{
                                        backgroundColor: p === page ? "#1a237e" : "transparent",
                                        color: p === page ? "#fff" : "#555",
                                    }}
                                >
                                    {p}
                                </button>
                            );
                        })}
                    </div>

                    <button
                        onClick={() => goToPage(Math.min(pages, page + 1))}
                        disabled={page === pages}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-semibold border transition-all disabled:opacity-40"
                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                    >
                        Suivant <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            )}
        </div>
    );
}
