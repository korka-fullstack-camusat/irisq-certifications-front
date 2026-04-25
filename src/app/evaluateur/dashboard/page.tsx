"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Loader2, CalendarDays, AlertCircle,
  CheckCircle2, Users, FileText, Award,
  Bell, ChevronRight,
} from "lucide-react";
import { fetchSessions, fetchSessionResponses, type Session } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";

export const SESSION_ID_KEY   = "irisq_evaluateur_session";
export const SESSION_NAME_KEY = "irisq_evaluateur_session_name";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRelative(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function generateId(r: any) {
  return r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;
}

function getActivityLabel(r: any): { label: string; color: string; bg: string; dot: string } | null {
  const hasExam     = r.exam_status && ["submitted", "graded"].includes(r.exam_status);
  const hasFinal    = !!r.final_grade;
  const hasExaminer = !!r.assigned_examiner_email;

  if (hasFinal)    return { label: "Évaluation finalisée",   color: "#2e7d32", bg: "#e8f5e9", dot: "#2e7d32" };
  if (hasExam)     return { label: "Copie à évaluer",        color: "#6a1b9a", bg: "#f3e5f5", dot: "#6a1b9a" };
  if (hasExaminer) return { label: "En attente de l'examen", color: "#e65100", bg: "#fff3e0", dot: "#e65100" };
  return null; // pas d'étiquette si aucun correcteur assigné
}

// ─── composant ───────────────────────────────────────────────────────────────

export default function EvaluateurDashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // ── Sessions ──
  const [sessions, setSessions]                   = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) || "" : "")
  );
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // ── Données ──
  const [approved, setApproved]   = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Chargement initial ──
  useEffect(() => {
    const cachedId = typeof window !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) || "" : "";

    fetchSessions().then(data => {
      const active = data.filter((s: Session) => s.status === "active");
      setSessions(active);
      const valid = cachedId && active.some((s: Session) => s._id === cachedId);
      if (!valid && active.length > 0) {
        const first = active[0];
        setSelectedSessionId(first._id);
        localStorage.setItem(SESSION_ID_KEY,   first._id);
        localStorage.setItem(SESSION_NAME_KEY, first.name);
      }
    }).catch(() => {}).finally(() => setIsLoadingSessions(false));

    if (cachedId) {
      setIsLoading(true);
      fetchSessionResponses(cachedId)
        .then(data => applyRows(data as any[]))
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, []);

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    if (!selectedSessionId) { setApproved([]); return; }
    // Sauvegarder ID + nom pour les autres pages
    const session = sessions.find(s => s._id === selectedSessionId);
    localStorage.setItem(SESSION_ID_KEY,   selectedSessionId);
    if (session) localStorage.setItem(SESSION_NAME_KEY, session.name);
    setIsLoading(true);
    fetchSessionResponses(selectedSessionId)
      .then(data => applyRows(data as any[]))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [selectedSessionId]);

  function applyRows(data: any[]) {
    setApproved(
      data
        .filter((r: any) => r.status === "approved")
        .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    );
  }

  // ── Stats ──
  const noExaminer     = approved.filter(r => !r.assigned_examiner_email);
  const examsSubmitted = approved.filter(r => r.exam_status && ["submitted", "graded"].includes(r.exam_status));
  const finalized      = approved.filter(r => !!r.final_grade);

  const stats = [
    { label: "Candidatures approuvées", value: approved.length,       icon: CheckCircle2, bg: "#e8f5e9", color: "#2e7d32", border: "#c8e6c9" },
    { label: "Sans correcteur assigné", value: noExaminer.length,     icon: Users,        bg: "#fff3e0", color: "#e65100", border: "#ffe0b2" },
    { label: "Copies soumises",         value: examsSubmitted.length, icon: FileText,     bg: "#f3e5f5", color: "#6a1b9a", border: "#e1bee7" },
    { label: "Évaluations finalisées",  value: finalized.length,      icon: Award,        bg: "#e8eaf6", color: "#1a237e", border: "#c5cae9" },
  ];

  // ── 3 dernières candidatures validées ──
  const activityFeed = approved.slice(0, 3);

  const selectedSession = sessions.find(s => s._id === selectedSessionId);

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
        <Loader2 className="animate-spin text-[#1a237e] h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
          Tableau de bord
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Vue d&apos;ensemble des candidatures validées de la session en cours.
        </p>
      </div>

      {/* ── Sélecteur de session (uniquement ici) ── */}
      <div className="bg-white rounded-2xl border shadow-sm p-4" style={{ borderColor: "#e8eaf6" }}>
        <div className="flex items-center gap-3 flex-wrap">
          <CalendarDays className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1a237e" }}>Session</span>

          {isLoadingSessions ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
            </div>
          ) : sessions.length === 0 ? (
            <span className="text-sm text-amber-600 font-semibold flex items-center gap-1">
              <AlertCircle className="h-4 w-4" /> Aucune session active
            </span>
          ) : (
            <select
              value={selectedSessionId}
              onChange={e => setSelectedSessionId(e.target.value)}
              className="flex-1 max-w-xs px-3 py-2 bg-[#f4f6f9] border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none"
              style={{ color: "#1a237e" }}
            >
              {sessions.map(s => (
                <option key={s._id} value={s._id}>
                  {s.name}{s.start_date ? ` — ${s.start_date}` : ""}
                </option>
              ))}
            </select>
          )}

          {selectedSession && (
            <span className="ml-auto text-[11px] text-gray-400 font-semibold">
              {selectedSession.start_date && `Début : ${selectedSession.start_date}`}
              {selectedSession.end_date   && ` · Fin : ${selectedSession.end_date}`}
            </span>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border p-5 animate-pulse h-28" style={{ borderColor: "#e8eaf6" }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border p-5 shadow-sm flex flex-col gap-3"
                style={{ borderColor: s.border }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-500 leading-snug">{s.label}</span>
                  <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: s.bg }}>
                    <Icon className="h-4 w-4" style={{ color: s.color }} />
                  </div>
                </div>
                <p className="text-3xl font-extrabold tracking-tight" style={{ color: s.color }}>
                  {s.value}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Activité en cours — 3 dernières candidatures validées ── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "#e8eaf6" }}>
          <h2 className="text-sm font-black uppercase tracking-widest inline-flex items-center gap-2"
            style={{ color: "#1a237e" }}>
            <Bell className="h-4 w-4" />
            Activité en cours
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
            style={{ borderColor: "#c5cae9", color: "#1a237e" }}>
            3 dernières
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !selectedSessionId || activityFeed.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            Aucune candidature validée pour cette session.
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {activityFeed.map((r, i) => {
              const id       = generateId(r);
              const cert     = r.answers?.["Certification souhaitée"] || "—";
              const activity = getActivityLabel(r);
              return (
                <motion.li
                  key={r._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href="/evaluateur"
                    className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="h-10 w-10 rounded-xl flex items-center justify-center text-[11px] font-black text-white shrink-0"
                      style={{ backgroundColor: "#1a237e" }}>
                      {id.slice(-4)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-800">{id}</span>
                        {activity && (
                          <span
                            className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: activity.bg, color: activity.color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: activity.dot }} />
                            {activity.label}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{cert}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] text-gray-400 whitespace-nowrap hidden sm:block">
                        {formatRelative(r.submitted_at)}
                      </span>
                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#1a237e] transition-colors" />
                    </div>
                  </Link>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
