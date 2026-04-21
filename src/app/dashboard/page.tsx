"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Monitor,
  MapPin,
  Folder,
  Users,
  Hourglass,
  XCircle,
  Download,
  ChevronRight,
} from "lucide-react";

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

const FORMATION_FIELD = "Certification souhaitée";
const UNCATEGORIZED = "Sans formation renseignée";

const PREDEFINED_FORMATIONS = [
  "Implementor ISO/IEC17025:2017",
  "Lead Implementor ISO/IEC17025:2017",
  "Junior Implementor ISO 9001:2015",
  "Implementor ISO 9001:2015",
  "Lead Implementor ISO 9001:2015",
  "Junior Implementor ISO 14001:2015",
  "Implementor ISO 14001:2015",
  "Lead Implementor ISO 14001:2015",
];

function isPending(r: CandidatureRow): boolean {
  return !r.status || r.status === "pending";
}

function getExamMode(r: CandidatureRow): "online" | "onsite" | "" {
  const raw = (r.exam_mode || "").toString().toLowerCase().trim();
  if (raw === "online" || raw === "onsite") return raw;
  const fromAnswers = (r.answers?.["Mode d'examen"] || "").toString().toLowerCase().trim();
  if (fromAnswers.includes("ligne")) return "online";
  if (fromAnswers.includes("présent") || fromAnswers.includes("present")) return "onsite";
  return "";
}

