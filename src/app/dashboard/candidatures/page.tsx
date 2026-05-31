"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
    FolderRoot,
    Globe,
    Download,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import {
    fetchMultiCandidatures,
    fetchSessions,
    downloadSessionDossiersZip,
    type MultiCandidatureEntry,
    type MultiCandidatureDossier,
    type Session,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Pagination } from "@/components/Pagination";

// ── Types ──────────────────────────────────────────────────────────────────

type ModeTab = "all" | "online" | "onsite";

// ── Helpers ────────────────────────────────────────────────────────────────

function getDossierMode(d: MultiCandidatureDossier): "online" | "onsite" | "" {
    const raw = (d.exam_mode || "").toLowerCase().trim();
    if (raw === "online" || raw === "onsite") return raw;
    const fromAnswers = ((d.answers?.["Mode d'examen"] as string | undefined) || "").toLowerCase();
    if (fromAnswers.includes("ligne")) return "online";
    if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
    return "";
}

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

function entryMatchesMode(entry: MultiCandidatureEntry, mode: ModeTab): boolean {
    if (mode === "all") return true;
    return entry.dossiers.some(d => getDossierMode(d) === mode);
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
    if (status === "approved") return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Validée
        </span>
    );
    if (status === "rejected") return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}>
            <XCircle className="h-3.5 w-3.5" /> Rejetée
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "#fff8e1", color: "#b26a00", border: "1px solid #ffe0b2" }}>
            <Hourglass className="h-3.5 w-3.5" /> En attente
        </span>
    );
}

// ── Dossier sub-row (inside a multi-folder) ────────────────────────────────

