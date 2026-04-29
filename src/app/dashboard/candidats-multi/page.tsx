"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
    Loader2,
    CalendarDays,
    Mail,
    Layers,
    CheckCircle2,
    Clock,
    XCircle,
    Monitor,
    MapPin,
    Search,
    ChevronRight,
    AlertTriangle,
    Hash,
    Users,
    Hourglass,
    Folder,
    FolderRoot,
} from "lucide-react";

import {
    fetchMultiCandidatures,
    fetchSessions,
    type MultiCandidatureEntry,
    type MultiCandidatureDossier,
    type Session,
} from "@/lib/api";

// ── Helpers ────────────────────────────────────────────────────────────────

function validationState(dossier: MultiCandidatureDossier): "all_valid" | "has_issue" | "pending" {
    const entries = Object.values(dossier.documents_validation || {});
    if (entries.length === 0) return "pending";
    if (entries.some(e => e.resubmit_requested)) return "has_issue";
    if (entries.every(e => e.valid === true)) return "all_valid";
    return "pending";
}

function certColor(cert: string) {
    if (cert.includes("17025")) return "#1a237e";
    if (cert.includes("9001")) return "#2e7d32";
    if (cert.includes("45001")) return "#7b1fa2";
    return "#b45309";
}

// ── Sub-folder: card identique à /dashboard/candidatures ──────────────────

function DossierSubFolder({
    dossier,
}: {
    dossier: MultiCandidatureDossier;
    isLast: boolean;
}) {
    const status = (dossier.status || "pending") as "pending" | "approved" | "rejected";
    const docState = validationState(dossier);
    const color = certColor(dossier.certification || "");
    const certLabel = dossier.certification || "Certification inconnue";

    return (
        <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <Link
                href={`/dashboard/candidatures/${dossier._id}?from=multi`}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
            >
                {/* Avatar avec initiales (même pattern que mode=onsite) */}
                <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                    style={{ backgroundColor: color }}
                >
                    {certLabel.substring(0, 2).toUpperCase()}
                </div>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 truncate">
                            {certLabel}
                        </span>
                        {dossier.public_id && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                                {dossier.public_id}
                            </span>
                        )}
                        {docState === "all_valid" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                                <CheckCircle2 className="h-3 w-3" /> Docs OK
                            </span>
                        )}
                        {docState === "has_issue" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                <AlertTriangle className="h-3 w-3" /> Relance
                            </span>
                        )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                        {dossier.exam_mode === "online" && (
                            <span className="inline-flex items-center gap-1">
                                <Monitor className="h-3 w-3" /> En ligne
                            </span>
                        )}
                        {dossier.exam_mode === "onsite" && (
                            <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> Présentiel
                            </span>
                        )}
                        {dossier.submitted_at && (
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(dossier.submitted_at).toLocaleDateString("fr-FR")}
                            </span>
                        )}
                    </div>
                </div>

                {/* Statut */}
                {status === "approved" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}>
                        <CheckCircle2 className="h-3.5 w-3.5" /> Validée
                    </span>
                )}
                {status === "rejected" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}>
                        <XCircle className="h-3.5 w-3.5" /> Rejetée
                    </span>
                )}
                {status === "pending" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: "#fff8e1", color: "#b26a00", border: "1px solid #ffe0b2" }}>
                        <Hourglass className="h-3.5 w-3.5" /> En attente
                    </span>
                )}
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
            </Link>
        </motion.div>
    );
}

// ── Root folder: one candidate with all their dossiers ─────────────────────

