"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
    AlertTriangle, CheckCircle2, Clock, Loader2, BookOpen,
    CalendarDays, Send, Trophy, Upload, ShieldCheck,
    Layers, PlusCircle, Award,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExams, type CandidateExam, type DocumentValidationEntry, type CandidateDossier } from "@/lib/api";

const DOC_LABELS: Record<string, string> = {
    "CV": "Curriculum Vitae",
    "Pièce d'identité": "Pièce d'identité",
    "Justificatif d'expérience": "Justificatif d'expérience",
    "Diplômes": "Diplômes / attestations",
};

// ── Statut enrichi par dossier ─────────────────────────────────────────────
function getDossierStatus(d: CandidateDossier) {
    if (d.final_decision === "certified") return { label: "Certifié ✓",    bg: "#e8f5e9", color: "#2e7d32"  };
    if (d.exam_status === "graded")       return { label: "Noté",           bg: "#e8eaf6", color: "#1a237e"  };
    if (d.exam_status === "submitted")    return { label: "Examen soumis",  bg: "#e3f2fd", color: "#1565c0"  };
    if (d.status === "approved")          return { label: "Validée",        bg: "#e8f5e9", color: "#2e7d32"  };
    if (d.status === "rejected")          return { label: "Refusée",        bg: "#ffebee", color: "#c62828"  };
    return                                       { label: "En attente",     bg: "#fff8e1", color: "#b45309"  };
}

// ── Types de notification ──────────────────────────────────────────────────
type Notif =
    | { type: "certified"; cert: string; grade?: string | null; appreciation?: string | null }
    | { type: "available"; exam: CandidateExam; cert: string }
    | { type: "done";      cert: string; graded: boolean; grade?: string | null; appreciation?: string | null }
    | { type: "expired";   cert: string }
    | { type: "doc";       key: string; label: string; v: DocumentValidationEntry };