function DossierSubRow({ dossier }: { dossier: MultiCandidatureDossier }) {
    const docState = validationState(dossier);
    const color = certColor(dossier.certification || "");
    const certLabel = dossier.certification || "Certification inconnue";
    const mode = getDossierMode(dossier);

    return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Link
                href={`/dashboard/candidatures/${dossier._id}?from=candidatures`}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
            >
                <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                    style={{ backgroundColor: color }}
                >
                    {certLabel.substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 truncate">{certLabel}</span>
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
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        {!dossier.session_id ? (
                            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                <Globe className="h-3 w-3" /> Espace candidat
                            </span>
                        ) : dossier.session_name ? (
                            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                                <CalendarDays className="h-3 w-3" /> {dossier.session_name}
                            </span>
                        ) : null}
                        {mode === "online" && (
                            <span className="inline-flex items-center gap-1">
                                <Monitor className="h-3 w-3" /> En ligne
                            </span>
                        )}
                        {mode === "onsite" && (
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

                <StatusBadge status={dossier.status} />
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
            </Link>
        </motion.div>
    );
}

// ── Single dossier card (candidate with exactly 1 application) ────────────

function SingleDossierCard({ entry }: { entry: MultiCandidatureEntry }) {
    const dossier = entry.dossiers[0];
    const docState = validationState(dossier);
    const mode = getDossierMode(dossier);
    const certLabel = dossier.certification || "Certification inconnue";

    return (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Link
                href={`/dashboard/candidatures/${dossier._id}?from=candidatures`}
                className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
            >
                {/* Avatar initiales nom */}
                <div
                    className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                    style={{ backgroundColor: "#1a237e" }}
                >
                    {(entry.name || entry.email || "?").substring(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Ligne 1 : nom + ID + docs */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-800 truncate">{entry.name || "Candidat"}</span>
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

                    {/* Ligne 2 : certification + origine + mode + date */}
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                        <span className="font-medium text-gray-600 truncate max-w-[200px]">{certLabel}</span>
                        {entry.email && (
                            <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {entry.email}
                            </span>
                        )}
                        {!dossier.session_id ? (
                            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                <Globe className="h-3 w-3" /> Espace candidat
                            </span>
                        ) : dossier.session_name ? (
                            <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: "#f3f4f6", color: "#374151" }}>
                                <CalendarDays className="h-3 w-3" /> {dossier.session_name}
                            </span>
                        ) : null}
                        {mode === "online" && (
                            <span className="inline-flex items-center gap-1">
                                <Monitor className="h-3 w-3" /> En ligne
                            </span>
                        )}
                        {mode === "onsite" && (
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

                <StatusBadge status={dossier.status} />
                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
            </Link>
        </motion.div>
    );
}

// ── Multi dossier folder (candidate with 2+ applications) ─────────────────

function MultiDossierFolder({ entry }: { entry: MultiCandidatureEntry }) {
    const [open, setOpen] = useState(true);
    const publicId = entry.dossiers[0]?.public_id;

    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
        >
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
                        style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                        <Layers className="h-3 w-3" /> {entry.candidatures_count} demandes
                    </span>
                </div>

                <ChevronRight
                    className="h-4 w-4 shrink-0 text-gray-400 transition-transform ml-auto"
                    style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                />
            </button>

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
                            <div
                                className="absolute left-9 top-4 bottom-5 w-px bg-gray-200"
                                style={{ pointerEvents: "none" }}
                            />
                            {entry.dossiers.map(d => (
                                <DossierSubRow key={d._id} dossier={d} />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ── Unified card: dispatch single vs multi ─────────────────────────────────

function CandidatureCard({ entry }: { entry: MultiCandidatureEntry }) {
    if (entry.dossiers.length === 1) return <SingleDossierCard entry={entry} />;
    return <MultiDossierFolder entry={entry} />;
}

// ── Page ───────────────────────────────────────────────────────────────────

function CandidaturesInner() {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const PAGE_SIZE = 4;

    const [entries, setEntries] = useState<MultiCandidatureEntry[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedSession, setSelectedSession] = useState<string>("");
    const [search, setSearch] = useState("");
    const [modeTab, setModeTab] = useState<ModeTab>("all");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    // Charger les sessions
    useEffect(() => {
        fetchSessions()
            .then(list => {
                setSessions(list);
                const active = list.find(s => s.status === "active") || list[0];
                if (active) setSelectedSession(active._id);
            })
            .catch(() => {});
    }, []);

    // Charger toutes les candidatures (min_count=1 = tout le monde)
    useEffect(() => {
        setLoading(true);
        setError(null);
        setPage(1);
        fetchMultiCandidatures(selectedSession || undefined, 1)
            .then(setEntries)
            .catch(() => setError("Impossible de charger les données."))
            .finally(() => setLoading(false));
    }, [selectedSession]);

    // Réinitialiser la page quand les filtres changent
    useEffect(() => { setPage(1); }, [modeTab, search]);

    const filtered = useMemo(() => {
        let list = entries;
        if (modeTab !== "all") {
            list = list.filter(e => entryMatchesMode(e, modeTab));
        }
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(e =>
                (e.name || "").toLowerCase().includes(q) ||
                (e.email || "").toLowerCase().includes(q) ||
                e.dossiers.some(d => (d.certification || "").toLowerCase().includes(q))
            );
        }
        return list;
    }, [entries, modeTab, search]);

    const paged = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filtered.slice(start, start + PAGE_SIZE);
    }, [filtered, page]);

    async function handleExport() {
        if (!selectedSession || exporting) return;
        try {
            setExporting(true);
            const sess = sessions.find(s => s._id === selectedSession);
            await downloadSessionDossiersZip(selectedSession, sess?.name);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de l'export");
        } finally {
            setExporting(false);
        }
    }

    if (isLoading || !user) return null;

    // Compteurs pour les onglets mode
    const countByMode = useMemo(() => ({
        all: entries.length,
        online: entries.filter(e => entryMatchesMode(e, "online")).length,
        onsite: entries.filter(e => entryMatchesMode(e, "onsite")).length,
    }), [entries]);

    return (
        <div className="space-y-6">
            {/* ── Header ── */}
            <header className="space-y-1">
                {/* Ligne 1 : titre ← → session + export */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">
                            Administration
                        </p>
                        <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                            Revue des candidatures
                        </h1>
                    </div>

                    {/* Session + Export — même niveau que le titre */}
                    <div className="flex items-center gap-3 flex-wrap shrink-0">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                            <select
                                value={selectedSession}
                                onChange={e => setSelectedSession(e.target.value)}
                                className="bg-white border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:border-[#1a237e] min-w-[180px]"
                            >
                                <option value="">Toutes les sessions</option>
                                {sessions.map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <button
                            onClick={handleExport}
                            disabled={exporting || !selectedSession || entries.length === 0}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 12px rgba(46,125,50,0.25)" }}
                        >
                            {exporting
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Download className="h-4 w-4" />}
                            {exporting ? "Export…" : "Exporter ZIP"}
                        </button>
                    </div>
                </div>
                {/* Ligne 2 : description */}
                <p className="text-sm text-gray-500">
                    Toutes les demandes de certification — formulaire public et espace candidat.
                    Cliquez sur une demande unique pour l&apos;ouvrir, ou déployez le dossier d&apos;un candidat multi-formations.
                </p>
            </header>

            {/* ── Barre de filtres ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 flex-wrap">
                {/* Recherche */}
                <div className="flex items-center gap-2 flex-1 min-w-[180px]">
                    <Search className="h-4 w-4 shrink-0 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par nom, email ou certification…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="flex-1 min-w-0 bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none focus:border-[#1a237e]"
                    />
                </div>

                {/* Mode tabs */}
                <div className="flex items-center gap-1 shrink-0 bg-[#f4f6f9] rounded-xl p-1">
                    {([
                        { key: "all",    label: "Tous",        Icon: Users   },
                        { key: "online", label: "En ligne",    Icon: Monitor },
                        { key: "onsite", label: "Présentiel",  Icon: MapPin  },
                    ] as { key: ModeTab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            onClick={() => setModeTab(key)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                            style={{
                                backgroundColor: modeTab === key ? "#1a237e" : "transparent",
                                color: modeTab === key ? "#ffffff" : "#6b7280",
                            }}
                        >
                            <Icon className="h-3 w-3" />
                            {label}
                            {!loading && (
                                <span
                                    className="ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-black"
                                    style={{
                                        backgroundColor: modeTab === key ? "rgba(255,255,255,0.2)" : "#e5e7eb",
                                        color: modeTab === key ? "#ffffff" : "#374151",
                                    }}
                                >
                                    {countByMode[key]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Compteur résultats filtrés */}
                {!loading && (
                    <span
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold shrink-0"
                        style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}
                    >
                        <Users className="h-3 w-3" />
                        {filtered.length} candidat{filtered.length !== 1 ? "s" : ""}
                    </span>
                )}
            </div>

            {/* ── Contenu ── */}
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
                        <Users className="h-7 w-7" style={{ color: "#1a237e" }} />
                    </div>
                    <p className="font-bold text-gray-700">Aucune candidature trouvée</p>
                    <p className="text-sm text-gray-400 mt-1">
                        {search ? "Essayez un autre terme de recherche." : "Aucune demande pour cette sélection."}
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-3">
                    {paged.map((entry, i) => (
                        <CandidatureCard
                            key={`${entry.email}-${entry.session_id}-${i}`}
                            entry={entry}
                        />
                    ))}
                    {filtered.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-2">
                            <Pagination
                                total={filtered.length}
                                page={page}
                                pageSize={PAGE_SIZE}
                                onPageChange={setPage}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function CandidaturesPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>}>
            <CandidaturesInner />
        </Suspense>
    );
}
