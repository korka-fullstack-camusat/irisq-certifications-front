"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
    CheckCircle2, Clock, Loader2, BookOpen,
    Layers, PlusCircle, Award, ShieldCheck, X, ArrowRight, Info,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExams, type CandidateExam, type CandidateDossier } from "@/lib/api";

// ── Certifications disponibles ─────────────────────────────────────────────────
const CERTIFICATIONS = [
    "Junior Implementor ISO/IEC17025:2017",
    "Implementor ISO/IEC17025:2017",
    "Lead Implementor ISO/IEC17025:2017",
    "Junior Implementor ISO 9001:2015",
    "Implementor ISO 9001:2015",
    "Lead Implementor ISO 9001:2015",
    "Junior Implementor ISO 14001:2015",
    "Implementor ISO 14001:2015",
    "Lead Implementor ISO 14001:2015",
    "Junior Implementor ISO 45001:2018",
    "Implementor ISO 45001:2018",
    "Lead Implementor ISO 45001:2018",
];

// ── Statut enrichi par dossier ─────────────────────────────────────────────
function getDossierStatus(d: CandidateDossier) {
    if (d.final_decision === "certified") return { label: "Certifié ✓",    bg: "#e8f5e9", color: "#2e7d32"  };
    if (d.exam_status === "graded")       return { label: "Noté",           bg: "#e8eaf6", color: "#1a237e"  };
    if (d.exam_status === "submitted")    return { label: "Examen soumis",  bg: "#e3f2fd", color: "#1565c0"  };
    if (d.status === "approved")          return { label: "Validée",        bg: "#e8f5e9", color: "#2e7d32"  };
    if (d.status === "rejected")          return { label: "Refusée",        bg: "#ffebee", color: "#c62828"  };
    return                                       { label: "En attente",     bg: "#fff8e1", color: "#b45309"  };
}

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

// ── Modal Nouvelle formation ───────────────────────────────────────────────
function NouvelleFormationModal({
    email,
    existingCerts,
    onClose,
}: {
    email: string;
    existingCerts: string[];
    onClose: () => void;
}) {
    const available = CERTIFICATIONS.filter(c => !existingCerts.includes(c));

    return (
        <AnimatePresence>
            <>
                {/* Overlay */}
                <motion.div
                    key="overlay"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Modal */}
                <motion.div
                    key="modal"
                    initial={{ opacity: 0, scale: 0.93, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.93, y: 20 }}
                    transition={{ duration: 0.22 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto"
                        style={{ border: "2px solid #e8eaf6" }}
                    >
                        {/* Header modal */}
                        <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#1a237e" }}>
                            <div className="flex items-center gap-2">
                                <PlusCircle className="h-4 w-4 text-white/80" />
                                <span className="text-sm font-bold uppercase tracking-widest text-white">Nouvelle formation</span>
                            </div>
                            <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Corps modal */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Info email */}
                            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: "#e8eaf6", border: "1px solid #c5cae9" }}>
                                <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#1a237e" }} />
                                <p className="text-xs leading-relaxed" style={{ color: "#1a237e" }}>
                                    <strong>Important&nbsp;:</strong> Pour lier la nouvelle demande à ce compte, utilisez{" "}
                                    <strong>exactement la même adresse email</strong>&nbsp;:{" "}
                                    <span className="font-mono bg-white/60 px-1.5 py-0.5 rounded">{email || "votre email actuel"}</span>
                                </p>
                            </div>

                            {/* Étapes */}
                            <div>
                                <h3 className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                    Comment procéder
                                </h3>
                                <ol className="space-y-2.5">
                                    {[
                                        "Cliquez sur « Accéder au formulaire » ci-dessous.",
                                        `Utilisez votre adresse email : ${email || "votre email actuel"}.`,
                                        "Sélectionnez la nouvelle certification souhaitée et complétez le formulaire.",
                                        "Vos identifiants actuels (ID et mot de passe) resteront inchangés.",
                                    ].map((text, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div
                                                className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 mt-0.5"
                                                style={{ backgroundColor: "#1a237e" }}
                                            >
                                                {i + 1}
                                            </div>
                                            <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Certifications disponibles */}
                            {available.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                                            Certifications disponibles
                                        </h3>
                                        <span
                                            className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            {available.length}
                                        </span>
                                    </div>
                                    <ul className="space-y-1">
                                        {available.map(cert => (
                                            <li
                                                key={cert}
                                                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-700 font-medium"
                                                style={{ backgroundColor: "#f8f9ff" }}
                                            >
                                                <Award className="h-3.5 w-3.5 shrink-0" style={{ color: "#2e7d32" }} />
                                                {cert}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Footer modal — CTA */}
                        <div className="px-6 py-4 shrink-0" style={{ borderTop: "2px solid #e8eaf6", backgroundColor: "#fafbff" }}>
                            <a
                                href="/demande-certification"
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={onClose}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                            >
                                <PlusCircle className="h-4 w-4" />
                                Accéder au formulaire de demande
                                <ArrowRight className="h-4 w-4" />
                            </a>
                        </div>
                    </div>
                </motion.div>
            </>
        </AnimatePresence>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function TableauDeBordPage() {
    const { dossier, dossiers, loading } = useCandidate();
    const [exams, setExams] = useState<CandidateExam[]>([]);
    const [now,   setNow]   = useState(Date.now());
    const [showModal, setShowModal] = useState(false);

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
    const validees  = dossiers.filter(d => d.status === "approved" || d.final_decision === "certified");
    const enAttente = dossiers.filter(d => d.status !== "approved" && d.final_decision !== "certified");

    const email         = dossier.email || "";
    const displayName   = dossier.name  || "Candidat";
    const existingCerts = dossiers
        .map(d => d.answers?.["Certification souhaitée"])
        .filter(Boolean) as string[];

    return (
        <div className="space-y-8 py-4">

            {/* ── En-tête avec bouton Nouvelle formation ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                    Tableau de bord
                </p>
                <div className="flex items-start justify-between gap-4">
                    <h1 className="text-3xl font-black leading-tight" style={{ color: "#1a237e" }}>
                        Bonjour,&nbsp;{displayName}&nbsp;👋
                    </h1>
                    <button
                        onClick={() => setShowModal(true)}
                        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                        style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
                    >
                        <PlusCircle className="h-4 w-4" />
                        <span className="hidden sm:inline">Nouvelle formation</span>
                        <span className="sm:hidden">Nouveau</span>
                    </button>
                </div>
            </motion.div>

            {/* ── Mes demandes ── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="space-y-4"
            >
                <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <Layers className="h-4 w-4" style={{ color: "#1a237e" }} />
                    Mes demandes
                </h2>

                {dossiers.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
                        <Award className="h-10 w-10 mx-auto text-gray-200 mb-3" />
                        <p className="font-bold text-gray-700">Aucune demande pour le moment</p>
                        <p className="text-sm text-gray-400 mt-1">Commencez votre parcours de certification IRISQ.</p>
                        <button
                            onClick={() => setShowModal(true)}
                            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-bold text-sm"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            <PlusCircle className="h-4 w-4" />Faire une demande
                        </button>
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

            {/* ── Modal Nouvelle formation ── */}
            {showModal && (
                <NouvelleFormationModal
                    email={email}
                    existingCerts={existingCerts}
                    onClose={() => setShowModal(false)}
                />
            )}
        </div>
    );
}
