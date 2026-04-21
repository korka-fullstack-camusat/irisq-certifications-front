"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
    CalendarDays,
    Loader2,
    ChevronRight,
    ChevronDown,
    Download,
    Monitor,
    MapPin,
    Mail,
    Clock,
    CheckCircle2,
    XCircle,
    Hourglass,
    AlertTriangle,
    Search,
    SlidersHorizontal,
} from "lucide-react";
import { motion } from "framer-motion";

import {
    fetchSessions,
    fetchSessionResponses,
    downloadSessionDossiersZip,
    type Session,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";

interface CandidatureRow {
    _id: string;
    public_id?: string;
    name?: string;
    email?: string;
    status?: string;
    submitted_at?: string;
    exam_mode?: string;
    exam_type?: string;
    answers?: Record<string, any>;
    documents_validation?: Record<string, { valid?: boolean; resubmit_requested?: boolean }>;
}

type ModeTab = "online" | "onsite";
type ExamTypeTab = "all" | "direct" | "after_formation";

function getExamMode(r: CandidatureRow): "online" | "onsite" | "" {
    const raw = (r.exam_mode || "").toString().toLowerCase().trim();
    if (raw === "online" || raw === "onsite") return raw;
    const fromAnswers = (r.answers?.["Mode d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("ligne")) return "online";
    if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
    return "";
}

function getExamType(r: CandidatureRow): "direct" | "after_formation" | "" {
    const raw = (r.exam_type as string | undefined || "").toString().toLowerCase().trim();
    if (raw === "direct") return "direct";
    if (raw === "after_formation") return "after_formation";
    const fromAnswers = (r.answers?.["Type d'examen"] || "").toString().toLowerCase().trim();
    if (fromAnswers.includes("direct")) return "direct";
    if (fromAnswers.includes("formation")) return "after_formation";
    return "";
}

function validationState(row: CandidatureRow): "all_valid" | "has_issue" | "pending" {
    const v = row.documents_validation || {};
    const entries = Object.values(v);
    if (entries.length === 0) return "pending";
    if (entries.some(e => e.resubmit_requested)) return "has_issue";
    if (entries.every(e => e.valid === true)) return "all_valid";
    return "pending";
}

const examTypeLabels: Record<ExamTypeTab, string> = {
    all: "Tous",
    direct: "Examen direct",
    after_formation: "Après formation IRISQ",
};

function CandidaturesInner() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const modeParam = searchParams.get("mode");
    const modeTab: ModeTab = modeParam === "onsite" ? "onsite" : "online";

    const [sessions, setSessions] = useState<Session[]>([]);
    const [selectedId, setSelectedId] = useState<string>("");
    const [rows, setRows] = useState<CandidatureRow[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingRows, setLoadingRows] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [examTypeTab, setExamTypeTab] = useState<ExamTypeTab>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [examTypeOpen, setExamTypeOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) router.replace("/dashboard");
    }, [isLoading, user, router]);

    useEffect(() => {
        (async () => {
            try {
                setLoadingSessions(true);
                const list = await fetchSessions();
                setSessions(list);
                const firstActive = list.find(s => s.status === "active") || list[0];
                if (firstActive) setSelectedId(firstActive._id);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoadingSessions(false);
            }
        })();
    }, []);

    useEffect(() => {
        if (!selectedId) { setRows([]); return; }
        (async () => {
            try {
                setLoadingRows(true);
                setRows(await fetchSessionResponses(selectedId));
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoadingRows(false);
            }
        })();
    }, [selectedId]);

    // Reset filters when switching between En ligne / Présentiel
    useEffect(() => {
        setExamTypeTab("all");
        setSearchQuery("");
        setExamTypeOpen(false);
    }, [modeTab]);

    // Close dropdown on outside click
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(e.target as Node)) setExamTypeOpen(false);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const selectedSession = useMemo(() => sessions.find(s => s._id === selectedId) || null, [sessions, selectedId]);

    const filteredCandidates = useMemo(() => {
        let list = rows.filter(r => getExamMode(r) === modeTab);
        if (examTypeTab !== "all") list = list.filter(r => getExamType(r) === examTypeTab);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(r =>
                (r.name || "").toLowerCase().includes(q) ||
                (r.email || "").toLowerCase().includes(q) ||
                (r.public_id || "").toLowerCase().includes(q)
            );
        }
        return list;
    }, [rows, modeTab, examTypeTab, searchQuery]);

    async function handleExport() {
        if (!selectedId || exporting) return;
        try {
            setExporting(true);
            await downloadSessionDossiersZip(selectedId, selectedSession?.name);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de l'export");
        } finally {
            setExporting(false);
        }
    }

    if (isLoading || !user) return null;

    const isOnline = modeTab === "online";
    const modeColor = isOnline ? "#1a237e" : "#2e7d32";
    const ModeIcon = isOnline ? Monitor : MapPin;
    const modeLabel = isOnline ? "Candidature en ligne" : "Candidature présentiel";

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-black flex items-center gap-2" style={{ color: "#1a237e" }}>
                        <ModeIcon className="h-6 w-6" style={{ color: modeColor }} />
                        {modeLabel}
                    </h1>
                    <p className="text-sm mt-1" style={{ color: modeColor }}>
                        {isOnline ? "Examens à distance" : "Examens sur site"}
                    </p>
                </div>
                {selectedId && (
                    <button
                        onClick={handleExport}
                        disabled={exporting || rows.length === 0}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {exporting ? "Préparation…" : "Exporter (ZIP)"}
                    </button>
                )}
            </div>

            {/* Session picker */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                {loadingSessions ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Chargement des sessions…
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="text-sm text-gray-500">
                        Aucune session.{" "}
                        <Link href="/dashboard/sessions" className="font-bold text-indigo-600 hover:underline">Créer une session</Link>
                    </div>
                ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> Session
                        </label>
                        <select
                            value={selectedId}
                            onChange={e => setSelectedId(e.target.value)}
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 min-w-[240px]"
                        >
                            {sessions.map(s => (
                                <option key={s._id} value={s._id}>
                                    {s.name} {s.status === "active" ? "• active" : "• fermée"}
                                </option>
                            ))}
                        </select>
                        {selectedSession && (
                            <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
                                style={{
                                    backgroundColor: selectedSession.status === "active" ? "#e8f5e9" : "#ffebee",
                                    color: selectedSession.status === "active" ? "#2e7d32" : "#c62828",
                                }}
                            >
                                {selectedSession.status}
                            </span>
                        )}
                        <span className="text-xs text-gray-400 ml-auto">
                            {filteredCandidates.length} dossier{filteredCandidates.length > 1 ? "s" : ""}
                        </span>
                    </div>
                )}
            </div>

            {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>}

            {loadingRows ? (
                <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                </div>
            ) : !selectedId ? null : (
                <div className="space-y-4">
                    {/* Barre de recherche + filtre */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Rechercher par nom, email ou ID…"
                                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                            />
                        </div>
                        <div className="relative shrink-0" ref={filterRef}>
                            <button
                                onClick={() => setExamTypeOpen(v => !v)}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all whitespace-nowrap"
                                style={{
                                    backgroundColor: examTypeTab !== "all" ? "#1a237e" : "#ffffff",
                                    color: examTypeTab !== "all" ? "#ffffff" : "#555",
                                    borderColor: examTypeTab !== "all" ? "#1a237e" : "#e0e0e0",
                                }}
                            >
                                <SlidersHorizontal className="h-4 w-4" />
                                {examTypeLabels[examTypeTab]}
                                <ChevronDown
                                    className="h-3.5 w-3.5"
                                    style={{ transform: examTypeOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                                />
                            </button>
                            {examTypeOpen && (
                                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden py-1">
                                    {(["all", "direct", "after_formation"] as ExamTypeTab[]).map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => { setExamTypeTab(tab); setExamTypeOpen(false); }}
                                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors hover:bg-gray-50"
                                            style={{ color: examTypeTab === tab ? "#1a237e" : "#555", fontWeight: examTypeTab === tab ? 700 : 500 }}
                                        >
                                            <span
                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                style={{ backgroundColor: examTypeTab === tab ? "#1a237e" : "transparent", border: examTypeTab === tab ? "none" : "1.5px solid #ccc" }}
                                            />
                                            {examTypeLabels[tab]}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Liste candidats */}
                    {filteredCandidates.length === 0 ? (
                        <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                            <ModeIcon className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                            <p className="text-gray-500 text-sm">
                                Aucun candidat {isOnline ? "en ligne" : "en présentiel"} pour cette session.
                            </p>
                        </div>
                    ) : (
                        <div className="grid gap-3">
                            {filteredCandidates.map((r, i) => {
                                const status = (r.status || "pending") as "pending" | "approved" | "rejected";
                                const docState = validationState(r);
                                const formation = r.answers?.["Certification souhaitée"] || "—";
                                return (
                                    <motion.div
                                        key={r._id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                    >
                                        <Link
                                            href={`/dashboard/candidatures/${r._id}?from=${modeTab}`}
                                            className="group flex items-center gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
                                        >
                                            <div
                                                className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-black"
                                                style={{ backgroundColor: modeColor }}
                                            >
                                                {(r.name || "?").substring(0, 2).toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-bold text-gray-800 truncate">{r.name || "Candidat"}</span>
                                                    {r.public_id && (
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-100 text-gray-500">{r.public_id}</span>
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
                                                    <span className="truncate max-w-[180px] font-medium text-gray-600">{formation}</span>
                                                    {r.email && (
                                                        <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" /> {r.email}</span>
                                                    )}
                                                    {r.submitted_at && (
                                                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(r.submitted_at).toLocaleDateString("fr-FR")}</span>
                                                    )}
                                                </div>
                                            </div>
                                            {status === "approved" && (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}>
                                                    <CheckCircle2 className="h-3.5 w-3.5" /> Validée
                                                </span>
                                            )}
                                            {status === "rejected" && (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}>
                                                    <XCircle className="h-3.5 w-3.5" /> Rejetée
                                                </span>
                                            )}
                                            {status === "pending" && (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full shrink-0" style={{ backgroundColor: "#fff8e1", color: "#b26a00", border: "1px solid #ffe0b2" }}>
                                                    <Hourglass className="h-3.5 w-3.5" /> En attente
                                                </span>
                                            )}
                                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                                        </Link>
                                    </motion.div>
                                );
                            })}
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