// ── Carte dossier ──────────────────────────────────────────────────────────
function DossierCard({
    d, delay, now, exams,
}: {
    d: CandidateDossier; delay: number; now: number; exams: CandidateExam[];
}) {
    const cert    = d.answers?.["Certification souhaitée"] || d.public_id || "Certification";
    const st      = getDossierStatus(d);
    const exam    = exams.find(e => e.certification === cert);
    const expired = exam?.deadline
        ? new Date(exam.deadline + "T23:59:59").getTime() < now
        : false;
    const canAccess =
        !!d.exam_token && !!exam && !expired &&
        d.exam_status !== "submitted" && d.exam_status !== "graded" &&
        d.final_decision !== "certified";
    const date = d.submitted_at
        ? new Date(d.submitted_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })
        : null;

    return (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                    <ShieldCheck className="h-5 w-5" style={{ color: "#1a237e" }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm leading-snug truncate">{cert}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: st.bg, color: st.color }}
                        >
                            {st.label}
                        </span>
                        {d.public_id && (
                            <span className="text-[10px] text-gray-400 font-mono">{d.public_id}</span>
                        )}
                        {date && (
                            <span className="text-[10px] text-gray-400">{date}</span>
                        )}
                    </div>
                </div>
                {canAccess && (
                    <Link
                        href="/candidat/examen"
                        className="shrink-0 inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-xl text-white animate-pulse"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 10px rgba(46,125,50,0.25)" }}
                    >
                        <BookOpen className="h-3 w-3" />
                        Examen
                    </Link>
                )}
            </div>
        </motion.div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function TableauDeBordPage() {
    const { dossier, dossiers, loading } = useCandidate();
    const [exams, setExams] = useState<CandidateExam[]>([]);
    const [now,   setNow]   = useState(Date.now());

    useEffect(() => {
        fetchCandidateExams().then(setExams).catch(() => {});
        const id = setInterval(
            () => fetchCandidateExams().then(setExams).catch(() => {}),
            30_000,
        );
        return () => clearInterval(id);
    }, []);

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

    // ── Groupes de demandes ──────────────────────────────────────────────────
    const validees   = dossiers.filter(d => d.status === "approved" || d.final_decision === "certified");
    const enAttente  = dossiers.filter(d => d.status !== "approved" && d.final_decision !== "certified");

    const nbCertif   = dossiers.filter(d => d.final_decision === "certified").length;
    const nbExamDispo = dossiers.filter(d => {
        const cert = d.answers?.["Certification souhaitée"];
        const exam = exams.find(e => e.certification === cert);
        const expired = exam?.deadline
            ? new Date(exam.deadline + "T23:59:59").getTime() < now
            : false;
        return !!d.exam_token && !!exam && !expired &&
            d.exam_status !== "submitted" && d.exam_status !== "graded" &&
            d.final_decision !== "certified";
    }).length;

    // ── Notifications (alertes d'action) ────────────────────────────────────
    const notifications: Notif[] = [];
    for (const d of dossiers) {
        const cert = d.answers?.["Certification souhaitée"];
        if (!cert) continue;

        const exam      = exams.find(e => e.certification === cert) ?? null;
        const alreadyDone = d.exam_status === "submitted" || d.exam_status === "graded";
        const isGraded    = d.exam_status === "graded";

        if (d.final_decision === "certified") {
            notifications.push({
                type: "certified", cert,
                grade: d.final_grade ?? null,
                appreciation: d.final_appreciation ?? null,
            });
            continue;
        }
        if (alreadyDone) {
            notifications.push({
                type: "done", cert, graded: isGraded,
                grade: d.final_grade ?? null,
                appreciation: d.final_appreciation ?? null,
            });
            continue;
        }
        if (!exam || !d.exam_token) continue;
        const deadline = exam.deadline;
        const expired  = deadline ? new Date(deadline + "T23:59:59").getTime() < now : false;
        if (expired) notifications.push({ type: "expired", cert });
        else         notifications.push({ type: "available", exam, cert });
    }

    // Documents à renvoyer (dossier actif)
    const validation = dossier.documents_validation || {};
    Object.entries(DOC_LABELS).forEach(([key, label]) => {
        const v = (validation[key] || {}) as DocumentValidationEntry;
        if (v.resubmit_requested) notifications.push({ type: "doc", key, label, v });
    });

    const displayName = dossier.name?.split(" ")[0] || "Candidat";

    return (
        <div className="space-y-8 py-4">

            {/* ── Accueil ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                    Tableau de bord
                </p>
                <h1 className="text-3xl font-black leading-tight" style={{ color: "#1a237e" }}>
                    Bonjour, {displayName}&nbsp;👋
                </h1>
                {/* Stats rapides */}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Layers className="h-4 w-4" style={{ color: "#1a237e" }} />
                        <span className="font-bold">{dossiers.length}</span>
                        <span>demande{dossiers.length > 1 ? "s" : ""}</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Award className="h-4 w-4" style={{ color: "#2e7d32" }} />
                        <span className="font-bold">{nbCertif}</span>
                        <span>certification{nbCertif > 1 ? "s" : ""}</span>
                    </div>
                    {nbExamDispo > 0 && (
                        <>
                            <div className="w-1 h-1 rounded-full bg-gray-300" />
                            <div className="flex items-center gap-1.5 text-sm" style={{ color: "#2e7d32" }}>
                                <BookOpen className="h-4 w-4" />
                                <span className="font-bold">{nbExamDispo}</span>
                                <span>examen{nbExamDispo > 1 ? "s" : ""} disponible{nbExamDispo > 1 ? "s" : ""}</span>
                            </div>
                        </>
                    )}
                </div>
            </motion.div>

            {/* ── Alertes & Notifications ── */}
            {notifications.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="space-y-3"
                >
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        Alertes & Notifications
                    </h2>
                    <AnimatePresence initial={false}>
                        {notifications.map((n, i) => (
                            <motion.div
                                key={n.type === "doc" ? `doc-${n.key}` : `${n.type}-${(n as any).cert ?? i}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ delay: i * 0.04 }}
                            >
                                {/* Certifié */}
                                {n.type === "certified" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl border-2 shadow-sm" style={{ backgroundColor: "#e8f5e9", borderColor: "#2e7d32" }}>
                                        <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#c8e6c9" }}>
                                            <Trophy className="h-5 w-5" style={{ color: "#1b5e20" }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#1b5e20" }}>Certification validée 🎉</p>
                                            <p className="font-bold text-gray-800 text-sm truncate">{n.cert}</p>
                                            {n.grade != null && (
                                                <p className="text-xs mt-0.5 font-semibold" style={{ color: "#2e7d32" }}>
                                                    Note&nbsp;: <span className="font-black">{n.grade}</span>
                                                    {n.appreciation && <span className="font-normal italic ml-1">— {n.appreciation}</span>}
                                                </p>
                                            )}
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg" style={{ backgroundColor: "#2e7d32", color: "#fff" }}>Certifié</span>
                                    </div>
                                )}

                                {/* Examen disponible */}
                                {n.type === "available" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                            <BookOpen className="h-5 w-5 text-emerald-700" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 mb-0.5">Examen disponible</p>
                                            <p className="font-bold text-gray-800 text-sm truncate">{n.exam.title || n.cert}</p>
                                            {n.exam.deadline && (
                                                <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1 font-medium">
                                                    <Clock className="h-3 w-3 shrink-0" />
                                                    Limite&nbsp;: {new Date(n.exam.deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                                                </p>
                                            )}
                                        </div>
                                        <Link href="/candidat/examen" className="shrink-0 text-xs font-bold px-4 py-2 rounded-xl text-white animate-pulse" style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 12px rgba(46,125,50,0.3)" }}>
                                            Accéder
                                        </Link>
                                    </div>
                                )}

                                {/* Examen soumis / noté */}
                                {n.type === "done" && (
                                    <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl border shadow-sm ${n.graded ? "bg-emerald-50 border-emerald-100" : "bg-blue-50 border-blue-100"}`}>
                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${n.graded ? "bg-emerald-100" : "bg-blue-100"}`}>
                                            {n.graded ? <Trophy className="h-5 w-5 text-emerald-700" /> : <Send className="h-5 w-5 text-blue-700" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-bold text-sm ${n.graded ? "text-emerald-800" : "text-blue-800"}`}>
                                                {n.graded ? "Résultats disponibles" : "Copie en cours de correction"}
                                            </p>
                                            <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                                                <ShieldCheck className="h-3 w-3 shrink-0" />{n.cert}
                                            </p>
                                            {n.graded && n.grade != null && (
                                                <p className="text-xs text-emerald-700 mt-0.5 font-semibold">
                                                    Note&nbsp;: <span className="font-black">{n.grade}</span>
                                                    {n.appreciation && <span className="font-normal italic ml-1">— {n.appreciation}</span>}
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
                                                <ShieldCheck className="h-3 w-3 shrink-0" />{n.cert}
                                            </p>
                                            <p className="text-xs text-rose-600 mt-0.5">Contactez le responsable IRISQ.</p>
                                        </div>
                                        <span className="shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700">Expiré</span>
                                    </div>
                                )}

                                {/* Document à renvoyer */}
                                {n.type === "doc" && (
                                    <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white border border-red-100 shadow-sm">
                                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="h-5 w-5 text-red-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-red-700 mb-0.5">Document à renvoyer</p>
                                            <p className="font-bold text-gray-800 text-sm">{n.label}</p>
                                            {n.v.resubmit_message && (
                                                <p className="text-xs text-red-700 mt-0.5 italic truncate">«&nbsp;{n.v.resubmit_message}&nbsp;»</p>
                                            )}
                                        </div>
                                        <Link href="/candidat/dossiers" className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl text-white" style={{ backgroundColor: "#1a237e" }}>
                                            <Upload className="h-3 w-3" />Renvoyer
                                        </Link>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ── Mes demandes ── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                        <Layers className="h-4 w-4" style={{ color: "#1a237e" }} />
                        Mes demandes
                    </h2>
                    <Link
                        href="/candidat/nouvelle-demande"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "#1a237e", boxShadow: "0 4px 12px rgba(26,35,126,0.2)" }}
                    >
                        <PlusCircle className="h-3.5 w-3.5" />
                        Nouvelle demande
                    </Link>
                </div>

                {dossiers.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                        <Award className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                        <p className="font-bold text-gray-700">Aucune demande pour le moment</p>
                        <p className="text-sm text-gray-400 mt-1">Commencez votre parcours de certification IRISQ.</p>
                        <Link
                            href="/candidat/nouvelle-demande"
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            <PlusCircle className="h-4 w-4" />Faire une demande
                        </Link>
                    </div>
                ) : (
                    <>
                        {/* Validées */}
                        {validees.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#2e7d32" }}>
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Validées · {validees.length}
                                </h3>
                                {validees.map((d, i) => (
                                    <DossierCard key={d._id} d={d} delay={i * 0.04} now={now} exams={exams} />
                                ))}
                            </div>
                        )}

                        {/* En attente */}
                        {enAttente.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="text-[11px] font-bold uppercase tracking-widest flex items-center gap-2" style={{ color: "#b45309" }}>
                                    <Clock className="h-3.5 w-3.5" />
                                    En attente · {enAttente.length}
                                </h3>
                                {enAttente.map((d, i) => (
                                    <DossierCard key={d._id} d={d} delay={i * 0.04} now={now} exams={exams} />
                                ))}
                            </div>
                        )}
                    </>
                )}
            </motion.div>
        </div>
    );
}
