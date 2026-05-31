"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Loader2,
    BookOpen,
    CalendarDays,
    Send,
    Trophy,
    Upload,
    ShieldCheck,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExams, type CandidateExam, type DocumentValidationEntry } from "@/lib/api";

const DOC_LABELS: Record<string, string> = {
    "CV": "Curriculum Vitae",
    "Pièce d'identité": "Pièce d'identité",
    "Justificatif d'expérience": "Justificatif d'expérience",
    "Diplômes": "Diplômes / attestations",
};

// ── Types de notification ──────────────────────────────────────
type Notif =
    | { type: "certified"; cert: string; grade?: string | null; appreciation?: string | null }
    | { type: "available"; exam: CandidateExam; cert: string }
    | { type: "done";      cert: string; graded: boolean; grade?: string | null; appreciation?: string | null }
    | { type: "expired";   cert: string }
    | { type: "doc";       key: string; label: string; v: DocumentValidationEntry };

export default function CandidateDashboardPage() {
    const { dossier, dossiers, loading } = useCandidate();
    const [exams, setExams] = useState<CandidateExam[]>([]);
    const [now, setNow] = useState(Date.now());

    // Chargement initial + rafraîchissement toutes les 30s
    useEffect(() => {
        fetchCandidateExams().then(setExams).catch(() => {});
        const id = setInterval(
            () => fetchCandidateExams().then(setExams).catch(() => {}),
            30_000,
        );
        return () => clearInterval(id);
    }, []);

    // Horloge pour la vérification de deadline
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    if (loading || !dossier) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
        );
    }

    // ── Construction des notifications ────────────────────────────
    const notifications: Notif[] = [];

    // 1. Une notification d'examen par dossier
    for (const d of dossiers) {
        const cert = d.answers?.["Certification souhaitée"];
        if (!cert) continue;

        const exam   = exams.find(e => e.certification === cert) ?? null;
        const alreadyDone = d.exam_status === "submitted" || d.exam_status === "graded";
        const isGraded    = d.exam_status === "graded";

        // Certifié par le comité — priorité maximale
        if (d.final_decision === "certified") {
            notifications.push({
                type: "certified",
                cert,
                grade: d.final_grade ?? (d as any).exam_grade ?? null,
                appreciation: d.final_appreciation ?? (d as any).exam_appreciation ?? null,
            });
            continue;
        }

        if (alreadyDone) {
            notifications.push({
                type: "done",
                cert,
                graded: isGraded,
                grade: d.final_grade ?? (d as any).exam_grade ?? null,
                appreciation: d.final_appreciation ?? (d as any).exam_appreciation ?? null,
            });
            continue;
        }

        if (!exam || !d.exam_token) continue;

        const deadline = exam.deadline;
        const expired  = deadline
            ? new Date(deadline + "T23:59:59").getTime() < now
            : false;

        if (expired) {
            notifications.push({ type: "expired", cert });
        } else {
            notifications.push({ type: "available", exam, cert });
        }
    }

    // 2. Documents à renvoyer (une seule fois — dossier actif)
    const validation = dossier.documents_validation || {};
    const docIssues: Notif[] = Object.entries(DOC_LABELS)
        .map(([key, label]) => ({ key, label, v: (validation[key] || {}) as DocumentValidationEntry }))
        .filter(d => d.v.resubmit_requested)
        .map(d => ({ type: "doc" as const, ...d }));

    notifications.push(...docIssues);

    const displayName = dossier.name || "Candidat";

    return (
        <div className="max-w-xl mx-auto space-y-8 py-4">

            {/* ── Nom ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                    Espace candidat
                </p>
                <h1 className="text-3xl font-black leading-tight" style={{ color: "#1a237e" }}>
                    Bonjour, {displayName}&nbsp;👋
                </h1>
            </motion.div>

            {/* ── Notifications ── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.07 }}
                className="space-y-3"
            >
                <AnimatePresence initial={false}>
                    {notifications.length === 0 ? (
                        <motion.div
                            key="empty"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm"
                        >
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            <p className="text-sm text-gray-500">Aucune action requise pour le moment.</p>
                        </motion.div>
                    ) : (
                        notifications.map((n, i) => (
                            <motion.div
                                key={n.type === "doc" ? `doc-${n.key}` : `${n.type}-${n.cert ?? i}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ delay: i * 0.05 }}
                            >

                                {/* Certifié par le comité */}
                                {n.type === "certified" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 shadow-sm" style={{ backgroundColor: "#e8f5e9", borderColor: "#2e7d32" }}>
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#c8e6c9" }}>
                                            <Trophy className="h-5 w-5" style={{ color: "#1b5e20" }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#1b5e20" }}>
                                                Certification validée 🎉
                                            </p>
                                            <p className="font-bold text-gray-800 text-sm leading-snug truncate">
                                                {n.cert}
                                            </p>
                                            {n.grade != null && (
                                                <p className="text-xs mt-0.5 font-semibold" style={{ color: "#2e7d32" }}>
                                                    Note&nbsp;: <span className="font-black">{n.grade}</span>
                                                    {n.appreciation && (
                                                        <span className="font-normal italic ml-1">— {n.appreciation}</span>
                                                    )}
                                                </p>
                                            )}
                                            <p className="text-xs mt-0.5" style={{ color: "#388e3c" }}>
                                                Vous avez déjà passé votre examen. Félicitations&nbsp;!
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#2e7d32", color: "#fff" }}>
                                            Certifié
                                        </span>
                                    </div>
                                )}

                                {/* Examen disponible */}
                                {n.type === "available" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                            <BookOpen className="h-5 w-5 text-emerald-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-0.5">
                                                Examen disponible
                                            </p>
                                            <p className="font-bold text-gray-800 text-sm leading-snug truncate">
                                                {n.exam.title || n.cert}
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3 shrink-0" />
                                                {n.cert}
                                            </p>
                                            {n.exam.deadline && (
                                                <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1 font-medium">
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    Limite&nbsp;:{" "}
                                                    {new Date(n.exam.deadline).toLocaleDateString("fr-FR", {
                                                        day: "2-digit", month: "long", year: "numeric",
                                                    })}
                                                </p>
                                            )}
                                        </div>
                                        <Link
                                            href="/candidat/examen"
                                            className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl text-white transition-all hover:-translate-y-0.5 animate-pulse"
                                            style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 12px rgba(46,125,50,0.3)" }}
                                        >
                                            Accéder
                                        </Link>
                                    </div>
                                )}

                                {/* Examen soumis / corrigé */}
                                {n.type === "done" && (
                                    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-sm ${n.graded ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"}`}>
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${n.graded ? "bg-emerald-100" : "bg-blue-100"}`}>
                                            {n.graded
                                                ? <Trophy className="h-5 w-5 text-emerald-700" />
                                                : <Send className="h-5 w-5 text-blue-700" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-sm ${n.graded ? "text-emerald-800" : "text-blue-800"}`}>
                                                {n.graded ? "Résultats disponibles" : "Copie en cours de correction"}
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3 shrink-0" />
                                                {n.cert}
                                            </p>
                                            {n.graded && n.grade != null && (
                                                <p className="text-xs text-emerald-700 mt-0.5 font-semibold">
                                                    Note&nbsp;: <span className="font-black">{n.grade}</span>
                                                    {n.appreciation && (
                                                        <span className="font-normal italic ml-1">— {n.appreciation}</span>
                                                    )}
                                                </p>
                                            )}
                                            {!n.graded && (
                                                <p className="text-xs text-blue-600 mt-0.5">
                                                    Résultats envoyés par email après correction.
                                                </p>
                                            )}
                                        </div>
                                        <span className={`shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg ${n.graded ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>
                                            {n.graded ? "Corrigé" : "Soumis"}
                                        </span>
                                    </div>
                                )}

                                {/* Examen expiré */}
                                {n.type === "expired" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                                            <CalendarDays className="h-5 w-5 text-rose-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-rose-800 text-sm">Délai dépassé</p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3 shrink-0" />
                                                {n.cert}
                                            </p>
                                            <p className="text-xs text-rose-600 mt-0.5">
                                                Contactez le responsable IRISQ.
                                            </p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700">
                                            Expiré
                                        </span>
                                    </div>
                                )}

                                {/* Document à renvoyer */}
                                {n.type === "doc" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-red-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-0.5">
                                                Document à renvoyer
                                            </p>
                                            <p className="font-bold text-gray-800 text-sm">{n.label}</p>
                                            {n.v.resubmit_message && (
                                                <p className="text-xs text-red-700 mt-0.5 italic truncate">
                                                    «&nbsp;{n.v.resubmit_message}&nbsp;»
                                                </p>
                                            )}
                                        </div>
                                        <Link
                                            href="/candidat/documents"
                                            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            <Upload className="h-3 w-3" /> Renvoyer
                                        </Link>
                                    </div>
                                )}

                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
