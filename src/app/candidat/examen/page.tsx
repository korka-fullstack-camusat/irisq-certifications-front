"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
    BookOpen, Clock, CalendarDays, ShieldCheck, Loader2,
    PlayCircle, Lock, AlertTriangle, ShieldAlert, Maximize,
    FileText, CheckCircle2, Monitor, Play, ChevronLeft,
    ChevronRight, Send, X, PhoneCall,
} from "lucide-react";
import { useCandidate } from "@/lib/candidate-context";
import { fetchCandidateExam, uploadFiles, submitExamWithAntiCheat, reportExamBlocked, candidateMe, type CandidateExam } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";

// ── Constants ─────────────────────────────────────────────────────────────────
const EXAM_SESSION_KEY = "irisq_exam_active";
const QUESTIONS_PER_PAGE = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDateTime(iso: string) {
    try {
        return new Date(iso).toLocaleString("fr-FR", {
            weekday: "long", day: "2-digit", month: "long",
            year: "numeric", hour: "2-digit", minute: "2-digit",
        });
    } catch { return iso; }
}

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
    return `${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

/** Calcule le temps restant en secondes en tenant compte du décalage du candidat. */
function computeInitialTimer(exam: CandidateExam): number {
    if (exam.start_time && exam.duration_minutes) {
        const endTime = new Date(exam.start_time).getTime() + exam.duration_minutes * 60 * 1000;
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        return Math.max(1, remaining);
    }
    return (exam.duration_minutes ?? 120) * 60;
}

function Countdown({ targetIso }: { targetIso: string }) {
    const [diff, setDiff] = useState(() => new Date(targetIso).getTime() - Date.now());
    useEffect(() => {
        const id = setInterval(() => setDiff(new Date(targetIso).getTime() - Date.now()), 1000);
        return () => clearInterval(id);
    }, [targetIso]);
    if (diff <= 0) return null;
    const tot = Math.floor(diff / 1000);
    const d = Math.floor(tot / 86400), h = Math.floor((tot % 86400) / 3600);
    const m = Math.floor((tot % 3600) / 60), s = tot % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
        <div className="flex items-center justify-center gap-3 mt-4 flex-wrap">
            {d > 0 && <><div className="flex flex-col items-center"><span className="text-2xl font-black" style={{ color: "#1a237e" }}>{d}</span><span className="text-[10px] uppercase tracking-widest text-gray-400">j</span></div><span className="text-gray-300 text-xl">:</span></>}
            <div className="flex flex-col items-center"><span className="text-2xl font-black" style={{ color: "#1a237e" }}>{pad(h)}</span><span className="text-[10px] uppercase tracking-widest text-gray-400">h</span></div>
            <span className="text-gray-300 text-xl">:</span>
            <div className="flex flex-col items-center"><span className="text-2xl font-black" style={{ color: "#1a237e" }}>{pad(m)}</span><span className="text-[10px] uppercase tracking-widest text-gray-400">min</span></div>
            <span className="text-gray-300 text-xl">:</span>
            <div className="flex flex-col items-center"><span className="text-2xl font-black" style={{ color: "#1a237e" }}>{pad(s)}</span><span className="text-[10px] uppercase tracking-widest text-gray-400">sec</span></div>
        </div>
    );
}

// ── Types ─────────────────────────────────────────────────────────────────────
type Phase = "info" | "exam" | "finished" | "blocked" | "submitted";

// ═════════════════════════════════════════════════════════════════════════════
export default function CandidatExamenPage() {
    const { dossier, loading: dossierLoading, setExamActive } = useCandidate();

    const [exam, setExam] = useState<CandidateExam | null | undefined>(undefined);
    const [examLoading, setExamLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    const [phase, setPhase] = useState<Phase>("info");

    // Anti-cheat
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [cheatAlerts, setCheatAlerts] = useState<string[]>([]);
    const [warningVisible, setWarningVisible] = useState(false);
    const [lastWarningMsg, setLastWarningMsg] = useState("");
    const [candidatePhotos, setCandidatePhotos] = useState<string[]>([]);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    // Indique qu'on a déjà envoyé le rapport de blocage au serveur pour cette session
    const hasReportedBlock = useRef(false);

    const videoRefCallback = useCallback((node: HTMLVideoElement) => {
        videoRef.current = node;
        if (node && mediaStream) node.srcObject = mediaStream;
    }, [mediaStream]);

    // Answers, timer, pagination
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [timeLeft, setTimeLeft] = useState(120 * 60);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showExpiredModal, setShowExpiredModal] = useState(false);

    // ── Detect refresh during exam ──────────────────────────────────────────
    // On détecte le rechargement via sessionStorage. On ne signale PAS encore
    // le blocage au serveur — il faut d'abord vérifier si l'évaluateur a déjà
    // débloqué cet accès (exam_blocked === false) pour éviter le cycle de
    // re-blocage : débloque → candidat recharge → reportExamBlocked → re-bloque.
    useEffect(() => {
        if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(EXAM_SESSION_KEY) === "1") {
            setPhase("blocked");
        }
    }, []);

    // ── Reconciliation blocage local / état serveur ─────────────────────────
    // Règle : ne signaler le blocage au serveur QUE SI l'évaluateur n'a pas
    // déjà débloqué cet accès (exam_blocked !== false).
    useEffect(() => {
        // Attendre que le dossier soit chargé et que la phase soit "blocked"
        if (dossierLoading || phase !== "blocked") return;

        if (dossier?.exam_blocked === false) {
            // L'évaluateur a explicitement débloqué → on remet à zéro
            sessionStorage.removeItem(EXAM_SESSION_KEY);
            hasReportedBlock.current = false;
            setPhase("info");
        } else if (!hasReportedBlock.current) {
            // Premier passage sans déblocage évaluateur → on signale
            hasReportedBlock.current = true;
            reportExamBlocked("Rechargement de page pendant l'examen");
        }
    }, [dossier, dossierLoading, phase]);

    // ── Polling quand la phase est "blocked" ────────────────────────────────
    // Interroge le serveur toutes les 8 s pour détecter en temps réel si
    // l'évaluateur a débloqué l'accès, sans obliger le candidat à recharger.
    useEffect(() => {
        if (phase !== "blocked") return;

        const intervalId = setInterval(async () => {
            try {
                const updated = await candidateMe();
                if (updated.exam_blocked === false) {
                    sessionStorage.removeItem(EXAM_SESSION_KEY);
                    hasReportedBlock.current = false;
                    setPhase("info");
                }
            } catch {
                // Silencieux — on réessaiera au prochain tick
            }
        }, 8000);

        return () => clearInterval(intervalId);
    }, [phase]);

    // ── Masquer le sidebar pendant l'examen ────────────────────────────────
    useEffect(() => {
        setExamActive(phase === "exam");
        return () => setExamActive(false);
    }, [phase, setExamActive]);

    // ── Load exam data ──────────────────────────────────────────────────────
    useEffect(() => {
        fetchCandidateExam()
            .then(setExam)
            .catch(() => setExam(null))
            .finally(() => setExamLoading(false));
    }, []);

    // Clock for countdown to exam start
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, []);

    // ── Exam timer ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "exam" || timeLeft <= 0) return;
        const id = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) { clearInterval(id); handleAutoSubmit(); return 0; }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [phase, timeLeft]);

    // ── Camera monitor ──────────────────────────────────────────────────────
    useEffect(() => {
        if (phase !== "exam" || !mediaStream) return;
        const id = setInterval(() => {
            const tracks = mediaStream.getVideoTracks();
            if ((tracks.length === 0 || tracks[0].readyState === "ended") && isCameraActive) {
                setIsCameraActive(false);
                logCheatEvent("La webcam a été déconnectée ou désactivée.");
            }
        }, 1000);
        return () => clearInterval(id);
    }, [phase, mediaStream, isCameraActive]);

    // ── Anti-cheat event listeners ──────────────────────────────────────────
    const logCheatEvent = useCallback((message: string) => {
        const alertMsg = `[${new Date().toLocaleTimeString("fr-FR")}] ${message}`;
        setCheatAlerts(prev => [...prev, alertMsg]);
        setLastWarningMsg(message);
        setWarningVisible(true);
        setTimeout(() => setWarningVisible(false), 5000);
    }, []);

    useEffect(() => {
        const onVisibility = () => {
            if (phase === "exam" && document.visibilityState === "hidden")
                logCheatEvent("Perte de focus (changement d'onglet ou fenêtre minimisée détecté).");
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, [phase, logCheatEvent]);

    useEffect(() => {
        const onFs = () => {
            if (phase === "exam" && !document.fullscreenElement) {
                setIsFullscreen(false);
                logCheatEvent("Sortie du mode Plein Écran détectée.");
            }
        };
        document.addEventListener("fullscreenchange", onFs);
        return () => document.removeEventListener("fullscreenchange", onFs);
    }, [phase, logCheatEvent]);

    useEffect(() => {
        const block = (e: Event) => {
            if (phase === "exam") {
                e.preventDefault();
                logCheatEvent(`Tentative non autorisée : ${e.type === "contextmenu" ? "Clic Droit" : "Copier/Coller"}`);
            }
        };
        document.addEventListener("contextmenu", block);
        document.addEventListener("copy", block);
        document.addEventListener("paste", block);
        return () => {
            document.removeEventListener("contextmenu", block);
            document.removeEventListener("copy", block);
            document.removeEventListener("paste", block);
        };
    }, [phase, logCheatEvent]);

    // ── Camera helpers ──────────────────────────────────────────────────────
    const capturePhoto = async (label: string) => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.6));
        if (!blob) return;
        try {
            const fd = new FormData();
            fd.append("files", new File([blob], `${label}_${Date.now()}.jpg`, { type: "image/jpeg" }));
            const result = await uploadFiles(fd);
            if (result.file_urls?.[0]) setCandidatePhotos(prev => [...prev, result.file_urls[0]]);
        } catch (e) { console.error("Photo upload failed", e); }
    };

    const resumeFullscreen = async () => {
        try {
            const el = document.documentElement as any;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            setIsFullscreen(true);
        } catch { alert("Impossible de passer en plein écran."); }
    };

    const requestCameraReconnect = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setMediaStream(stream);
            if (videoRef.current) videoRef.current.srcObject = stream;
            setIsCameraActive(true);
            logCheatEvent("Webcam reconnectée avec succès.");
        } catch { alert("Impossible d'accéder à la webcam."); }
    };

    // ── Start exam ──────────────────────────────────────────────────────────
    const startExam = async () => {
        if (!dossier?.exam_token || !exam) return;

        // Période expirée → modal informatif, on n'enchaîne pas
        if (examExpired) {
            setShowExpiredModal(true);
            return;
        }

        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch {
            alert("L'accès à la webcam est obligatoire pour démarrer l'examen.");
            return;
        }
        setMediaStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
        setIsCameraActive(true);

        try {
            const el = document.documentElement as any;
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            setIsFullscreen(true);
        } catch {
            alert("Le mode Plein Écran est obligatoire pour démarrer l'examen.");
            stream.getTracks().forEach(t => t.stop());
            return;
        }

        // Compute timer with late-start coherence
        const durationSec = computeInitialTimer(exam);
        setTimeLeft(durationSec);

        // Init answers
        const init: Record<string, string> = {};
        (exam.parsed_questions || []).forEach(q => { init[q.id] = ""; });
        setAnswers(init);
        setCurrentPage(0);

        // Mark exam as in progress (refresh detection)
        sessionStorage.setItem(EXAM_SESSION_KEY, "1");

        setPhase("exam");

        // Photo captures
        setTimeout(() => capturePhoto("debut"), 2000);
        setTimeout(() => capturePhoto("milieu"), (durationSec / 2) * 1000);
    };

    // ── Submit helpers ──────────────────────────────────────────────────────
    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
    };

    const doSubmit = async () => {
        if (!dossier?.exam_token) return;
        setIsSubmitting(true);
        setShowSubmitModal(false);

        // Final photo
        let finalPhotoUrl: string | null = null;
        try {
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const ctx = canvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.6));
                    if (blob) {
                        const fd = new FormData();
                        fd.append("files", new File([blob], `fin_${Date.now()}.jpg`, { type: "image/jpeg" }));
                        const result = await uploadFiles(fd);
                        finalPhotoUrl = result.file_urls?.[0] || null;
                    }
                }
            }
        } catch (e) { console.error("Final photo fail", e); }

        const photos = finalPhotoUrl ? [...candidatePhotos, finalPhotoUrl] : [...candidatePhotos];
        const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({ question_id: qId, answer: ans }));

        try {
            await submitExamWithAntiCheat(dossier.exam_token, {
                exam_answers: formattedAnswers,
                cheat_alerts: cheatAlerts,
                candidate_photos: photos,
            });
            sessionStorage.removeItem(EXAM_SESSION_KEY);
            setPhase("finished");
            if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
            stopCamera();
        } catch {
            alert("Une erreur est survenue lors de la soumission. Veuillez réessayer.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Auto-submit when timer hits 0
    const handleAutoSubmit = () => { doSubmit(); };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    const isLoading = dossierLoading || examLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    // ── Déjà soumis (depuis le serveur) ────────────────────────────────────
    if (dossier?.exam_status === "submitted" || dossier?.exam_status === "graded") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-10 max-w-md w-full text-center border shadow-xl" style={{ borderColor: "#e0e0e0" }}>
                    <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black mb-3" style={{ color: "#1a237e" }}>Copie déjà soumise</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Votre copie a bien été transmise au correcteur.<br />
                        Merci de patienter — vous recevrez vos résultats par email dès que la correction sera terminée.
                    </p>
                </motion.div>
            </div>
        );
    }

    // ── Bloqué après un refresh ─────────────────────────────────────────────
    if (phase === "blocked") {
        // Render guard : si le serveur dit que l'accès est débloqué
        // (exam_blocked === false), on ne montre PAS l'écran bloqué.
        // La reconciliation va mettre à jour phase → "info" dans le prochain cycle.
        if (!dossierLoading && dossier?.exam_blocked === false) {
            return (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl p-10 max-w-md w-full text-center border-t-4 border-rose-600 shadow-xl"
                >
                    <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Lock className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black mb-3 text-rose-700">Accès bloqué</h2>
                    <p className="text-gray-600 text-sm leading-relaxed mb-6">
                        Votre session d&apos;examen a été interrompue suite à un rechargement de page.<br />
                        Pour des raisons de sécurité, l&apos;accès à l&apos;épreuve est désormais verrouillé.
                    </p>

                    {/* Message contactez le responsable */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3 text-left mb-4">
                        <PhoneCall className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-800 font-medium">
                            Veuillez contacter le responsable IRISQ pour débloquer votre accès et obtenir une nouvelle session.
                        </p>
                    </div>

                    {/* Indicateur de surveillance automatique */}
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />
                        <span>Vérification automatique en cours… Cette page se mettra à jour dès que votre accès sera rétabli.</span>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── Terminé ─────────────────────────────────────────────────────────────
    if (phase === "finished") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-10 max-w-md w-full text-center border shadow-xl" style={{ borderColor: "#e0e0e0" }}>
                    <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black mb-3" style={{ color: "#1a237e" }}>Examen terminé</h2>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Votre copie a été transmise au correcteur de manière sécurisée.<br />
                        Merci de patienter — vos résultats vous seront communiqués par email.
                    </p>
                </motion.div>
            </div>
        );
    }

    // ── Pas d'examen ────────────────────────────────────────────────────────
    if (!exam) {
        return (
            <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center">
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

    const hasToken   = !!dossier?.exam_token;
    const startTime  = exam.start_time;

    // L'examen a-t-il commencé ?
    const examStarted = !startTime || new Date(startTime).getTime() <= now;

    // La période d'examen est-elle expirée ?
    // Expirée = start_time + duration_minutes < maintenant
    const examExpired =
        !!startTime &&
        !!exam.duration_minutes &&
        new Date(startTime).getTime() + exam.duration_minutes * 60 * 1000 < now;

    const canStart = hasToken && examStarted;

    // ── Page INFO ────────────────────────────────────────────────────────────
    if (phase === "info") {
        return (
            <>
                <div className="space-y-6">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
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

                            {startTime && !examStarted && (
                                <div className="border border-amber-200 rounded-xl p-5 text-center" style={{ backgroundColor: "#fffbeb" }}>
                                    <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">L&apos;examen commence dans</p>
                                    <Countdown targetIso={startTime} />
                                </div>
                            )}

                            <div className="rounded-xl p-4" style={{ backgroundColor: "#fff1f2", borderLeft: "4px solid #e11d48" }}>
                                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#be123c" }}>Règles importantes</p>
                                <ul className="text-xs space-y-1 pl-4 list-disc" style={{ color: "#9f1239" }}>
                                    <li>L&apos;examen se déroule en plein écran obligatoirement.</li>
                                    <li>Toute sortie du plein écran ou changement d&apos;onglet sera enregistré.</li>
                                    <li>Le rechargement de la page entraîne le verrouillage immédiat de votre accès.</li>
                                    <li>Le compte à rebours ne peut pas être mis en pause.</li>
                                    <li>Assurez-vous d&apos;avoir une connexion internet stable avant de commencer.</li>
                                </ul>
                            </div>

                            {!hasToken && (
                                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200" style={{ backgroundColor: "#fffbeb" }}>
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-amber-700 text-xs">Votre accès à l&apos;examen n&apos;a pas encore été activé par l&apos;évaluateur.</p>
                                </div>
                            )}
                            {hasToken && !examStarted && (
                                <button disabled className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white opacity-50 cursor-not-allowed" style={{ backgroundColor: "#1a237e" }}>
                                    <Lock className="h-4 w-4" />Examen pas encore ouvert
                                </button>
                            )}
                            {canStart && (
                                <button onClick={startExam} className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5" style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.3)" }}>
                                    <PlayCircle className="h-4 w-4" />Commencer l&apos;examen
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>

                {/* ── Modal période expirée ── */}
                <AnimatePresence>
                    {showExpiredModal && (
                        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                onClick={() => setShowExpiredModal(false)}
                            />
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0, y: 16 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.9, opacity: 0, y: 16 }}
                                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                            >
                                <div className="px-6 py-4 flex items-center justify-between border-t-4 border-rose-600" style={{ backgroundColor: "#fff1f2" }}>
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-rose-600" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-rose-700">Période expirée</span>
                                    </div>
                                    <button onClick={() => setShowExpiredModal(false)} className="text-rose-400 hover:text-rose-700 transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="px-6 py-8 text-center">
                                    <div className="h-16 w-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-5">
                                        <AlertTriangle className="h-8 w-8 text-rose-600" />
                                    </div>
                                    <h3 className="font-black text-gray-800 text-lg mb-2">La période d&apos;examen est déjà écoulée</h3>
                                    <p className="text-sm text-gray-500 leading-relaxed mb-6">
                                        Le délai imparti pour cette épreuve est dépassé.<br />
                                        Veuillez contacter le responsable IRISQ.
                                    </p>
                                    <button
                                        onClick={() => setShowExpiredModal(false)}
                                        className="w-full py-3 rounded-xl text-sm font-bold text-white"
                                        style={{ backgroundColor: "#1a237e" }}
                                    >
                                        Fermer
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </>
        );
    }

    // ── EXAM phase (plein écran complet, couvre le sidebar) ──────────────────
    const questions = exam.parsed_questions || [];
    const totalPages = questions.length > 0 ? Math.ceil(questions.length / QUESTIONS_PER_PAGE) : 1;
    const pageQuestions = questions.slice(currentPage * QUESTIONS_PER_PAGE, (currentPage + 1) * QUESTIONS_PER_PAGE);
    const isLastPage = currentPage === totalPages - 1;
    const answeredCount = Object.values(answers).filter(v => v !== "" && v !== "<p></p>").length;

    // Camera disconnected
    if (!isCameraActive) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full text-center border-t-4 border-rose-500 shadow-2xl">
                    <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><Monitor className="h-8 w-8" /></div>
                    <h2 className="text-2xl font-black mb-3 text-slate-900">Webcam Requise</h2>
                    <p className="text-slate-600 mb-6">La webcam est désactivée. <strong>Cet incident a été signalé.</strong></p>
                    <button onClick={requestCameraReconnect} className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2" style={{ backgroundColor: "#1a237e" }}>
                        <Play className="h-5 w-5" />Réactiver la webcam
                    </button>
                </motion.div>
            </div>
        );
    }

    // Fullscreen exited
    if (!isFullscreen) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full text-center border-t-4 border-rose-500 shadow-2xl">
                    <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6"><Monitor className="h-8 w-8" /></div>
                    <h2 className="text-2xl font-black mb-3 text-slate-900">Mode Plein Écran Requis</h2>
                    <p className="text-slate-600 mb-6">Vous avez quitté le plein écran. <strong>Cet incident a été signalé.</strong></p>
                    <button onClick={resumeFullscreen} className="w-full text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2" style={{ backgroundColor: "#1a237e" }}>
                        <Maximize className="h-5 w-5" />Reprendre en plein écran
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <>
            {/* ── Plein écran — couvre tout le layout + sidebar ── */}
            <div className="fixed inset-0 z-[200] flex flex-col font-sans" style={{ backgroundColor: "#f4f6f9" }}>

                {/* Warning overlay */}
                <AnimatePresence>
                    {warningVisible && (
                        <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }} className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4">
                            <AlertTriangle className="h-6 w-6 text-rose-100" />
                            <div>
                                <p className="font-black text-sm uppercase tracking-wider">Action Non Autorisée</p>
                                <p className="text-sm opacity-90">{lastWarningMsg}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Top bar */}
                <div className="bg-white border-b shadow-sm px-6 py-3 flex items-center justify-between shrink-0" style={{ borderColor: "#e0e0e0", zIndex: 10 }}>
                    <div className="flex items-center gap-3">
                        <Image src="/logo.png" alt="IRISQ" width={44} height={44} className="object-contain drop-shadow-md" priority />
                        <div className="h-4 w-px bg-gray-200" />
                        <p className="text-gray-700 font-bold text-sm hidden sm:block">{exam.title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {!isFullscreen && (
                            <button onClick={resumeFullscreen} className="text-rose-600 text-xs font-bold bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse border border-rose-200">
                                <Maximize className="h-3 w-3" />Plein Écran
                            </button>
                        )}
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold font-mono text-base shadow-sm ${timeLeft < 300 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-gray-50 text-gray-800 border border-gray-200"}`}>
                            <Clock className={`h-4 w-4 ${timeLeft < 300 ? "text-rose-600 animate-pulse" : "text-gray-500"}`} />
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>

                {/* Main content */}
                <div className="flex-1 overflow-auto p-4 lg:p-8 flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto w-full">

                    {/* Questions panel */}
                    <div className="flex-[3] bg-white rounded-2xl shadow-sm border flex flex-col" style={{ borderColor: "#c5cae9" }}>
                        {/* Panel header */}
                        <div className="px-5 py-3 border-b flex items-center justify-between shrink-0" style={{ backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}>
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-[#1a237e]" />
                                <h2 className="font-black text-sm uppercase tracking-wider text-[#1a237e]">Sujet d&apos;Examen</h2>
                            </div>
                            {questions.length > 0 && (
                                <span className="text-xs font-bold bg-[#1a237e] text-white px-2 py-1 rounded-md">
                                    Page {currentPage + 1} / {totalPages} — {questions.length} question{questions.length > 1 ? "s" : ""}
                                </span>
                            )}
                        </div>

                        {/* Questions list (paginated) */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {questions.length === 0 ? (
                                <div className="flex flex-col gap-2">
                                    <h3 className="text-sm font-bold text-gray-700">Votre Copie <span className="text-xs font-normal text-gray-500">(rédigez ci-dessous)</span></h3>
                                    <RichTextEditor
                                        value={answers["general_text"] || ""}
                                        onChange={html => setAnswers(prev => ({ ...prev, general_text: html }))}
                                        placeholder="Rédigez vos réponses ici — texte formaté, tableaux, listes…"
                                        minHeight="280px"
                                    />
                                </div>
                            ) : (
                                pageQuestions.map((q, idx) => {
                                    const globalIdx = currentPage * QUESTIONS_PER_PAGE + idx + 1;
                                    return (
                                        <div key={q.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#f8f9fa" }}>
                                                <span className="text-xs font-black text-[#1a237e] uppercase tracking-wide">Question {globalIdx}</span>
                                                {q.part && <span className="text-[10px] text-gray-400 font-medium">{q.part}</span>}
                                                {q.type === "qcm" && <span className="text-[9px] bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full uppercase">QCM</span>}
                                            </div>
                                            <div className="p-4 space-y-3">
                                                <p className="text-gray-900 font-medium text-sm whitespace-pre-wrap">{q.text}</p>
                                                {q.type === "qcm" ? (
                                                    <div className="space-y-2">
                                                        {q.options?.map((opt, i) => (
                                                            <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === opt ? "bg-[#e8eaf6] border-[#1a237e]" : "bg-gray-50 border-transparent hover:bg-gray-100"}`}>
                                                                <input type="radio" name={`q_${q.id}`} className="mt-0.5" checked={answers[q.id] === opt} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} />
                                                                <span className="text-sm font-medium text-gray-800">{opt}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <RichTextEditor
                                                        value={answers[q.id] || ""}
                                                        onChange={html => setAnswers(prev => ({ ...prev, [q.id]: html }))}
                                                        placeholder="Rédigez votre réponse — texte, tableaux, listes…"
                                                        minHeight="120px"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Pagination bar */}
                        {questions.length > QUESTIONS_PER_PAGE && (
                            <div className="px-5 py-3 border-t flex items-center justify-between shrink-0" style={{ borderColor: "#e8eaf6", backgroundColor: "#f8f9fa" }}>
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                                    disabled={currentPage === 0}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors text-gray-700"
                                >
                                    <ChevronLeft className="h-4 w-4" />Précédent
                                </button>

                                <div className="flex items-center gap-1.5">
                                    {Array.from({ length: totalPages }, (_, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setCurrentPage(i)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${currentPage === i ? "bg-[#1a237e] text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]"}`}
                                        >
                                            {i + 1}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={isLastPage}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition-colors text-gray-700"
                                >
                                    Suivant<ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Right panel: progress + submit */}
                    <div className="lg:w-64 flex flex-col gap-4 shrink-0">
                        {/* Progress */}
                        <div className="bg-white rounded-2xl shadow-sm border p-5" style={{ borderColor: "#c5cae9" }}>
                            <h3 className="text-xs font-black uppercase tracking-wider text-[#1a237e] mb-3">Progression</h3>
                            {questions.length > 0 && (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs text-gray-500">Réponses saisies</span>
                                        <span className="font-black text-[#1a237e]">{answeredCount}/{questions.length}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{ width: `${(answeredCount / questions.length) * 100}%`, backgroundColor: "#2e7d32" }}
                                        />
                                    </div>
                                    {questions.length > QUESTIONS_PER_PAGE && (
                                        <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(totalPages, 5)}, 1fr)` }}>
                                            {Array.from({ length: totalPages }, (_, i) => {
                                                const start = i * QUESTIONS_PER_PAGE;
                                                const pageAnswered = questions
                                                    .slice(start, start + QUESTIONS_PER_PAGE)
                                                    .every(q => answers[q.id] && answers[q.id] !== "<p></p>");
                                                return (
                                                    <button key={i} onClick={() => setCurrentPage(i)} className={`h-6 rounded text-[10px] font-bold transition-colors ${currentPage === i ? "bg-[#1a237e] text-white" : pageAnswered ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                                        P{i + 1}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Submit */}
                        <div className="bg-white rounded-2xl shadow-sm border p-5" style={{ borderColor: "#c5cae9" }}>
                            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                Une fois soumise, votre copie ne pourra plus être modifiée. Vérifiez toutes vos réponses avant de valider.
                            </p>
                            <button
                                onClick={() => setShowSubmitModal(true)}
                                disabled={isSubmitting}
                                className="w-full py-3 text-white rounded-xl font-black transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                style={{ backgroundColor: "#1a237e" }}
                            >
                                {isSubmitting
                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</>
                                    : <><Send className="h-4 w-4" />Soumettre</>
                                }
                            </button>
                        </div>
                    </div>
                </div>

                {/* Webcam overlay */}
                <div className={`fixed bottom-4 right-4 z-[210] rounded-xl overflow-hidden shadow-2xl border border-gray-600 w-40 h-28 bg-black transition-all ${isCameraActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                    <video ref={videoRefCallback} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                    <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/60 px-1.5 py-0.5 rounded text-[9px] font-bold text-white uppercase tracking-wider">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />REC
                    </div>
                </div>
                <canvas ref={canvasRef} style={{ display: "none" }} />
            </div>

            {/* ── Modal de confirmation de soumission ── */}
            <AnimatePresence>
                {showSubmitModal && (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && setShowSubmitModal(false)} />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 16 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 16 }}
                            className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
                        >
                            <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                                <div className="flex items-center gap-2">
                                    <Send className="h-4 w-4 text-white/80" />
                                    <span className="text-sm font-bold uppercase tracking-widest text-white">Confirmer la soumission</span>
                                </div>
                                <button onClick={() => !isSubmitting && setShowSubmitModal(false)} disabled={isSubmitting} className="text-white/60 hover:text-white transition-colors disabled:opacity-40">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="px-6 py-6 text-center">
                                <div className="h-14 w-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="h-7 w-7 text-amber-500" />
                                </div>
                                <h3 className="font-black text-gray-800 mb-2">Soumettre votre copie ?</h3>
                                <p className="text-sm text-gray-500 mb-1">
                                    Vous avez répondu à <span className="font-bold text-[#1a237e]">{answeredCount}</span> question{answeredCount !== 1 ? "s" : ""} sur <span className="font-bold">{questions.length || 1}</span>.
                                </p>
                                <p className="text-xs text-gray-400 mb-6">Cette action est <strong>irréversible</strong>. Votre copie sera transmise immédiatement au correcteur.</p>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSubmitModal(false)}
                                        disabled={isSubmitting}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50 disabled:opacity-50"
                                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={doSubmit}
                                        disabled={isSubmitting}
                                        className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 flex items-center justify-center gap-2"
                                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                                    >
                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><CheckCircle2 className="h-4 w-4" />Confirmer</>}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
