"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import {
    BookOpen, Clock, CalendarDays, ShieldCheck, Loader2,
    PlayCircle, Lock, AlertTriangle, Maximize,
    FileText, CheckCircle2, Monitor, Play, ChevronLeft,
    ChevronRight, Send, X, Trophy,
} from "lucide-react";
import { useCandidate } from "@/lib/candidate-context";
import { API_URL, fetchCandidateExam, fetchCandidateExams, ensureExamContent, uploadFiles, submitExamWithAntiCheat, type CandidateExam, type CandidateDossier } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";


// ── Constants ─────────────────────────────────────────────────────────────────
const EXAM_SESSION_KEY = "irisq_exam_active";
const QUESTIONS_PER_PAGE = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Vérifie qu'une chaîne HTML contient du texte visible réel
 * (et non uniquement des balises / &nbsp; / espaces).
 * Un HTML "whitespace-only" est produit par pdfplumber sur un PDF scanné :
 * il est truthy mais son rendu est complètement vide.
 */
function hasVisibleContent(html: string | undefined | null): boolean {
    if (!html) return false;
    const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, '').trim();
    return text.length > 0;
}

/** Convertit un chemin relatif (/api/files/…) en URL absolue vers le backend. */
function resolveDocUrl(raw: string | undefined | null): string {
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const base = API_URL.replace(/\/api\/?$/, "");
    return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

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

/** Calcule la durée initiale du timer en secondes (pleine durée — pas d'heure fixe). */
function computeInitialTimer(exam: CandidateExam): number {
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
type Phase = "select" | "info" | "exam" | "review" | "finished" | "blocked" | "submitted";

// ═════════════════════════════════════════════════════════════════════════════
export default function CandidatExamenPage() {
    const { dossier, dossiers, loading: dossierLoading, setExamActive, setActiveDossierId, refresh } = useCandidate();

    const [exam, setExam] = useState<CandidateExam | null | undefined>(undefined);
    const [examLoading, setExamLoading] = useState(true);
    const [allExams, setAllExams] = useState<CandidateExam[]>([]);
    const [allExamsLoading, setAllExamsLoading] = useState(true);
    const [now, setNow] = useState(Date.now());
    // Toujours démarrer sur "select" — le blocage par rechargement est désactivé pour l'instant
    const [phase, setPhase] = useState<Phase>("select");
    // Bump to force a re-fetch of the active exam
    const [examKey, setExamKey] = useState(0);

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
    // Re-parsing automatique si exam_content_html est vide (document non converti)
    const [isReparsing, setIsReparsing] = useState(false);
    // Nombre de blocs de réponse libres quand aucune question n'est parsée
    const [freeAnswerCount, setFreeAnswerCount] = useState(5);

    // ── Blocage par rechargement désactivé ─────────────────────────────────
    // Le blocage anti-rechargement est temporairement désactivé pour permettre
    // de tester l'affichage du document d'examen sans contrainte.
    // La sessionStorage key est nettoyée au montage pour ne pas bloquer les
    // candidats qui étaient déjà bloqués avant ce changement.
    useEffect(() => {
        sessionStorage.removeItem(EXAM_SESSION_KEY);
    }, []);

    // ── Masquer le sidebar pendant l'examen ────────────────────────────────
    useEffect(() => {
        setExamActive(phase === "exam");
        return () => setExamActive(false);
    }, [phase, setExamActive]);

    // ── Génération automatique du contenu HTML si absent ──────────────────
    // Déclenché dès que la phase "exam" démarre et que exam_content_html est vide/whitespace.
    // - Pour un DOCX : le re-parse produit un HTML riche → on affiche un spinner pendant l'attente.
    // - Pour un PDF  : l'iframe affiche le fichier immédiatement pendant que le re-parse tourne
    //                  en arrière-plan ; si le PDF contient du texte sélectionnable, le résultat
    //                  HTML remplacera l'iframe à la prochaine render.
    useEffect(() => {
        if (phase !== "exam" || !exam || hasVisibleContent(exam.exam_content_html) || !exam._id) return;

        // Détecter le format via le paramètre ?n= de document_url
        const nParam = (exam.document_url || "").split("?n=")[1] || "";
        const name   = decodeURIComponent(nParam).toLowerCase();
        const isDocx = name.endsWith(".docx") || name.endsWith(".doc");

        if (isDocx) {
            // DOCX → afficher le spinner le temps de la conversion HTML
            setIsReparsing(true);
            ensureExamContent(exam._id)
                .then(updated => { if (updated) setExam(updated); })
                .catch(() => {})
                .finally(() => setIsReparsing(false));
        } else {
            // PDF / autre → l'iframe affiche le fichier directement ; re-parse en arrière-plan
            ensureExamContent(exam._id)
                .then(updated => { if (updated) setExam(updated); })
                .catch(() => {});
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, exam?._id]);

    // ── Auto-arrêt caméra + plein écran si la copie est déjà soumise ───────
    // Se déclenche si exam_status passe à "submitted"/"graded" pendant l'examen
    // (ex : soumission depuis un autre appareil, ou double-soumission détectée).
    useEffect(() => {
        const alreadyDone =
            dossier?.exam_status === "submitted" || dossier?.exam_status === "graded";
        if (!alreadyDone) return;
        if (mediaStream) {
            mediaStream.getTracks().forEach(t => t.stop());
            setMediaStream(null);
            setIsCameraActive(false);
        }
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        sessionStorage.removeItem(EXAM_SESSION_KEY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dossier?.exam_status]);

    // ── Cleanup caméra au démontage du composant ───────────────────────────
    useEffect(() => {
        return () => {
            if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mediaStream]);

    // ── Load all exams (for overview listing) ────────────────────────────────
    useEffect(() => {
        setAllExamsLoading(true);
        fetchCandidateExams()
            .then(setAllExams)
            .catch(() => setAllExams([]))
            .finally(() => setAllExamsLoading(false));
    }, []);

    // ── Load exam data (fallback via API) — re-runs when examKey bumps ─────
    // Normalement, l'examen est résolu directement depuis allExams dans
    // handleAccessExam (pas de réseau, pas de décalage). Ce useEffect sert de
    // fallback pour la phase "blocked" (rechargement de page en cours d'examen)
    // où allExams peut ne pas encore être chargé.
    useEffect(() => {
        if (phase === "select") return; // pas de fetch tant que le candidat n'a pas sélectionné
        if (exam !== undefined) return; // déjà résolu (depuis allExams ou fetch précédent)
        setExamLoading(true);
        fetchCandidateExam()
            .then(setExam)
            .catch(() => setExam(null))
            .finally(() => setExamLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [examKey, phase]);

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

    // ── Moniteur de deadline : auto-soumission si la date limite expire en cours d'examen ──
    useEffect(() => {
        if (phase !== "exam" || !exam?.deadline) return;
        const deadlineMs = new Date(exam.deadline + "T23:59:59").getTime();
        const remaining = deadlineMs - Date.now();
        if (remaining <= 0) {
            // Deadline déjà dépassée au lancement (ne devrait pas arriver, sécurité)
            handleAutoSubmit();
            return;
        }
        const id = setTimeout(() => {
            handleAutoSubmit();
        }, remaining);
        return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, exam?.deadline]);

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

        // Copie déjà soumise → on n'autorise pas un second démarrage
        if (dossier?.exam_status === "submitted" || dossier?.exam_status === "graded") return;

        // Deadline dépassée — recalculée avec Date.now() frais (pas le state `now` stale)
        const deadlineExpiredNow = exam.deadline
            ? new Date(exam.deadline + "T23:59:59").getTime() < Date.now()
            : false;
        if (deadlineExpiredNow) {
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

        // (blocage par rechargement désactivé — pas d'écriture sessionStorage)
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
        const formattedAnswers = questions.length > 0
            ? Object.entries(answers).map(([qId, ans]) => ({ question_id: qId, answer: ans }))
            : Array.from({ length: freeAnswerCount }, (_, i) => ({
                question_id: `question_${i + 1}`,
                answer: answers[`free_${i}`] || "",
            }));

        try {
            await submitExamWithAntiCheat(dossier.exam_token, {
                exam_answers: formattedAnswers,
                cheat_alerts: cheatAlerts,
                candidate_photos: photos,
            });
            sessionStorage.removeItem(EXAM_SESSION_KEY);
            // Rafraîchir le contexte immédiatement : exam_status devient "submitted"
            // → toute tentative de retour à l'examen sera bloquée localement
            await refresh().catch(() => {});
            setPhase("finished");
            if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
            stopCamera();
        } catch (err: any) {
            if (err?.status === 409 || err?.message?.includes("déjà été soumise")) {
                // Copie déjà soumise → traiter comme un succès
                sessionStorage.removeItem(EXAM_SESSION_KEY);
                await refresh().catch(() => {});
                setPhase("finished");
                if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                stopCamera();
            } else if (err?.status === 403 || err?.message?.includes("date limite")) {
                // Deadline dépassée côté serveur
                sessionStorage.removeItem(EXAM_SESSION_KEY);
                await refresh().catch(() => {});
                if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
                stopCamera();
                setShowExpiredModal(true);
                setPhase("info");
            } else {
                alert("Une erreur est survenue lors de la soumission. Veuillez réessayer.");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Auto-submit when timer hits 0
    const handleAutoSubmit = () => { doSubmit(); };

    // ── Handle "Accéder à l'examen" from overview ───────────────────────────
    const handleAccessExam = (d: CandidateDossier) => {
        // Résoudre l'examen directement depuis les données déjà chargées (allExams)
        // pour éviter un appel réseau supplémentaire et le problème de désynchronisation
        // entre le JWT du candidat et le dossier actif sélectionné.
        const cert = d.answers?.["Certification souhaitée"] || d.public_id || "";
        const found = allExams.find(e => e.certification === cert) ?? null;

        setActiveDossierId(d._id);
        setExam(found);
        setExamLoading(false);
        setPhase("info");
    };

    // ═══════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════

    if (dossierLoading && phase === "select") {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    const isLoading = dossierLoading || examLoading;

    if (isLoading && phase !== "select") {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    // ── Vue d'ensemble des candidatures — phase "select" ──────────────────
    if (phase === "select") {
        // Groupe 1 : convoqués — approuvés ET exam_convoked=true, ou déjà soumis/notés/certifiés
        const convoked = dossiers.filter(d =>
            (d.status === "approved" && !!d.exam_convoked) ||
            d.exam_status === "submitted" ||
            d.exam_status === "graded" ||
            d.final_decision === "certified"
        );
        // Groupe 2 : approuvés mais PAS convoqués — l'évaluateur ne les a pas encore sélectionnés
        const awaitingConvocation = dossiers.filter(d =>
            d.status === "approved" &&
            !d.exam_convoked &&
            d.exam_status !== "submitted" &&
            d.exam_status !== "graded" &&
            d.final_decision !== "certified"
        );
        // Groupe 3 : statut pending (dossier non encore validé par le RH)
        const pendingDossiers = dossiers.filter(
            d => d.status !== "approved" && d.status !== "rejected"
        );
        const allPending = dossiers.length > 0 && convoked.length === 0 && awaitingConvocation.length === 0;
        const eligibles = convoked; // alias pour la suite

        return (
            <div className="space-y-6">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Espace candidat</p>
                    <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Examen</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Vos candidatures validées et leur période d&apos;examen.
                    </p>
                </motion.div>

                {eligibles.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 }}
                        className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                    >
                        {/* Bande colorée selon le contexte */}
                        <div
                            className="h-1.5 w-full"
                            style={{ backgroundColor: allPending ? "#b45309" : "#1a237e" }}
                        />
                        <div className="p-10 text-center">
                            <div
                                className="h-14 w-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
                                style={{ backgroundColor: allPending ? "#fff8e1" : "#e8eaf6" }}
                            >
                                <BookOpen
                                    className="h-7 w-7"
                                    style={{ color: allPending ? "#b45309" : "#1a237e" }}
                                />
                            </div>
                            {allPending ? (
                                <>
                                    <p className="font-bold text-gray-700 mb-1">
                                        Candidature en cours d&apos;examen
                                    </p>
                                    <p className="text-sm text-gray-400 leading-relaxed mb-4">
                                        Votre dossier est actuellement examiné par l&apos;administration IRISQ.<br />
                                        L&apos;accès à l&apos;épreuve sera disponible ici dès que votre candidature aura été <strong>validée</strong>.
                                    </p>
                                    {/* Liste des dossiers en attente */}
                                    {pendingDossiers.length > 0 && (
                                        <div className="inline-flex flex-col gap-2 text-left mt-2">
                                            {pendingDossiers.map(d => (
                                                <div
                                                    key={d._id}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
                                                    style={{ backgroundColor: "#fff8e1", color: "#b45309" }}
                                                >
                                                    <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: "#b45309" }} />
                                                    <span className="font-semibold">
                                                        {d.answers?.["Certification souhaitée"] || d.public_id || "Certification"}
                                                    </span>
                                                    <span className="text-xs opacity-70">— En attente</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <p className="font-bold text-gray-700">Aucune candidature validée</p>
                                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                        Vos examens apparaîtront ici dès que votre candidature sera validée par l&apos;administration.
                                    </p>
                                </>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <div className="space-y-3">
                        {/* ── Cartes examen : candidats convoqués ── */}
                        {eligibles.map((d, i) => {
                            const cert = d.answers?.["Certification souhaitée"] || d.public_id || "Certification";
                            const matchedExam = allExams.find(e => e.certification === cert);
                            const hasToken    = d.status === "approved" && !!d.exam_convoked;
                            const expired     = matchedExam?.deadline
                                ? new Date(matchedExam.deadline + "T23:59:59").getTime() < now
                                : false;
                            const alreadyDone = d.exam_status === "submitted" || d.exam_status === "graded" || d.final_decision === "certified";
                            const canStart    = hasToken && !!matchedExam && !expired && !alreadyDone;

                            return (
                                <motion.div
                                    key={d._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                                >
                                    {/* En-tête */}
                                    <div className="px-5 py-4 flex items-start gap-4">
                                        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                            <BookOpen className="h-5 w-5" style={{ color: "#1a237e" }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-gray-800 text-sm leading-snug">{cert}</p>
                                            {d.public_id && (
                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{d.public_id}</p>
                                            )}
                                        </div>
                                        {/* Badge statut examen */}
                                        {alreadyDone ? (
                                            <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                                {d.final_decision === "certified" ? "Certifié ✓" : d.exam_status === "graded" ? "Noté" : "Soumis"}
                                            </span>
                                        ) : canStart ? (
                                            <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full animate-pulse" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                                                Disponible
                                            </span>
                                        ) : expired ? (
                                            <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#ffebee", color: "#c62828" }}>
                                                Expiré
                                            </span>
                                        ) : (
                                            <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#f3f4f6", color: "#6b7280" }}>
                                                Pas encore disponible
                                            </span>
                                        )}
                                    </div>

                                    {/* Infos période */}
                                    <div className="px-5 pb-4 space-y-2">
                                        {matchedExam ? (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {matchedExam.duration_minutes && (
                                                    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: "#f4f6f9" }}>
                                                        <Clock className="h-4 w-4 shrink-0" style={{ color: "#2e7d32" }} />
                                                        <div>
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Durée</p>
                                                            <p className="text-xs font-bold text-gray-800">{matchedExam.duration_minutes} min</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {matchedExam.deadline && (
                                                    <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: expired ? "#ffebee" : "#f4f6f9" }}>
                                                        <CalendarDays className="h-4 w-4 shrink-0" style={{ color: expired ? "#c62828" : "#1a237e" }} />
                                                        <div>
                                                            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Date limite</p>
                                                            <p className="text-xs font-bold" style={{ color: expired ? "#c62828" : "#374151" }}>
                                                                {new Date(matchedExam.deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ backgroundColor: "#f4f6f9" }}>
                                                    <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                                                    <div>
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">Certification</p>
                                                        <p className="text-[10px] font-bold text-gray-800 truncate">{matchedExam.certification}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: "#f4f6f9", color: "#6b7280" }}>
                                                <CalendarDays className="h-4 w-4 shrink-0" />
                                                <span>Période d&apos;examen pas encore disponible.</span>
                                            </div>
                                        )}

                                        {/* Bouton accès */}
                                        {canStart && (
                                            <button
                                                onClick={() => handleAccessExam(d)}
                                                disabled={allExamsLoading}
                                                className="w-full mt-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-wait"
                                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.3)" }}
                                            >
                                                {allExamsLoading
                                                    ? <><Loader2 className="h-4 w-4 animate-spin" />Chargement…</>
                                                    : <><PlayCircle className="h-4 w-4" />Accéder à l&apos;examen</>
                                                }
                                            </button>
                                        )}
                                        {alreadyDone && (
                                            <div className="flex items-center gap-2 p-3 rounded-xl text-xs font-medium" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                                <ShieldCheck className="h-4 w-4 shrink-0" />
                                                {d.final_decision === "certified"
                                                    ? "Félicitations ! Votre certification a été validée."
                                                    : d.exam_status === "graded"
                                                        ? "Votre copie a été corrigée. Résultats communiqués par email."
                                                        : "Votre copie a été soumise et est en cours de correction."}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* ── Cartes "En attente" : validés mais pas encore convoqués ── */}
                        {awaitingConvocation.map((d, i) => {
                            const cert = d.answers?.["Certification souhaitée"] || d.public_id || "Certification";
                            return (
                                <motion.div
                                    key={d._id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: (eligibles.length + i) * 0.06 }}
                                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                                >
                                    <div className="h-1 w-full" style={{ backgroundColor: "#e2e8f0" }} />
                                    <div className="px-5 py-4 flex items-center gap-4">
                                        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#f1f5f9" }}>
                                            <Lock className="h-5 w-5" style={{ color: "#94a3b8" }} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-black text-gray-700 text-sm leading-snug">{cert}</p>
                                            {d.public_id && (
                                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{d.public_id}</p>
                                            )}
                                            <div className="flex items-center gap-2 mt-2 p-2.5 rounded-xl" style={{ backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                                                <Clock className="h-3.5 w-3.5 shrink-0" style={{ color: "#94a3b8" }} />
                                                <p className="text-xs text-gray-400 leading-snug">
                                                    Votre dossier est <strong className="text-gray-600">validé</strong>. L&apos;accès à l&apos;examen sera disponible dès que l&apos;évaluateur vous aura convoqué.
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: "#f1f5f9", color: "#94a3b8", border: "1px solid #e2e8f0" }}
                                        >
                                            En attente
                                        </span>
                                    </div>
                                </motion.div>
                            );
                        })}

                        {/* ── Dossiers en attente de validation RH ── */}
                        {pendingDossiers.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: (eligibles.length + awaitingConvocation.length) * 0.06 }}
                                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                            >
                                <div className="h-1 w-full" style={{ backgroundColor: "#fbbf24" }} />
                                <div className="px-5 py-4">
                                    <p className="text-xs font-bold text-gray-500 mb-2">En attente de validation</p>
                                    <div className="space-y-2">
                                        {pendingDossiers.map(d => (
                                            <div key={d._id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: "#fffbeb", color: "#b45309" }}>
                                                <span className="w-2 h-2 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: "#f59e0b" }} />
                                                <span className="font-semibold text-xs">{d.answers?.["Certification souhaitée"] || d.public_id}</span>
                                                <span className="text-xs opacity-60 ml-auto">— Dossier en cours d&apos;examen</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // ── Certifié — décision finale du comité ───────────────────────────────
    if (dossier?.final_decision === "certified") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl p-10 max-w-md w-full text-center border-t-4 shadow-xl"
                    style={{ borderTopColor: "#2e7d32" }}
                >
                    <div
                        className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: "#e8f5e9" }}
                    >
                        <Trophy className="h-8 w-8" style={{ color: "#2e7d32" }} />
                    </div>
                    <h2 className="text-2xl font-black mb-2" style={{ color: "#1a237e" }}>
                        Certification obtenue
                    </h2>
                    <p className="text-sm font-semibold mb-4" style={{ color: "#2e7d32" }}>
                        Félicitations&nbsp;!
                    </p>
                    <p className="text-gray-500 text-sm leading-relaxed">
                        Vous avez déjà passé votre examen et votre certification a été validée par le comité IRISQ.<br />
                        Vous n&apos;avez plus accès à cette épreuve.
                    </p>
                </motion.div>
            </div>
        );
    }

    // ── Déjà soumis (depuis le serveur) — accès définitivement bloqué ─────────
    if (dossier?.exam_status === "submitted" || dossier?.exam_status === "graded") {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl p-10 max-w-md w-full text-center border-t-4 shadow-xl"
                    style={{ borderTopColor: "#c62828" }}
                >
                    <div
                        className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: "#ffebee" }}
                    >
                        <Lock className="h-8 w-8" style={{ color: "#c62828" }} />
                    </div>
                    <h2 className="text-2xl font-black mb-2" style={{ color: "#c62828" }}>
                        Copie déjà soumise
                    </h2>
                    <p className="text-gray-600 text-sm leading-relaxed mb-5">
                        Vous avez déjà soumis votre copie d&apos;examen.<br />
                        Il vous est <strong>impossible de repasser cet examen</strong>.
                    </p>
                    <div
                        className="rounded-xl p-4 text-xs text-left flex items-start gap-2 mb-5"
                        style={{ backgroundColor: "#fff8e1", border: "1px solid #ffe082", color: "#b45309" }}
                    >
                        <Clock className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
                        <span>
                            Votre copie est en cours de correction. Vous recevrez vos résultats par email dès que l&apos;évaluation sera terminée.
                        </span>
                    </div>
                    <button
                        onClick={() => setPhase("select")}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                        style={{ borderColor: "#e0e0e0", color: "#555" }}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Retour à mes candidatures
                    </button>
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
            <div className="space-y-4">
                <button
                    onClick={() => setPhase("select")}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Retour à mes candidatures
                </button>
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
    const deadline   = exam.deadline;

    // Examen expiré si la deadline (fin de journée) est dépassée
    const examExpired = deadline
        ? new Date(deadline + "T23:59:59").getTime() < now
        : false;

    const canStart = hasToken && !examExpired;

    // ── Deadline dépassée ───────────────────────────────────────────────────
    if (examExpired) {
        return (
            <div className="space-y-4">
                <button
                    onClick={() => setPhase("select")}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                >
                    <ChevronLeft className="h-4 w-4" />
                    Retour à mes candidatures
                </button>
                <div className="flex items-center justify-center">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white rounded-2xl p-10 max-w-md w-full text-center border-t-4 shadow-xl"
                        style={{ borderTopColor: "#c62828" }}
                    >
                        <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6"
                            style={{ backgroundColor: "#ffebee" }}>
                            <CalendarDays className="h-8 w-8" style={{ color: "#c62828" }} />
                        </div>
                        <h2 className="text-2xl font-black mb-3" style={{ color: "#c62828" }}>
                            Date limite dépassée
                        </h2>
                        <p className="text-gray-500 text-sm leading-relaxed mb-4">
                            La date limite de dépôt pour cet examen était le{" "}
                            <strong>
                                {new Date(deadline! + "T00:00:00").toLocaleDateString("fr-FR", {
                                    day: "2-digit", month: "long", year: "numeric",
                                })}
                            </strong>.
                        </p>
                        <p className="text-gray-400 text-sm">
                            Vous ne pouvez plus accéder à cette épreuve.<br />
                            Contactez le responsable IRISQ si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
                        </p>
                    </motion.div>
                </div>
            </div>
        );
    }

    // ── Page INFO ────────────────────────────────────────────────────────────
    if (phase === "info") {
        return (
            <>
                <div className="space-y-4">
                    {/* Bouton retour */}
                    <button
                        onClick={() => setPhase("select")}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-800 transition-colors"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Retour à mes candidatures
                    </button>

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
                                {deadline && (
                                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: "#ffebee" }}>
                                        <CalendarDays className="h-5 w-5 shrink-0" style={{ color: "#c62828" }} />
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Date limite</p>
                                            <p className="text-xs font-bold" style={{ color: "#c62828" }}>
                                                {new Date(deadline).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>



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
                            {hasToken && examExpired && (
                                <button disabled className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white opacity-50 cursor-not-allowed" style={{ backgroundColor: "#c62828" }}>
                                    <Lock className="h-4 w-4" />Date limite dépassée
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
    // Compte les questions répondues (compound = au moins une sous-question répondue)
    const answeredCount = questions.length > 0
        ? questions.filter(q => {
            if (q.type === "compound" && q.parts?.length) {
                return q.parts.some(p => {
                    const v = answers[`${q.id}_${p.id}`] || "";
                    return v !== "" && v !== "<p></p>";
                });
            }
            const v = answers[q.id] || "";
            return v !== "" && v !== "<p></p>";
          }).length
        : Array.from({ length: freeAnswerCount }, (_, i) => answers[`free_${i}`] || "")
            .filter(v => v !== "" && v !== "<p></p>").length;
    const totalQCount = questions.length > 0 ? questions.length : freeAnswerCount;

    // Copie soumise détectée pendant la phase exam (autre appareil ou double soumission)
    const alreadySubmittedMidExam =
        dossier?.exam_status === "submitted" || dossier?.exam_status === "graded";

    if (alreadySubmittedMidExam) {
        return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="bg-white rounded-2xl p-8 max-w-md w-full text-center border-t-4 shadow-2xl"
                    style={{ borderTopColor: "#2e7d32" }}>
                    <div className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-6"
                        style={{ backgroundColor: "#e8f5e9" }}>
                        <CheckCircle2 className="h-8 w-8" style={{ color: "#2e7d32" }} />
                    </div>
                    <h2 className="text-2xl font-black mb-3" style={{ color: "#1a237e" }}>
                        Examen déjà soumis
                    </h2>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Votre copie a déjà été transmise au correcteur.<br />
                        Vous ne pouvez pas passer cet examen une seconde fois.
                    </p>
                </motion.div>
            </div>
        );
    }

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

                {/* Top bar — 3 zones : logo+titre | caméra | timer */}
                <div className="bg-white border-b shadow-sm px-4 py-2 grid shrink-0" style={{ borderColor: "#e0e0e0", zIndex: 10, gridTemplateColumns: "1fr auto 1fr" }}>
                    {/* Gauche : logo + titre */}
                    <div className="flex items-center gap-2 min-w-0">
                        <Image src="/logo.png" alt="IRISQ" width={36} height={36} className="object-contain drop-shadow-md shrink-0" priority />
                        <p className="text-gray-700 font-bold text-sm truncate hidden sm:block">{exam.title}</p>
                    </div>

                    {/* Centre : caméra intégrée */}
                    <div className="flex items-center justify-center">
                        <div className={`relative rounded-lg overflow-hidden border-2 bg-black transition-all ${isCameraActive ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                            style={{ width: 120, height: 68, borderColor: "#374151" }}>
                            <video ref={videoRefCallback} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                            <div className="absolute top-1 left-1 flex items-center gap-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-bold text-white uppercase tracking-wider">
                                <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />REC
                            </div>
                        </div>
                    </div>

                    {/* Droite : plein écran + timer */}
                    <div className="flex items-center justify-end gap-2">
                        {!isFullscreen && (
                            <button onClick={resumeFullscreen} className="text-rose-600 text-xs font-bold bg-rose-50 px-2 py-1.5 rounded-lg flex items-center gap-1 animate-pulse border border-rose-200 shrink-0">
                                <Maximize className="h-3 w-3" />
                                <span className="hidden sm:inline">Plein Écran</span>
                            </button>
                        )}
                        <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold font-mono text-sm shadow-sm shrink-0 ${timeLeft < 300 ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-gray-50 text-gray-800 border border-gray-200"}`}>
                            <Clock className={`h-3.5 w-3.5 ${timeLeft < 300 ? "text-rose-600 animate-pulse" : "text-gray-500"}`} />
                            {formatTime(timeLeft)}
                        </div>
                    </div>
                </div>

                {/* Main content — sidebar gauche + formulaire droite (même layout que l'Aperçu) */}
                <div className="flex-1 flex overflow-hidden">

                    {/* ══ GAUCHE : Sidebar navigateur responsive ══ */}
                    <div className="shrink-0 border-r flex flex-col overflow-y-auto" style={{ width: "clamp(200px, 22vw, 320px)", backgroundColor: "#fff", borderColor: "#e0e0e0" }}>
                        {/* Stats */}
                        <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#e8eaf6" }}>
                            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>Avancement</p>
                            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                                <div className="h-full rounded-full transition-all" style={{ width: `${totalQCount > 0 ? (answeredCount / totalQCount) * 100 : 0}%`, backgroundColor: "#2e7d32" }} />
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold" style={{ color: "#2e7d32" }}>{answeredCount} répondues</span>
                                <span className="text-[11px] text-gray-400">{totalQCount - answeredCount} restantes</span>
                            </div>
                        </div>
                        {/* Chips questions */}
                        <div className="px-5 py-4 flex-1">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Questions</p>
                            <div className="flex flex-wrap gap-2">
                                {(questions.length > 0 ? questions : Array.from({ length: freeAnswerCount }, (_, i) => ({ id: `free_${i}` }))).map((q, idx) => {
                                    const isAnswered = questions.length > 0
                                        ? !!(answers[q.id] && answers[q.id] !== "<p></p>")
                                        : !!(answers[`free_${idx}`] && answers[`free_${idx}`] !== "<p></p>");
                                    const qPage = Math.floor(idx / QUESTIONS_PER_PAGE);
                                    const isCurrent = qPage === currentPage && phase === "exam";
                                    return (
                                        <button key={q.id} onClick={() => { setCurrentPage(qPage); if (phase === "review") setPhase("exam"); }}
                                            title={`Q${idx + 1} — ${isAnswered ? "Répondue" : "Non répondue"}`}
                                            className="h-8 w-8 rounded-lg text-[11px] font-black transition-all flex items-center justify-center"
                                            style={{ backgroundColor: isAnswered ? "#2e7d32" : "#ffebee", color: isAnswered ? "white" : "#c62828", border: isCurrent ? "2px solid #1a237e" : isAnswered ? "none" : "1px solid #ef9a9a", boxShadow: isCurrent ? "0 0 0 3px #c5cae9" : "none" }}>
                                            {idx + 1}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        {/* Légende */}
                        <div className="px-5 py-4 border-t space-y-2.5" style={{ borderColor: "#e8eaf6" }}>
                            <div className="flex items-center gap-3"><span className="h-5 w-5 rounded-md shrink-0" style={{ backgroundColor: "#2e7d32" }} /><span className="text-xs text-gray-600 font-semibold">Répondue</span></div>
                            <div className="flex items-center gap-3"><span className="h-5 w-5 rounded-md shrink-0 border border-red-300" style={{ backgroundColor: "#ffebee" }} /><span className="text-xs text-gray-600 font-semibold">Non répondue</span></div>
                            <div className="flex items-center gap-3"><span className="h-5 w-5 rounded-md shrink-0" style={{ border: "2px solid #1a237e", boxShadow: "0 0 0 2px #c5cae9", backgroundColor: "white" }} /><span className="text-xs text-gray-600 font-semibold">Page actuelle</span></div>
                        </div>
                    </div>

                    {/* ══ DROITE : Formulaire Google Forms pleine largeur ══ */}
                    <div className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: "#f4f6f9" }}>
                        {/* Header slim */}
                        <div className="px-4 py-2 border-b flex items-center justify-between shrink-0" style={{ backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}>
                            <div className="flex items-center gap-2">
                                <BookOpen className="h-4 w-4 text-[#1a237e]" />
                                <h2 className="font-black text-xs uppercase tracking-wider text-[#1a237e]">
                                    {phase === "review" ? "Révision de vos réponses" : "Vos Réponses"}
                                </h2>
                            </div>
                            <span className="text-[10px] font-bold bg-[#1a237e] text-white px-2 py-1 rounded-md">{answeredCount}/{totalQCount}</span>
                        </div>

                        {/* ══ RÉVISION — toutes les questions + réponses ══ */}
                        {phase === "review" && (
                            <>
                                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                    {(questions.length > 0 ? questions : Array.from({ length: freeAnswerCount }, (_, i) => ({ id: `free_${i}`, text: `Question ${i + 1}`, type: "open", options: [], section: "", subsection: "", has_justification: false }))).map((q, idx) => {
                                        const isQFree = q.id.startsWith("free_");
                                        const ans = answers[q.id] || "";
                                        const justif = answers[`${q.id}_justif`] || "";
                                        const hasAns = ans && ans !== "<p></p>";
                                        const hasJustif = justif && justif !== "<p></p>";
                                        return (
                                            <div key={q.id} className={`rounded-xl overflow-hidden border bg-white shadow-sm ${hasAns ? "border-green-200" : "border-orange-200"}`}>
                                                <div className={`px-3 py-2 border-b flex items-center gap-2 ${hasAns ? "bg-green-50" : "bg-orange-50"}`} style={{ borderColor: hasAns ? "#a5d6a7" : "#ffcc80" }}>
                                                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 text-white" style={{ backgroundColor: hasAns ? "#2e7d32" : "#f59e0b" }}>{idx + 1}</div>
                                                    <span className="text-xs font-black uppercase tracking-wide" style={{ color: hasAns ? "#2e7d32" : "#b45309" }}>Q{idx + 1}</span>
                                                    <span className="ml-auto text-[10px] font-bold">{hasAns ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Répondu</span> : <span className="text-orange-500">Non répondu</span>}</span>
                                                </div>
                                                {!isQFree && <div className="px-3 py-2"><p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{q.text}</p></div>}
                                                {q.type === "qcm" && ans && (
                                                    <div className="px-3 pb-2">
                                                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#e8f5e9", border: "1px solid #a5d6a7" }}>
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                                            <span className="text-xs font-semibold text-green-800">{ans}</span>
                                                        </div>
                                                        {hasJustif && <div className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100" dangerouslySetInnerHTML={{ __html: justif }} />}
                                                    </div>
                                                )}
                                                {q.type !== "qcm" && (
                                                    <div className="px-3 pb-2">
                                                        {hasAns ? <div className="text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100" dangerouslySetInnerHTML={{ __html: ans }} /> : <p className="text-xs text-gray-400 italic">Aucune réponse saisie</p>}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="shrink-0 border-t p-3 space-y-2" style={{ borderColor: "#c5cae9", backgroundColor: "#ffffff" }}>
                                    <div className="flex items-center justify-between text-xs mb-1">
                                        <span className="text-gray-500 font-medium">Questions répondues</span>
                                        <span className="font-black text-[#1a237e]">{answeredCount} / {totalQCount}</span>
                                    </div>
                                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${totalQCount > 0 ? (answeredCount / totalQCount) * 100 : 0}%`, backgroundColor: "#2e7d32" }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => { setPhase("exam"); setCurrentPage(totalPages - 1); }} className="flex-1 py-2.5 rounded-xl font-bold text-sm border transition-all flex items-center justify-center gap-2" style={{ borderColor: "#c5cae9", color: "#1a237e" }}>
                                            <ChevronLeft className="h-4 w-4" />Modifier
                                        </button>
                                        <button onClick={() => setShowSubmitModal(true)} disabled={isSubmitting} className="flex-1 py-2.5 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50" style={{ backgroundColor: "#1a237e" }}>
                                            {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Soumettre</>}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ══ MODE EXAM — questions paginées ══ */}
                        {phase === "exam" && (
                        <>
                        {/* Liste scrollable : question → réponse juste en dessous */}
                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {questions.length === 0 ? (
                                /* ── PDF sans questions parsées : blocs numérotés paginés ── */
                                Array.from({ length: freeAnswerCount }, (_, i) => i)
                                    .slice(currentPage * QUESTIONS_PER_PAGE, (currentPage + 1) * QUESTIONS_PER_PAGE)
                                    .map(i => {
                                        const filled = !!(answers[`free_${i}`] && answers[`free_${i}`] !== "<p></p>");
                                        return (
                                            <div key={i} className="rounded-xl overflow-hidden border transition-colors bg-white shadow-sm" style={{ borderColor: filled ? "#a5d6a7" : "#e0e0e0" }}>
                                                <div className="px-3 py-2 border-b flex items-center gap-2" style={{ backgroundColor: filled ? "#e8f5e9" : "#f8f9fa", borderColor: filled ? "#a5d6a7" : "#eeeeee" }}>
                                                    <div className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 text-white" style={{ backgroundColor: filled ? "#2e7d32" : "#1a237e" }}>{i + 1}</div>
                                                    <span className="text-xs font-black uppercase tracking-wide" style={{ color: filled ? "#2e7d32" : "#1a237e" }}>Question {i + 1}</span>
                                                    {filled && <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" />Saisie</span>}
                                                </div>
                                                <div className="p-3">
                                                    <RichTextEditor value={answers[`free_${i}`] || ""} onChange={html => setAnswers(prev => ({ ...prev, [`free_${i}`]: html }))} placeholder={`Votre réponse à la question ${i + 1}…`} minHeight="100px" />
                                                </div>
                                            </div>
                                        );
                                    })
                            ) : (() => {
                                /* ── Questions parsées paginées (3 par page) ── */
                                const pageStart = currentPage * QUESTIONS_PER_PAGE;
                                const currentPageQuestions = questions.slice(pageStart, pageStart + QUESTIONS_PER_PAGE);
                                const items: React.ReactNode[] = [];
                                // Section du début de page (pour continuité des dividers)
                                let lastSection    = currentPage > 0 ? (questions[pageStart - 1]?.section || "") : "";
                                let lastSubsection = currentPage > 0 ? (questions[pageStart - 1]?.subsection || "") : "";

                                currentPageQuestions.forEach((q, localIdx) => {
                                    const idx = pageStart + localIdx;
                                    const section    = q.section    || q.part || "";
                                    const subsection = q.subsection || "";
                                    const filled     = !!(answers[q.id] && answers[q.id] !== "<p></p>");
                                    const justifKey  = `${q.id}_justif`;
                                    const justifFilled = !!(answers[justifKey] && answers[justifKey] !== "<p></p>");

                                    // ── Divider de section ──
                                    if (section && section !== lastSection) {
                                        lastSection = section;
                                        lastSubsection = "";
                                        items.push(
                                            <div key={`sec_${idx}`} className="flex items-center gap-2 pt-1">
                                                <div className="flex-1 h-px bg-gray-200" />
                                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full" style={{ backgroundColor: "#1a237e", color: "white" }}>
                                                    {section.replace(/^(Section\s+\d+|PARTIE\s+\w+)\s*[:\-]?\s*/i, "").trim() || section}
                                                </span>
                                                <div className="flex-1 h-px bg-gray-200" />
                                            </div>
                                        );
                                    }

                                    // ── Label de sous-section (QCM / Questions Ouvertes) ──
                                    if (subsection && subsection !== lastSubsection) {
                                        lastSubsection = subsection;
                                        const isQcmSub = /QCM/i.test(subsection);
                                        items.push(
                                            <div key={`sub_${idx}`} className="px-1">
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: isQcmSub ? "#ede7f6" : "#e3f2fd", color: isQcmSub ? "#6a1b9a" : "#1565c0" }}>
                                                    {subsection.split("(")[0].trim()}
                                                </span>
                                            </div>
                                        );
                                    }

                                    // ── Carte question style Google Forms (identique à l'Aperçu) ──
                                    items.push(
                                        <div key={q.id} className="bg-white border overflow-hidden" style={{ borderColor: "#c5cae9", borderTopWidth: idx === pageStart ? "1px" : "0" }}>
                                            {/* Texte de la question */}
                                            <div className="px-6 pt-5 pb-3">
                                                <div className="flex items-start gap-3">
                                                    <span className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0 mt-0.5" style={{ backgroundColor: filled ? "#2e7d32" : "#1a237e" }}>{idx + 1}</span>
                                                    <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap flex-1">{q.text}</p>
                                                </div>
                                            </div>

                                            {/* Options QCM */}
                                            {q.type === "qcm" && q.options && q.options.length > 0 && (
                                                <div className="px-8 pb-3 space-y-2">
                                                    {q.options.map((opt, oi) => {
                                                        const sel = answers[q.id] === opt;
                                                        return (
                                                            <label key={oi} className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all group ${sel ? "bg-[#e8f5e9]" : "hover:bg-gray-50"}`}>
                                                                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${sel ? "border-[#2e7d32] bg-[#2e7d32]" : "border-gray-400 group-hover:border-[#1a237e]"}`}>
                                                                    {sel && <div className="h-2 w-2 rounded-full bg-white" />}
                                                                </div>
                                                                <input type="radio" name={`q_${q.id}`} checked={sel} onChange={() => setAnswers(prev => ({ ...prev, [q.id]: opt }))} className="sr-only" />
                                                                <span className={`text-sm leading-snug ${sel ? "font-semibold text-gray-900" : "text-gray-700"}`}>{opt}</span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {q.type === "qcm" && q.has_justification && (
                                                <div className="px-6 pb-5 mt-1">
                                                    <p className="text-xs font-bold text-gray-500 mb-2 italic underline">Justifiez votre/vos choix :</p>
                                                    <RichTextEditor value={answers[justifKey] || ""} onChange={html => setAnswers(prev => ({ ...prev, [justifKey]: html }))} placeholder="Rédigez votre justification…" minHeight="90px" />
                                                </div>
                                            )}

                                            {/* Questions composées Vrai/Faux */}
                                            {q.type === "compound" && q.parts && q.parts.length > 0 && (
                                                <div className="px-6 pb-5 space-y-3">
                                                    {q.parts.map((part) => (
                                                        <div key={part.id} className="border rounded-xl overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                                                            <div className="px-4 py-2 text-xs font-bold text-gray-700" style={{ backgroundColor: "#f4f6f9" }}>{part.label}</div>
                                                            {part.type === "vraifaux" ? (
                                                                <div className="px-4 py-3 flex gap-3">
                                                                    {["Vrai", "Faux"].map(val => {
                                                                        const k = `${q.id}_${part.id}`;
                                                                        const sel = answers[k] === val;
                                                                        return (
                                                                            <button key={val} onClick={() => setAnswers(prev => ({ ...prev, [k]: val }))}
                                                                                className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all border"
                                                                                style={{ backgroundColor: sel ? (val === "Vrai" ? "#2e7d32" : "#c62828") : "white", color: sel ? "white" : (val === "Vrai" ? "#2e7d32" : "#c62828"), borderColor: val === "Vrai" ? "#a5d6a7" : "#ef9a9a" }}>
                                                                                {val === "Vrai" ? "✓ Vrai" : "✗ Faux"}
                                                                            </button>
                                                                        );
                                                                    })}
                                                                </div>
                                                            ) : (
                                                                <div className="px-4 pb-3 pt-2">
                                                                    <RichTextEditor value={answers[`${q.id}_${part.id}`] || ""} onChange={html => setAnswers(prev => ({ ...prev, [`${q.id}_${part.id}`]: html }))} placeholder="Votre réponse…" minHeight="80px" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Réponse ouverte */}
                                            {q.type === "open" && (
                                                <div className="px-6 pb-5 mt-1">
                                                    <RichTextEditor value={answers[q.id] || ""} onChange={html => setAnswers(prev => ({ ...prev, [q.id]: html }))} placeholder="Rédigez votre réponse (texte, tableaux, listes…)" minHeight="140px" />
                                                </div>
                                            )}

                                            <div className="h-px mx-6" style={{ backgroundColor: "#e8eaf6" }} />
                                        </div>
                                    );
                                });
                                return items;
                            })()}
                        </div>

                        {/* ── Navigation paginée (même style que l'Aperçu) ── */}
                        <div className="shrink-0 border-t px-6 py-4 flex items-center justify-between" style={{ borderColor: "#c5cae9", backgroundColor: "#fff" }}>
                            <span className="text-xs text-gray-400">Page <strong>{currentPage + 1}</strong> / {totalPages} · {answeredCount}/{totalQCount} répondues</span>
                            <div className="flex gap-2">
                                {currentPage > 0 && (
                                    <button
                                        onClick={() => { setCurrentPage(p => p - 1); }}
                                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm border transition-all"
                                        style={{ borderColor: "#c5cae9", color: "#1a237e" }}
                                    >
                                        <ChevronLeft className="h-4 w-4" />Précédent
                                    </button>
                                )}
                                {isLastPage ? (
                                    <button
                                        onClick={() => setPhase("review")}
                                        className="flex-1 py-2.5 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2"
                                        style={{ backgroundColor: "#1a237e" }}
                                    >
                                        <CheckCircle2 className="h-4 w-4" />Vérifier mes réponses
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => { setCurrentPage(p => p + 1); }}
                                        className="flex-1 py-2.5 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2"
                                        style={{ backgroundColor: "#1a237e" }}
                                    >
                                        Suivant<ChevronRight className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                        </>
                        )}
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
                            <div className="px-6 pt-5 pb-6">
                                {/* Récap réponses */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#e8f5e9" }}>
                                        <p className="text-2xl font-black" style={{ color: "#2e7d32" }}>{answeredCount}</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Répondues</p>
                                    </div>
                                    <div className="rounded-xl p-3 text-center" style={{ backgroundColor: totalQCount - answeredCount > 0 ? "#ffebee" : "#e8f5e9" }}>
                                        <p className="text-2xl font-black" style={{ color: totalQCount - answeredCount > 0 ? "#c62828" : "#2e7d32" }}>{totalQCount - answeredCount}</p>
                                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mt-0.5">Non répondues</p>
                                    </div>
                                </div>

                                {/* Avertissement si questions non répondues */}
                                {totalQCount - answeredCount > 0 && (
                                    <div className="rounded-xl p-3 mb-4 flex items-start gap-2" style={{ backgroundColor: "#fff8e1", border: "1px solid #ffe082" }}>
                                        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-xs font-bold text-amber-800">
                                                {totalQCount - answeredCount} question{totalQCount - answeredCount > 1 ? "s" : ""} sans réponse
                                            </p>
                                            <p className="text-[11px] text-amber-700 mt-0.5">
                                                Vous pouvez quand même soumettre — les questions sans réponse seront considérées comme non traitées.
                                            </p>
                                            <button
                                                onClick={() => { setShowSubmitModal(false); setPhase("review"); }}
                                                className="text-[11px] font-bold underline text-amber-800 mt-1"
                                            >
                                                Voir les questions non répondues →
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-gray-400 text-center mb-4">Cette action est <strong>irréversible</strong>. Votre copie sera transmise immédiatement au correcteur.</p>

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
                                        {isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Soumettre définitivement</>}
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
