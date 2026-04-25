"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ShieldAlert, Maximize, Clock, FileText, CheckCircle2, AlertTriangle, Upload, Loader2, Play, Monitor } from "lucide-react";
import { API_URL, uploadFiles, submitExamWithAntiCheat } from "@/lib/api";
import RichTextEditor from "@/components/RichTextEditor";

export default function AntiCheatPortal() {
    const params = useParams();
    const router = useRouter();
    const token = params.token as string;

    // Security & Anti-Cheat State
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [isFinished, setIsFinished] = useState(false);
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
        if (node && mediaStream) {
            node.srcObject = mediaStream;
        }
    }, [mediaStream]);

    // Interactive Exam State
    const [answers, setAnswers] = useState<Record<string, string>>({});

    // Exam Data State
    const [candidateData, setCandidateData] = useState<any>(null);
    const [examData, setExamData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Timer State — initialisé depuis examData.duration_minutes (défaut 120 min)
    const [timeLeft, setTimeLeft] = useState(120 * 60);

    // ID Verification State
    const [isIdVerified, setIsIdVerified] = useState(false);
    const [enteredId, setEnteredId] = useState("");
    const [idError, setIdError] = useState("");

    const verifyCandidateId = async () => {
        const expectedId = candidateData?.public_id || `CAND-${candidateData?._id?.slice(-6).toUpperCase()}`;
        if (enteredId.trim().toUpperCase() === expectedId) {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                setMediaStream(stream);
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
                setIsCameraActive(true);
                setIsIdVerified(true);
                setIdError("");
            } catch (err) {
                console.error(err);
                setIdError("L'accès à la Webcam est obligatoire pour continuer. Veuillez l'autoriser dans votre navigateur.");
            }
        } else {
            setIdError("ID Public incorrect. Veuillez vérifier l'identifiant reçu par email.");
        }
    };

    // Load Initial Data
    useEffect(() => {
        const fetchExamData = async () => {
            try {
                const res = await fetch(`${API_URL}/responses/${token}`);
                if (!res.ok) throw new Error("Invalid token");
                const data = await res.json();
                setCandidateData(data);

                if (data.exam_status === 'submitted' || data.exam_status === 'graded') {
                    setIsFinished(true);
                    setIsLoading(false);
                    return;
                }

                const certName = data.answers["Certification souhaitée"];
                const examsRes = await fetch(`${API_URL}/exams?certification=${encodeURIComponent(certName)}`);
                const exams = await examsRes.json();

                if (exams.length > 0) {
                    const exam = exams[0];
                    setExamData(exam);
                    // Initialise le timer depuis la durée de l'examen (défaut 120 min)
                    const durationSec = (exam.duration_minutes && exam.duration_minutes > 0)
                        ? exam.duration_minutes * 60
                        : 120 * 60;
                    setTimeLeft(durationSec);
                    const initialAnswers: Record<string, string> = {};
                    exam.parsed_questions.forEach((q: any) => {
                        initialAnswers[q.id] = "";
                    });
                    setAnswers(initialAnswers);
                } else {
                    throw new Error("No exam available for this certification.");
                }
            } catch (error) {
                console.error("Error loading exam:", error);
                router.push("/login");
            } finally {
                setIsLoading(false);
            }
        };

        if (token) fetchExamData();
    }, [token, router]);

    // Timer Logic
    useEffect(() => {
        if (!hasStarted || isFinished || timeLeft <= 0) return;
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    submitExam();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [hasStarted, isFinished, timeLeft]);

    // Continuous Camera Monitoring
    useEffect(() => {
        if (!hasStarted || isFinished || !mediaStream) return;
        const checkCamera = () => {
            const tracks = mediaStream.getVideoTracks();
            if (tracks.length === 0 || tracks[0].readyState === "ended") {
                if (isCameraActive) {
                    setIsCameraActive(false);
                    // We only log it once via the dependency change or directly if needed,
                    // but since logCheatEvent might be called multiple times, we handle it in render or simply here:
                    setCheatAlerts(prev => [...prev, `[${new Date().toLocaleTimeString('fr-FR')}] La webcam a été déconnectée ou désactivée.`]);
                    setLastWarningMsg("La webcam a été déconnectée ou désactivée.");
                    setWarningVisible(true);
                    setTimeout(() => setWarningVisible(false), 5000);
                }
            }
        };
        const interval = setInterval(checkCamera, 1000);
        return () => clearInterval(interval);
    }, [hasStarted, isFinished, mediaStream, isCameraActive]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
        return `${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
    };

    // --- ANTI CHEAT SYSTEM ---
    const logCheatEvent = useCallback((message: string) => {
        const timestamp = new Date().toLocaleTimeString('fr-FR');
        const alertMsg = `[${timestamp}] ${message}`;
        setCheatAlerts(prev => [...prev, alertMsg]);
        setLastWarningMsg(message);
        setWarningVisible(true);
        setTimeout(() => setWarningVisible(false), 5000);
    }, []);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (hasStarted && !isFinished && document.visibilityState === "hidden") {
                logCheatEvent("Perte de focus (changement d'onglet ou fenêtre minimisée détecté).");
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    }, [hasStarted, isFinished, logCheatEvent]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            if (hasStarted && !isFinished && !document.fullscreenElement) {
                setIsFullscreen(false);
                logCheatEvent("Sortie du mode Plein Écran détectée.");
            }
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, [hasStarted, isFinished, logCheatEvent]);

    useEffect(() => {
        const preventDefault = (e: Event) => {
            if (hasStarted && !isFinished) {
                e.preventDefault();
                logCheatEvent(`Tentative non autorisée : ${e.type === 'contextmenu' ? 'Clic Droit' : 'Copier/Coller'}`);
            }
        };
        document.addEventListener("contextmenu", preventDefault);
        document.addEventListener("copy", preventDefault);
        document.addEventListener("paste", preventDefault);
        return () => {
            document.removeEventListener("contextmenu", preventDefault);
            document.removeEventListener("copy", preventDefault);
            document.removeEventListener("paste", preventDefault);
        };
    }, [hasStarted, isFinished, logCheatEvent]);

    const capturePhoto = async (label: string = "photo") => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const context = canvas.getContext("2d");
        if (context) {
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
                if (blob) {
                    const formData = new FormData();
                    formData.append("files", new File([blob], `${label}_${Date.now()}.jpg`, { type: 'image/jpeg' }));
                    try {
                        const result = await uploadFiles(formData);
                        if (result.file_urls && result.file_urls.length > 0) {
                            setCandidatePhotos(prev => [...prev, result.file_urls[0]]);
                        }
                    } catch (err) {
                        console.error(`Camera upload failed for ${label}`, err);
                    }
                }
            }, "image/jpeg", 0.6);
        }
    };

    const resumeFullscreen = async () => {
        try {
            const docEl = document.documentElement as any;
            if (docEl.requestFullscreen) await docEl.requestFullscreen();
            else if (docEl.webkitRequestFullscreen) await docEl.webkitRequestFullscreen();
            else if (docEl.msRequestFullscreen) await docEl.msRequestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            console.error("Erreur plein écran:", err);
            alert("Impossible de passer en plein écran.");
        }
    };

    const requestCameraReconnect = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            setMediaStream(stream);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            setIsCameraActive(true);
            logCheatEvent("Webcam reconnectée avec succès.");
        } catch (err) {
            console.error(err);
            alert("Impossible d'accéder à la webcam. Veuillez autoriser l'accès dans votre navigateur.");
        }
    };

    const startExam = async () => {
        try {
            const docEl = document.documentElement as any;
            if (docEl.requestFullscreen) await docEl.requestFullscreen();
            else if (docEl.webkitRequestFullscreen) await docEl.webkitRequestFullscreen();
            else if (docEl.msRequestFullscreen) await docEl.msRequestFullscreen();
            setIsFullscreen(true);
        } catch (err) {
            console.error(err);
            alert("Erreur: Le mode Plein Écran est obligatoire pour démarrer l'examen.");
            return;
        }

        if (!isCameraActive) {
            alert("Erreur: La webcam n'est pas active. Veuillez rafraîchir la page et autoriser l'accès.");
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => { });
            }
            setIsFullscreen(false);
            return;
        }

        setHasStarted(true);

        // 1. Capture au Début (après 2 secondes pour laisser le temps à la webcam de bien s'initialiser)
        setTimeout(() => {
            capturePhoto("debut");
        }, 2000);

        // 2. Capture au Milieu de l'examen
        const halfTimeMs = (timeLeft / 2) * 1000;
        setTimeout(() => {
            capturePhoto("milieu");
        }, halfTimeMs);
    };

    const submitExam = async () => {
        setIsSubmitting(true);

        // 3. Capture à la Fin (Synchrone avant de soumettre pour s'assurer qu'elle est bien envoyée)
        let finalPhotoUrl = null;
        try {
            if (videoRef.current && canvasRef.current) {
                const video = videoRef.current;
                const canvas = canvasRef.current;
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
                const context = canvas.getContext("2d");
                if (context) {
                    context.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.6));
                    if (blob) {
                        const formData = new FormData();
                        formData.append("files", new File([blob], `fin_${Date.now()}.jpg`, { type: 'image/jpeg' }));
                        const result = await uploadFiles(formData);
                        if (result.file_urls && result.file_urls.length > 0) {
                            finalPhotoUrl = result.file_urls[0];
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Final photo fail", e);
        }

        const photosToSubmit = finalPhotoUrl ? [...candidatePhotos, finalPhotoUrl] : [...candidatePhotos];

        try {
            const formattedAnswers = Object.entries(answers).map(([qId, ans]) => ({
                question_id: qId,
                answer: ans
            }));
            await submitExamWithAntiCheat(token, {
                exam_answers: formattedAnswers,
                cheat_alerts: cheatAlerts,
                candidate_photos: photosToSubmit
            });
            setIsFinished(true);
            if (document.fullscreenElement) {
                await document.exitFullscreen().catch(() => { });
            }
            if (videoRef.current?.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        } catch (error) {
            console.error("Submission failed", error);
            alert("Une erreur est survenue lors de la soumission. Veuillez réessayer.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ backgroundColor: "#f4f6f9" }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#1a237e" }} />
            </div>
        );
    }

    // ── Error ──
    if (!examData || !candidateData) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans" style={{ backgroundColor: "#f4f6f9" }}>
                <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
                <h1 className="text-xl font-bold" style={{ color: "#1a237e" }}>Session Invalide ou Expirée</h1>
                <p className="text-sm text-gray-500 mt-2">Veuillez contacter le support si vous pensez qu'il s'agit d'une erreur.</p>
            </div>
        );
    }

    // ── STATE 3: Finished ──
    if (isFinished) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ backgroundColor: "#f4f6f9" }}>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full text-center border shadow-xl" style={{ borderColor: "#e0e0e0" }}>
                    <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black mb-2" style={{ color: "#1a237e" }}>Examen Terminé</h2>
                    <p className="text-gray-500 mb-8">Votre copie et votre rapport de session ont été transmis au correcteur de manière sécurisée.</p>
                    <p className="text-gray-400 font-bold text-sm tracking-wider uppercase mb-2">Vous pouvez maintenant fermer cet onglet.</p>
                </motion.div>
            </div>
        );
    }

    // ── STATE 1a: ID Verification ──
    if (!hasStarted && !isIdVerified) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 font-sans" style={{ backgroundColor: "#f4f6f9" }}>
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl p-8 max-w-md w-full border shadow-xl"
                    style={{ borderColor: "#e0e0e0" }}
                >
                    {/* ── Logo ── */}
                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center mb-3">
                            <Image
                                src="/logo.png"
                                alt="IRISQ Logo"
                                width={80}
                                height={80}
                                className="object-contain w-full h-full drop-shadow-md"
                                priority
                            />
                        </div>
                        <span
                            className="text-[10px] sm:text-[12px] font-extrabold tracking-[0.25em] uppercase mb-4"
                            style={{ color: "#1a237e" }}
                        >
                            IRISQ-CERTIFICATIONS
                        </span>
                        <h1 className="text-2xl font-black text-center" style={{ color: "#1a237e" }}>
                            Vérification d'Identité
                        </h1>
                        <p className="text-gray-500 text-sm mt-2 text-center">
                            Veuillez saisir votre <strong>ID Public</strong> reçu par email pour accéder à l'examen.
                        </p>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1.5">ID Public</label>
                            <input
                                type="text"
                                placeholder="Ex : IRISQ-A1B2C3"
                                className="w-full bg-gray-50 border border-gray-200 text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 uppercase transition-all"
                                style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                                value={enteredId}
                                onChange={(e) => setEnteredId(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && verifyCandidateId()}
                            />
                            {idError && <p className="text-rose-500 text-xs mt-2 font-bold">{idError}</p>}
                        </div>
                        <button
                            onClick={verifyCandidateId}
                            className="w-full py-3.5 text-white rounded-xl font-bold transition-all shadow-md flex justify-center items-center"
                            style={{ backgroundColor: "#1a237e" }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#283593")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#1a237e")}
                        >
                            Continuer vers l'examen
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    // ── STATE 1b: Ready to Start ──
    if (!hasStarted && isIdVerified) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 font-sans" style={{ backgroundColor: "#f4f6f9" }}>
                <div className="bg-white rounded-2xl max-w-2xl w-full border shadow-xl overflow-hidden" style={{ borderColor: "#e0e0e0" }}>
                    <div className="p-8 border-b text-center" style={{ borderColor: "#e0e0e0" }}>
                        <h1 className="text-2xl font-black mb-2" style={{ color: "#1a237e" }}>Examen: {examData.title}</h1>
                        <p className="text-gray-500 font-medium">Certification {examData.certification}</p>
                        {examData.duration_minutes && (
                            <div className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-sm font-bold"
                                style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                                <Clock className="h-4 w-4" />
                                Durée de l&apos;épreuve : {examData.duration_minutes} minutes
                            </div>
                        )}
                    </div>
                    <div className="p-8 bg-gray-50/50">
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-5 mb-8">
                            <h3 className="flex items-center gap-2 text-rose-700 font-black mb-3 text-sm">
                                <ShieldAlert className="h-5 w-5" />
                                Environnement Sécurisé Requis
                            </h3>
                            <ul className="space-y-2 text-sm text-rose-900/80 font-medium">
                                <li>• Le navigateur passera obligatoirement en <strong>Plein Écran</strong>.</li>
                                <li>• <strong>Interdiction stricte</strong> de quitter le plein écran ou de changer d'onglet.</li>
                                <li>• Les fonctions <strong>Copier/Coller</strong> sont désactivées.</li>
                                <li>• Toute infraction générera une <strong>alerte enregistrée</strong> dans votre dossier de correction.</li>
                            </ul>
                        </div>
                        <button
                            onClick={startExam}
                            className="w-full py-4 rounded-xl font-black text-white shadow-lg transition-all flex items-center justify-center gap-3 text-lg"
                            style={{ backgroundColor: "#2e7d32" }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#1b5e20")}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#2e7d32")}
                        >
                            <Play className="h-6 w-6" />
                            J'accepte les conditions et je démarre l'examen
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── STATE 2: Exam In Progress ──
    if (hasStarted && !isCameraActive && !isFinished) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 font-sans">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full text-center border-t-4 border-rose-500 shadow-2xl">
                    <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Monitor className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black mb-3 text-slate-900">Webcam Requise</h2>
                    <p className="text-slate-600 mb-6">
                        L'examen nécessite une surveillance vidéo continue. Votre webcam est actuellement désactivée.
                        <strong> Cet incident a été signalé.</strong>
                    </p>
                    <button
                        onClick={requestCameraReconnect}
                        className="w-full text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        <Play className="h-5 w-5" />
                        Réactiver la webcam
                    </button>
                </motion.div>
            </div>
        );
    }

    if (hasStarted && !isFullscreen && !isFinished) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900 font-sans">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white rounded-2xl p-8 max-w-md w-full text-center border-t-4 border-rose-500 shadow-2xl">
                    <div className="h-16 w-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Monitor className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-black mb-3 text-slate-900">Mode Plein Écran Requis</h2>
                    <p className="text-slate-600 mb-6">
                        L'examen ne peut se dérouler qu'en plein écran. Vous avez quitté ce mode.
                        <strong> Cet incident a été signalé.</strong>
                    </p>
                    <button
                        onClick={resumeFullscreen}
                        className="w-full text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        <Maximize className="h-5 w-5" />
                        Reprendre en plein écran
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col relative w-full overflow-hidden font-sans" style={{ backgroundColor: "#f4f6f9" }}>
            {/* Warning Overlay */}
            <AnimatePresence>
                {warningVisible && (
                    <motion.div
                        initial={{ opacity: 0, y: -50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -50 }}
                        className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-rose-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4"
                    >
                        <AlertTriangle className="h-8 w-8 text-rose-100" />
                        <div>
                            <p className="font-black text-sm uppercase tracking-wider">Action Non Autorisée</p>
                            <p className="text-sm opacity-90 font-medium">{lastWarningMsg}</p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Top Bar */}
            <div className="bg-white border-b shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-40" style={{ borderColor: "#e0e0e0" }}>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
                            <Image
                                src="/logo.png"
                                alt="IRISQ Logo"
                                width={80}
                                height={80}
                                className="object-contain w-full h-full drop-shadow-md"
                                priority
                            />
                        </div>
                        <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase hidden sm:block" style={{ color: "#1a237e" }}>
                            IRISQ EXAMEN
                        </span>
                    </div>
                    <div className="h-4 w-px bg-gray-200 hidden sm:block" />
                    <p className="text-gray-700 font-bold text-sm hidden sm:block">{examData.title}</p>
                </div>

                <div className="flex items-center gap-4">
                    {!isFullscreen && (
                        <button onClick={resumeFullscreen} className="text-rose-600 text-xs font-bold bg-rose-50 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse border border-rose-200">
                            <Maximize className="h-3 w-3" />
                            Reprendre Plein Écran
                        </button>
                    )}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold font-mono text-lg shadow-sm ${timeLeft < 300 ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-gray-50 text-gray-800 border border-gray-200'}`}>
                        <Clock className={`h-5 w-5 ${timeLeft < 300 ? 'text-rose-600 animate-pulse' : 'text-gray-500'}`} />
                        {formatTime(timeLeft)}
                    </div>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex-1 overflow-auto p-6 lg:p-10 flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto w-full">

                {/* Questionnaire Area (Larger) */}
                <div className="flex-[3] bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col h-[75vh]" style={{ borderColor: "#c5cae9" }}>
                    <div className="p-4 border-b flex items-center justify-between" style={{ backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}>
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-[#1a237e]" />
                            <h2 className="font-black text-sm uppercase tracking-wider text-[#1a237e]">Sujet d'Examen</h2>
                        </div>
                        <span className="text-xs font-bold bg-[#1a237e] text-white px-2 py-1 rounded-md">
                            {examData.parsed_questions ? examData.parsed_questions.length : 1} Question(s)
                        </span>
                    </div>

                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Document Viewer removed visually */}

                        {/* Answer Area */}
                        <div className="flex-1 p-6 bg-gray-50 overflow-y-auto space-y-8">
                            {(!examData.parsed_questions || examData.parsed_questions.length === 0) ? (
                                <div className="h-full flex flex-col gap-2">
                                    <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        Votre Copie <span className="text-xs font-normal text-gray-500">(Rédigez vos réponses ci-dessous)</span>
                                    </h3>
                                    <RichTextEditor
                                        value={answers["general_text"] || ""}
                                        onChange={(html) => setAnswers({ ...answers, general_text: html })}
                                        placeholder="Veuillez saisir les réponses aux questions du sujet ici. Vous pouvez formater votre texte, créer des tableaux, des listes…"
                                        minHeight="300px"
                                    />
                                </div>
                            ) : (
                                examData.parsed_questions.map((q: any, index: number) => (
                                    <div key={q.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 pb-2 border-b border-gray-100">{q.part}</h3>
                                        <p className="text-gray-900 font-medium mb-4 whitespace-pre-wrap">{q.text}</p>
                                        {q.type === 'qcm' ? (
                                            <div className="space-y-2">
                                                {q.options?.map((opt: string, i: number) => (
                                                    <label key={i} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${answers[q.id] === opt ? 'bg-[#e8eaf6] border-[#1a237e]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                                                        <input
                                                            type="radio"
                                                            name={`q_${q.id}`}
                                                            className="mt-1"
                                                            checked={answers[q.id] === opt}
                                                            onChange={() => setAnswers({ ...answers, [q.id]: opt })}
                                                        />
                                                        <span className="text-sm font-medium text-gray-800">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        ) : (
                                            <RichTextEditor
                                                value={answers[q.id] || ""}
                                                onChange={(html) => setAnswers({ ...answers, [q.id]: html })}
                                                placeholder="Rédigez votre réponse ici — texte, tableaux, listes…"
                                                minHeight="140px"
                                            />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Submission + Log */}
                <div className="flex-1 flex flex-col gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border p-6 flex-1 flex flex-col justify-center" style={{ borderColor: "#c5cae9" }}>
                        <h2 className="font-black text-gray-900 mb-2 text-lg">Soumission</h2>
                        <p className="text-sm text-gray-500 mb-6 font-medium">
                            Vérifiez vos réponses avant de soumettre. Une fois l'épreuve validée, vous ne pourrez plus y revenir.
                        </p>
                        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl border border-emerald-100 mb-6 flex items-center justify-between">
                            <span className="font-bold text-sm">Réponses saisies</span>
                            <span className="font-black text-lg">{Object.values(answers).filter(v => v !== "" && v !== "<p></p>").length} / {examData.parsed_questions?.length || 0}</span>
                        </div>
                        <button
                            onClick={submitExam}
                            disabled={isSubmitting || (Object.keys(answers).length === 0 && examData.parsed_questions?.length > 0)}
                            className="w-full py-4 text-white rounded-xl font-black transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ backgroundColor: "#1a237e" }}
                        >
                            {isSubmitting ? (
                                <><Loader2 className="h-5 w-5 animate-spin" /> Envoi sécurisé en cours...</>
                            ) : (
                                <><CheckCircle2 className="h-5 w-5" /> Soumettre l'examen définitivement</>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Surveillance Webcam Overlay */}
            <div className={`fixed bottom-4 right-4 z-50 rounded-xl overflow-hidden shadow-2xl border border-gray-600 w-48 h-36 bg-black transition-all ${isCameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <video ref={videoRefCallback} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                    REC
                </div>
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
    );
}