"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Loader2, BookOpen,
    Layers, PlusCircle, Award, ShieldCheck, X, CheckCircle2,
    MonitorSmartphone, MapPin,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import {
    fetchCandidateExams,
    candidateNewApplication,
    type CandidateExam,
    type CandidateDossier,
} from "@/lib/api";

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
    existingCerts,
    onClose,
    onSuccess,
}: {
    existingCerts: string[];
    onClose: () => void;
    onSuccess: () => void;
}) {
    const available = CERTIFICATIONS.filter(c => !existingCerts.includes(c));

    const [selected,  setSelected]  = useState<string | null>(null);
    const [examMode,  setExamMode]  = useState<"online" | "onsite">("online");
    const [submitting, setSubmitting] = useState(false);
    const [error,     setError]     = useState<string | null>(null);
    const [done,      setDone]      = useState(false);

    const handleSubmit = async () => {
        if (!selected) return;
        try {
            setSubmitting(true);
            setError(null);
            await candidateNewApplication(selected, examMode);
            setDone(true);
            // Laisser 1.5 s d'affichage du succès puis fermer + refresh
            setTimeout(() => {
                onSuccess();
            }, 1500);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur lors de la soumission");
        } finally {
            setSubmitting(false);
        }
    };

    return (
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
                    {/* Header */}
                    <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#1a237e" }}>
                        <div className="flex items-center gap-2">
                            <PlusCircle className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">
                                Nouvelle demande de certification
                            </span>
                        </div>
                        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Corps */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-5">

                        {/* Écran succès */}
                        {done ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.92 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="py-8 flex flex-col items-center gap-4 text-center"
                            >
                                <div
                                    className="h-16 w-16 rounded-full flex items-center justify-center"
                                    style={{ backgroundColor: "#e8f5e9" }}
                                >
                                    <CheckCircle2 className="h-8 w-8" style={{ color: "#2e7d32" }} />
                                </div>
                                <div>
                                    <p className="font-black text-gray-800 text-lg">Demande soumise !</p>
                                    <p className="text-sm text-gray-500 mt-1">
                                        Votre candidature pour<br />
                                        <span className="font-bold text-gray-700">«&nbsp;{selected}&nbsp;»</span>
                                        <br />a bien été enregistrée.
                                    </p>
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                {/* Sélection certification */}
                                <div>
                                    <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                        Choisissez la certification
                                    </p>
                                    {available.length === 0 ? (
                                        <div className="text-center py-8 text-sm text-gray-400">
                                            Vous avez déjà candidaté à toutes les certifications disponibles.
                                        </div>
                                    ) : (
                                        <ul className="space-y-2">
                                            {available.map(cert => {
                                                const isSelected = selected === cert;
                                                return (
                                                    <li key={cert}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelected(cert)}
                                                            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                                                            style={{
                                                                backgroundColor: isSelected ? "#e8eaf6" : "#f8f9ff",
                                                                border: `2px solid ${isSelected ? "#1a237e" : "#e8eaf6"}`,
                                                            }}
                                                        >
                                                            <div
                                                                className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                                                                style={{
                                                                    borderColor: isSelected ? "#1a237e" : "#d1d5db",
                                                                    backgroundColor: isSelected ? "#1a237e" : "transparent",
                                                                }}
                                                            >
                                                                {isSelected && (
                                                                    <div className="h-2 w-2 rounded-full bg-white" />
                                                                )}
                                                            </div>
                                                            <span
                                                                className="text-sm font-semibold flex-1 leading-snug"
                                                                style={{ color: isSelected ? "#1a237e" : "#374151" }}
                                                            >
                                                                {cert}
                                                            </span>
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    )}
                                </div>

                                {/* Mode d'examen */}
                                {available.length > 0 && (
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                            Mode d&apos;examen
                                        </p>
                                        <div className="flex gap-3">
                                            {([
                                                { value: "online",  label: "En ligne",     Icon: MonitorSmartphone },
                                                { value: "onsite",  label: "Présentiel",   Icon: MapPin            },
                                            ] as const).map(({ value, label, Icon }) => {
                                                const isActive = examMode === value;
                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => setExamMode(value)}
                                                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all"
                                                        style={{
                                                            backgroundColor: isActive ? "#1a237e" : "#f8f9ff",
                                                            color:           isActive ? "#fff"    : "#555",
                                                            border:          `2px solid ${isActive ? "#1a237e" : "#e8eaf6"}`,
                                                        }}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                        {label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Erreur */}
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                                        className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    {!done && available.length > 0 && (
                        <div className="px-6 py-4 shrink-0 flex gap-3" style={{ borderTop: "2px solid #e8eaf6", backgroundColor: "#fafbff" }}>
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                                style={{ borderColor: "#e0e0e0", color: "#555" }}
                            >
                                Annuler
                            </button>
                            <button
                                disabled={!selected || submitting}
                                onClick={handleSubmit}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                style={{ backgroundColor: "#2e7d32", boxShadow: selected ? "0 6px 16px rgba(46,125,50,0.25)" : "none" }}
                            >
                                {submitting
                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</>
                                    : "Valider ma candidature"
                                }
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function TableauDeBordPage() {
    const { dossier, dossiers, loading, refresh } = useCandidate();
    const [exams,     setExams]     = useState<CandidateExam[]>([]);
    const [now,       setNow]       = useState(Date.now());
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

    const displayName   = dossier.name  || "Candidat";
    const existingCerts = dossiers
        .map(d => d.answers?.["Certification souhaitée"])
        .filter(Boolean) as string[];

    const handleModalSuccess = () => {
        setShowModal(false);
        refresh();
    };

    return (
        <div className="space-y-8 py-4">

            {/* ── En-tête avec bouton Nouvelle demande de certification ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                    Tableau de bord
                </p>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <h1 className="text-3xl font-black leading-tight" style={{ color: "#1a237e" }}>
                        Bonjour,&nbsp;{displayName}&nbsp;👋
                    </h1>
                    <button
                        onClick={() => setShowModal(true)}
                        className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0"
                        style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
                    >
                        <PlusCircle className="h-4 w-4" />
                        Nouvelle demande de certification
                    </button>
                </div>
            </motion.div>

            {/* ── Mes demandes ── */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="space-y-3"
            >
                <div className="flex items-center gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                        <Layers className="h-4 w-4" style={{ color: "#1a237e" }} />
                        Mes demandes
                    </h2>
                    {dossiers.length > 0 && (
                        <span
                            className="text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            {dossiers.length}
                        </span>
                    )}
                </div>

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
                    <div className="space-y-2">
                        {dossiers.map((d, i) => (
                            <DossierCard key={d._id} d={d} delay={i * 0.04} now={now} exams={exams} />
                        ))}
                    </div>
                )}
            </motion.div>

            {/* ── Modal Nouvelle formation ── */}
            <AnimatePresence>
                {showModal && (
                    <NouvelleFormationModal
                        existingCerts={existingCerts}
                        onClose={() => setShowModal(false)}
                        onSuccess={handleModalSuccess}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