function CandidateRootFolder({ entry }: { entry: MultiCandidatureEntry }) {
    const [open, setOpen] = useState(true);
    const publicId = entry.dossiers[0]?.public_id;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
            {/* Root folder header */}
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full px-5 py-4 flex items-center gap-4 flex-wrap text-left transition-colors hover:bg-gray-50"
                style={{ borderBottom: open ? "2px solid #e8eaf6" : "none" }}
            >
                <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0"
                    style={{ backgroundColor: "#1a237e" }}
                >
                    {(entry.name || entry.email || "?").substring(0, 2).toUpperCase()}
                </div>

                <FolderRoot
                    className="h-5 w-5 shrink-0 transition-colors"
                    style={{ color: open ? "#1a237e" : "#9ca3af" }}
                />

                <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-800 truncate">{entry.name || "—"}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" /> {entry.email}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {publicId && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-lg bg-gray-100 text-gray-600">
                            <Hash className="h-3 w-3" /> {publicId}
                        </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                        <CalendarDays className="h-3 w-3" /> {entry.session_name}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                        <Layers className="h-3 w-3" /> {entry.candidatures_count} formations
                    </span>
                </div>

                <ChevronRight
                    className="h-4 w-4 shrink-0 text-gray-400 transition-transform ml-auto"
                    style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                />
            </button>

            {/* Sub-folders */}
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 pt-4 pb-5 space-y-2 relative">
                            {/* Vertical trunk line */}
                            <div
                                className="absolute left-9 top-4 bottom-5 w-px bg-gray-200"
                                style={{ pointerEvents: "none" }}
                            />
                            {entry.dossiers.map((d, idx) => (
                                <DossierSubFolder
                                    key={d._id}
                                    dossier={d}
                                    isLast={idx === entry.dossiers.length - 1}
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function CandidatsMultiPage() {
    const [entries, setEntries] = useState<MultiCandidatureEntry[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchSessions().then(list => {
            setSessions(list);
            const active = list.find(s => s.status === "active") || list[0];
            if (active) setSelectedSession(active._id);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        setLoading(true);
        setError(null);
        fetchMultiCandidatures(selectedSession || undefined)
            .then(setEntries)
            .catch(() => setError("Impossible de charger les données."))
            .finally(() => setLoading(false));
    }, [selectedSession]);

    const filtered = useMemo(() => {
        if (!search.trim()) return entries;
        const q = search.toLowerCase();
        return entries.filter(e =>
            e.email?.toLowerCase().includes(q) ||
            e.name?.toLowerCase().includes(q) ||
            e.session_name?.toLowerCase().includes(q) ||
            e.dossiers.some(d => d.certification?.toLowerCase().includes(q))
        );
    }, [entries, search]);

    return (
        <div className="space-y-6">
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                    Administration
                </p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                    Candidats multi-formations
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Candidats ayant postulé à plusieurs certifications dans la même session.
                    Déployez le dossier racine pour consulter les sous-dossiers de chaque formation.
                </p>
            </header>

            {/* Filtres */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2 min-w-[200px] flex-1">
                    <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                    <select
                        value={selectedSession}
                        onChange={e => setSelectedSession(e.target.value)}
                        className="flex-1 bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#2e7d32]"
                    >
                        <option value="">Toutes les sessions</option>
                        {sessions.map(s => (
                            <option key={s._id} value={s._id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                    <Search className="h-4 w-4 shrink-0 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Nom, email ou certification…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#2e7d32]"
                    />
                </div>

                {!loading && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                        style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                        <Users className="h-3 w-3" />
                        {filtered.length} candidat{filtered.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-700 text-sm">
                    {error}
                </div>
            ) : filtered.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center"
                >
                    <div className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                        style={{ backgroundColor: "#e8eaf6" }}>
                        <Layers className="h-7 w-7" style={{ color: "#1a237e" }} />
                    </div>
                    <p className="font-bold text-gray-700">Aucun candidat multi-formations</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Aucun candidat n&apos;a postulé à plus d&apos;une certification dans la même session.
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    {filtered.map((entry, i) => (
                        <CandidateRootFolder
                            key={`${entry.email}-${entry.session_id}-${i}`}
                            entry={entry}
                        />
                    ))}
                </div>
            )}

        </div>
    );
}