function formatRelative(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4"
    >
      <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black" style={{ color }}>{value}</p>
        <p className="text-xs font-semibold text-gray-500 truncate">{label}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardOverviewPage() {
  const { user, isLoading } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [rows, setRows] = useState<CandidatureRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const selectedSession = useMemo(
    () => sessions.find(s => s._id === selectedId) || null,
    [sessions, selectedId],
  );

  const pending = useMemo(() => rows.filter(isPending), [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pendingCount = rows.filter(r => !r.status || r.status === "pending").length;
    const approved = rows.filter(r => r.status === "approved").length;
    const rejected = rows.filter(r => r.status === "rejected").length;
    const online = rows.filter(r => getExamMode(r) === "online").length;
    const onsite = rows.filter(r => getExamMode(r) === "onsite").length;
    return { total, pending: pendingCount, approved, rejected, online, onsite };
  }, [rows]);

  const formations = useMemo(() => {
    const map = new Map<string, CandidatureRow[]>();
    for (const name of PREDEFINED_FORMATIONS) map.set(name, []);
    for (const r of rows) {
      const raw = r.answers?.[FORMATION_FIELD];
      const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(r);
    }
    return Array.from(map.entries()).map(([name, items]) => ({ name, items }));
  }, [rows]);

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

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
            Tableau de bord
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Vue d&apos;ensemble des candidatures de la session sélectionnée.
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

      {/* ── Bannière session active / picker ── */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        {loadingSessions ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Chargement des sessions…
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-gray-500">
            Aucune session créée.{" "}
            <Link href="/dashboard/sessions" className="font-bold text-indigo-600 hover:underline">
              Créer une session
            </Link>
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
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
                style={{
                  backgroundColor: selectedSession.status === "active" ? "#e8f5e9" : "#ffebee",
                  color: selectedSession.status === "active" ? "#2e7d32" : "#c62828",
                }}
              >
                {selectedSession.status}
              </span>
            )}
            <span className="text-xs text-gray-400 ml-auto">
              {rows.length} dossier{rows.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
      )}

      {/* ── Statistiques ── */}
      {selectedId && !loadingRows && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Statistiques</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total candidats" value={stats.total}     icon={Users}        color="#1a237e" bg="#e8eaf6" delay={0} />
            <StatCard label="En attente"      value={stats.pending}   icon={Hourglass}    color="#b26a00" bg="#fff8e1" delay={0.04} />
            <StatCard label="Validées"        value={stats.approved}  icon={CheckCircle2} color="#2e7d32" bg="#e8f5e9" delay={0.08} />
            <StatCard label="Rejetées"        value={stats.rejected}  icon={XCircle}      color="#c62828" bg="#ffebee" delay={0.12} />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard label="En ligne"   value={stats.online} icon={Monitor} color="#1a237e" bg="#e8eaf6" delay={0.16} />
            <StatCard label="Présentiel" value={stats.onsite} icon={MapPin}  color="#2e7d32" bg="#e8f5e9" delay={0.20} />
          </div>
        </div>
      )}

      {/* ── Candidatures en cours ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-sm font-black uppercase tracking-widest inline-flex items-center gap-2" style={{ color: "#1a237e" }}>
            <Bell className="h-4 w-4" />
            Candidatures en cours
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            {pending.length} en attente
          </span>
        </div>

        {loadingRows ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !selectedId ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Aucune session sélectionnée.
          </div>
        ) : pending.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Aucune candidature en cours pour cette session.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {pending.slice(0, 8).map((r, i) => {
              const v = r.documents_validation || {};
              const entries = Object.values(v);
              const hasIssue = entries.some(e => e.resubmit_requested);
              const allValid = entries.length > 0 && entries.every(e => e.valid === true);
              const mode = getExamMode(r);
              const href = mode === "online"
                ? "/dashboard/candidatures?mode=online"
                : mode === "onsite"
                  ? "/dashboard/candidatures?mode=onsite"
                  : `/dashboard/candidatures/${r._id}`;
              return (
                <motion.li
                  key={r._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={href}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: hasIssue ? "#fef2f2" : allValid ? "#e8f5e9" : "#fffbeb" }}
                    >
                      {hasIssue ? (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      ) : allValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-800 truncate">
                          {r.name || "Candidat"}
                        </p>
                        {r.public_id && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            {r.public_id}
                          </span>
                        )}
                        {mode === "online" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                            <Monitor className="h-2.5 w-2.5" /> En ligne
                          </span>
                        )}
                        {mode === "onsite" && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            <MapPin className="h-2.5 w-2.5" /> Présentiel
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {hasIssue
                          ? "Document à renvoyer — relance envoyée"
                          : allValid
                            ? "Documents validés — prêt à valider la candidature"
                            : "Nouvelle candidature à examiner"}
                        {r.answers?.[FORMATION_FIELD]
                          ? ` • ${r.answers[FORMATION_FIELD]}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">
                      {formatRelative(r.submitted_at)}
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Dossiers par formation ── */}
      {selectedId && !loadingRows && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Dossiers par formation</p>
          {formations.every(f => f.items.length === 0) ? (
            <div className="p-12 text-center rounded-2xl bg-white border border-dashed border-gray-200">
              <Folder className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm">Aucun dossier disponible pour cette session.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {formations.map((f, i) => {
                const pendingCount = f.items.filter(r => !r.status || r.status === "pending").length;
                const approvedCount = f.items.filter(r => r.status === "approved").length;
                const isEmpty = f.items.length === 0;
                return (
                  <motion.div
                    key={f.name}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Link
                      href={`/dashboard/formation?session=${encodeURIComponent(selectedId)}&name=${encodeURIComponent(f.name)}`}
                      className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all h-full"
                    >
                      <div
                        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: isEmpty ? "#f3f4f6" : "#fff8e1" }}
                      >
                        <Folder className="h-5 w-5" style={{ color: isEmpty ? "#9ca3af" : "#f59e0b" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 leading-snug line-clamp-2">{f.name}</h3>
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" /> {f.items.length} candidat{f.items.length > 1 ? "s" : ""}
                          </span>
                          {pendingCount > 0 && <span className="text-amber-700">{pendingCount} en attente</span>}
                          {approvedCount > 0 && <span className="text-green-700">{approvedCount} validé{approvedCount > 1 ? "s" : ""}</span>}
                          {isEmpty && <span className="text-gray-400 italic">Vide</span>}
                        </div>
                      </div>
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
