"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  Clock,
  Folder,
  FolderOpen,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Users,
  Hourglass,
  XCircle,
  Monitor,
  MapPin,
} from "lucide-react";

import {
  fetchSessions,
  fetchSessionResponses,
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
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function DashboardOverviewPage() {
  const { user, isLoading } = useAuth();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<CandidatureRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const list = await fetchSessions();
        setSessions(list);
        const active = list.find(s => s.status === "active") || null;
        setActiveSession(active);
        if (active) setRows(await fetchSessionResponses(active._id));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pending = useMemo(() => rows.filter(isPending), [rows]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter(r => !r.status || r.status === "pending").length,
    approved: rows.filter(r => r.status === "approved").length,
    rejected: rows.filter(r => r.status === "rejected").length,
  }), [rows]);

  const formations = useMemo(() => {
    const map = new Map<string, CandidatureRow[]>();
    for (const name of PREDEFINED_FORMATIONS) map.set(name, []);
    for (const r of rows) {
      const raw = r.answers?.[FORMATION_FIELD];
      const name = (typeof raw === "string" && raw.trim()) ? raw.trim() : UNCATEGORIZED;
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(r);
    }
    return Array.from(map.entries())
      .map(([name, items]) => ({ name, items }))
      .filter(f => f.items.length > 0 || PREDEFINED_FORMATIONS.includes(f.name));
  }, [rows]);

  if (isLoading || !user) return null;

  return (
    <div className="space-y-6">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
          Tableau de bord
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Vue d&apos;ensemble de la session active.
        </p>
      </div>

      {/* ── Bannière session active ── */}
      <div
        className="rounded-2xl p-5 border shadow-sm flex items-center gap-4 flex-wrap"
        style={{
          backgroundColor: activeSession ? "#e8eaf6" : "#fff8e1",
          borderColor: activeSession ? "#c5cae9" : "#fde68a",
        }}
      >
        <div
          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: activeSession ? "#1a237e" : "#f59e0b" }}
        >
          <CalendarDays className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: activeSession ? "#1a237e" : "#92400e" }}>
            Session active
          </p>
          {activeSession ? (
            <h2 className="text-lg font-black text-gray-800 truncate">{activeSession.name}</h2>
          ) : (
            <p className="text-sm text-gray-600">
              Aucune session active.{" "}
              <Link href="/dashboard/sessions" className="font-bold text-indigo-700 hover:underline">
                Créer ou activer une session
              </Link>
              .
            </p>
          )}
          {activeSession && (activeSession.start_date || activeSession.end_date) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {activeSession.start_date || "—"}{activeSession.end_date ? ` → ${activeSession.end_date}` : ""}
            </p>
          )}
        </div>
        {sessions.length > 1 && (
          <Link href="/dashboard/sessions" className="text-xs font-bold text-indigo-700 hover:underline">
            Gérer les sessions →
          </Link>
        )}
      </div>

      {loading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : !activeSession ? null : (
        <>
          {/* ── Stats rapides ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Total",       value: stats.total,    icon: Users,         color: "#1a237e", bg: "#e8eaf6" },
              { label: "En attente",  value: stats.pending,  icon: Hourglass,     color: "#b26a00", bg: "#fff8e1" },
              { label: "Validées",    value: stats.approved, icon: CheckCircle2,  color: "#2e7d32", bg: "#e8f5e9" },
              { label: "Rejetées",    value: stats.rejected, icon: XCircle,       color: "#c62828", bg: "#ffebee" },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3"
                >
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: s.bg }}>
                    <Icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                  <div>
                    <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── Dossiers par formation ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black uppercase tracking-widest inline-flex items-center gap-2" style={{ color: "#1a237e" }}>
                <FolderOpen className="h-4 w-4" />
                Dossiers par formation
              </h2>
            </div>
            {formations.every(f => f.items.length === 0) ? (
              <div className="p-10 text-center rounded-2xl bg-white border border-dashed border-gray-200">
                <Folder className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500 text-sm">Aucun dossier pour cette session.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {formations.map((f, i) => {
                  const pendingCount = f.items.filter(r => !r.status || r.status === "pending").length;
                  const approvedCount = f.items.filter(r => r.status === "approved").length;
                  const onlineCount = f.items.filter(r => getExamMode(r) === "online").length;
                  const onsiteCount = f.items.filter(r => getExamMode(r) === "onsite").length;
                  const isEmpty = f.items.length === 0;
                  return (
                    <motion.div
                      key={f.name}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link
                        href={`/dashboard/candidatures/formation?session=${encodeURIComponent(activeSession._id)}&name=${encodeURIComponent(f.name)}`}
                        className="group flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all h-full"
                      >
                        <div
                          className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: isEmpty ? "#f3f4f6" : "#fff8e1" }}
                        >
                          <Folder className="h-5 w-5" style={{ color: isEmpty ? "#9ca3af" : "#f59e0b" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-gray-800 text-sm leading-snug line-clamp-2">{f.name}</h3>
                          <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-3 w-3" /> {f.items.length}
                            </span>
                            {onlineCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-indigo-600">
                                <Monitor className="h-3 w-3" /> {onlineCount}
                              </span>
                            )}
                            {onsiteCount > 0 && (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <MapPin className="h-3 w-3" /> {onsiteCount}
                              </span>
                            )}
                            {pendingCount > 0 && <span className="text-amber-600">{pendingCount} en attente</span>}
                            {approvedCount > 0 && <span className="text-green-700">{approvedCount} validé{approvedCount > 1 ? "s" : ""}</span>}
                            {isEmpty && <span className="italic">Vide</span>}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0 mt-1" />
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

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

            {pending.length === 0 ? (
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
                      : "/dashboard/candidatures?mode=online";
                  return (
                    <motion.li
                      key={r._id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <Link href={href} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
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
                            <p className="text-sm font-bold text-gray-800 truncate">{r.name || "Candidat"}</p>
                            {r.public_id && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{r.public_id}</span>
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
                            {r.answers?.["Certification souhaitée"] ? ` • ${r.answers["Certification souhaitée"]}` : ""}
                          </p>
                        </div>
                        <div className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">{formatRelative(r.submitted_at)}</div>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            )}

            {pending.length > 8 && (
              <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
                <Link
                  href="/dashboard/candidatures?mode=online"
                  className="text-xs font-bold uppercase tracking-widest text-indigo-700 hover:underline"
                >
                  Voir toutes les candidatures →
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
