"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Bell,
  Clock,
  FolderOpen,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Loader2,
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
  answers?: Record<string, any>;
  documents_validation?: Record<string, { valid?: boolean; resubmit_requested?: boolean }>;
}

function isPending(r: CandidatureRow): boolean {
  return !r.status || r.status === "pending";
}

function formatRelative(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
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
        if (active) {
          const r = await fetchSessionResponses(active._id);
          setRows(r);
        }
      } catch {
        // ignore — overview stays empty
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pending = useMemo(() => rows.filter(isPending), [rows]);

  if (isLoading || !user) return null;

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
            Vue d&apos;ensemble
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Suivi des candidatures en cours pour la session active.
          </p>
        </div>
        <Link
          href="/dashboard/candidatures"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
          style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
        >
          <FolderOpen className="h-4 w-4" />
          Revue des demandes
          <ChevronRight className="h-4 w-4" />
        </Link>
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
              {activeSession.start_date || "—"}
              {activeSession.end_date ? ` → ${activeSession.end_date}` : ""}
            </p>
          )}
        </div>
        {sessions.length > 1 && (
          <Link
            href="/dashboard/sessions"
            className="text-xs font-bold text-indigo-700 hover:underline"
          >
            Gérer les sessions →
          </Link>
        )}
      </div>

      {/* ── Notifications ── */}
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

        {loading ? (
          <div className="p-10 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : !activeSession ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Aucune session active pour le moment.
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
              return (
                <motion.li
                  key={r._id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href="/dashboard/candidatures"
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
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {hasIssue
                          ? "Document à renvoyer — relance envoyée"
                          : allValid
                            ? "Documents validés — prêt à valider la candidature"
                            : "Nouvelle candidature à examiner"}
                        {r.answers?.["Certification souhaitée"]
                          ? ` • ${r.answers["Certification souhaitée"]}`
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

        {pending.length > 8 && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 text-center">
            <Link
              href="/dashboard/candidatures"
              className="text-xs font-bold uppercase tracking-widest text-indigo-700 hover:underline"
            >
              Voir toutes les candidatures →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
