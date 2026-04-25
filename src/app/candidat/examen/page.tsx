"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
    BookOpen,
    Clock,
    CalendarDays,
    ShieldCheck,
    Loader2,
    PlayCircle,
    Lock,
    AlertTriangle,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExam, type CandidateExam } from "@/lib/api";

function formatDateTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleString("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return iso;
    }
}

function useCountdown(targetIso: string | undefined) {
    const [diff, setDiff] = useState<number>(() =>
        targetIso ? new Date(targetIso).getTime() - Date.now() : 0
    );

    useEffect(() => {
        if (!targetIso) return;
        const id = setInterval(() => {
            setDiff(new Date(targetIso).getTime() - Date.now());
        }, 1000);
        return () => clearInterval(id);
    }, [targetIso]);

    return diff;
}

function Countdown({ targetIso }: { targetIso: string }) {
    const diff = useCountdown(targetIso);
    if (diff <= 0) return null;

    const totalSec = Math.floor(diff / 1000);
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    const pad = (n: number) => String(n).padStart(2, "0");

    return (
        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            {days > 0 && (
                <div className="flex flex-col items-center">
                    <span className="text-2xl font-black" style={{ color: "#1a237e" }}>{days}</span>
                    <span className="text-[10px] uppercase tracking-widest text-gray-400">jour{days > 1 ? "s" : ""}</span>
                </div>
            )}
            {days > 0 && <span className="text-gray-300 text-xl font-light">:</span>}
            <div className="flex flex-col items-center">
                <span className="text-2xl font-black" style={{ color: "#1a237e" }}>{pad(hours)}</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-400">heure{hours > 1 ? "s" : ""}</span>
            </div>
            <span className="text-gray-300 text-xl font-light">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-black" style={{ color: "#1a237e" }}>{pad(mins)}</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-400">min</span>
            </div>
            <span className="text-gray-300 text-xl font-light">:</span>
            <div className="flex flex-col items-center">
                <span className="text-2xl font-black" style={{ color: "#1a237e" }}>{pad(secs)}</span>
                <span className="text-[10px] uppercase tracking-widest text-gray-400">sec</span>
            </div>
        </div>
    );
}

export default function CandidatExamenPage() {
    const { dossier, loading: dossierLoading } = useCandidate();
    const [exam, setExam] = useState<CandidateExam | null | undefined>(undefined);
    const [examLoading, setExamLoading] = useState(true);

    useEffect(() => {
        fetchCandidateExam()
            .then(setExam)
            .catch(() => setExam(null))
            .finally(() => setExamLoading(false));
    }, []);

    const isLoading = dossierLoading || examLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!exam) {
        return (
            <div className="space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center"
                >
                    <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#e8eaf6" }}>
                        <BookOpen className="h-8 w-8" style={{ color: "#1a237e" }} />
                    </div>
                    <h1 className="text-xl font-black mb-2" style={{ color: "#1a237e" }}>Aucun examen planifié</h1>
                    <p className="text-sm text-gray-500">
                        Aucun examen n&apos;a encore été programmé pour votre certification.<br />
                        Vous recevrez un email dès qu&apos;un examen sera disponible.
                    </p>
                </motion.div>
            </div>
        );
    }

    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    const hasToken = !!dossier?.exam_token;
    const startTime = exam.start_time;
    const examStarted = !startTime || new Date(startTime).getTime() <= now;
    const canStart = hasToken && examStarted;

    return (
        <div className="space-y-6">
            {/* Header card */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
            >
                <div className="px-6 py-4 flex items-center gap-3" style={{ backgroundColor: "#1a237e" }}>
                    <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                        <BookOpen className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold tracking-[0.2em] text-white/60 uppercase">Épreuve Technique</p>
                        <h1 className="text-base font-black text-white">{exam.title || "Examen"}</h1>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    {/* Infos */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#f4f6f9" }}>
                            <ShieldCheck className="h-5 w-5 shrink-0" style={{ color: "#1a237e" }} />
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certification</p>
                                <p className="text-xs font-bold text-gray-800 leading-snug">{exam.certification}</p>
                            </div>
                        </div>

                        {exam.duration_minutes && (
                            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#f4f6f9" }}>
                                <Clock className="h-5 w-5 shrink-0" style={{ color: "#2e7d32" }} />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Durée</p>
                                    <p className="text-xs font-bold text-gray-800">{exam.duration_minutes} minutes</p>
                                </div>
                            </div>
                        )}

                        {startTime && (
                            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#f4f6f9" }}>
                                <CalendarDays className="h-5 w-5 shrink-0" style={{ color: "#b45309" }} />
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Début</p>
                                    <p className="text-xs font-bold text-gray-800">{formatDateTime(startTime)}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Countdown if not yet started */}
                    {startTime && !examStarted && (
                        <div className="border border-amber-200 rounded-xl p-5 text-center" style={{ backgroundColor: "#fffbeb" }}>
                            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">L&apos;examen commence dans</p>
                            <Countdown targetIso={startTime} />
                        </div>
                    )}

                    {/* Rules */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: "#fff1f2", borderLeft: "4px solid #e11d48" }}>
                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#be123c" }}>Règles importantes</p>
                        <ul className="text-xs space-y-1 pl-4 list-disc" style={{ color: "#9f1239" }}>
                            <li>L&apos;examen se déroule en plein écran obligatoirement.</li>
                            <li>Toute sortie du plein écran ou changement d&apos;onglet sera enregistré.</li>
                            <li>Le compte à rebours ne peut pas être mis en pause.</li>
                            <li>Assurez-vous d&apos;avoir une connexion internet stable avant de commencer.</li>
                        </ul>
                    </div>

                    {/* Action area */}
                    {!hasToken && (
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 text-sm" style={{ backgroundColor: "#fffbeb" }}>
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-amber-700 text-xs">
                                Votre lien d&apos;accès à l&apos;examen n&apos;a pas encore été activé. L&apos;évaluateur doit publier l&apos;examen pour vous envoyer votre accès personnel.
                            </p>
                        </div>
                    )}

                    {hasToken && !examStarted && (
                        <button
                            disabled
                            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white opacity-50 cursor-not-allowed"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            <Lock className="h-4 w-4" />
                            Examen pas encore ouvert
                        </button>
                    )}

                    {canStart && (
                        <a
                            href={`/examen/${dossier!.exam_token}`}
                            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                            style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.3)" }}
                        >
                            <PlayCircle className="h-4 w-4" />
                            Commencer l&apos;examen
                        </a>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
