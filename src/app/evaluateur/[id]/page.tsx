"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchResponse, assignExaminer, submitFinalEvaluation, API_URL } from "@/lib/api";
import {
    Loader2, AlertTriangle, ShieldCheck, UserPlus, FileText, CheckCircle,
    ChevronLeft, Eye, Mail, Calendar, Award, ClipboardCheck,
} from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { FilePreviewModal } from "@/components/FilePreviewModal";

export default function CandidateDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [candidate, setCandidate] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [examinerEmail, setExaminerEmail] = useState("");
    const [isAssigning, setIsAssigning] = useState(false);
    const [assignSuccess, setAssignSuccess] = useState(false);

    const [finalGrade, setFinalGrade] = useState("");
    const [finalAppreciation, setFinalAppreciation] = useState("");
    const [isSubmittingEvaluation, setIsSubmittingEvaluation] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

    useEffect(() => {
        if (!id) return;
        loadCandidateData();
    }, [id]);

    const loadCandidateData = async () => {
        setIsLoading(true);
        try {
            const data = await fetchResponse(id as string);
            setCandidate(data);
            setExaminerEmail(data.assigned_examiner_email || "");
            setFinalGrade(data.final_grade || "");
            setFinalAppreciation(data.final_appreciation || "");
        } catch (error) {
            console.error("Failed to load candidate:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const generateId = (r: any) => r?.candidate_id || `CAND-${r?._id.slice(-6).toUpperCase()}`;

    const formatDate = (isoString?: string) => {
        if (!isoString) return "—";
        return new Date(isoString).toLocaleDateString("fr-FR", {
            day: "numeric", month: "long", year: "numeric",
        });
    };

    const handleAssignExaminer = async (action: "assign" | "remove") => {
        if (action === "assign" && (!examinerEmail || !candidate)) return;
        if (action === "remove" && !candidate) return;
        setIsAssigning(true);
        try {
            const emailToAssign = action === "assign" ? examinerEmail.trim() : "";
            const updatedResponse = await assignExaminer(candidate._id, emailToAssign);
            setCandidate(updatedResponse);
            if (action === "remove") {
                setExaminerEmail("");
            } else {
                setAssignSuccess(true);
                setTimeout(() => setAssignSuccess(false), 2500);
            }
        } catch (error) {
            console.error("Failed to assign examiner:", error);
        } finally {
            setIsAssigning(false);
        }
    };

    const handleSubmitEvaluation = async () => {
        if (!candidate || !finalGrade || !finalAppreciation) return;
        setIsSubmittingEvaluation(true);
        try {
            await submitFinalEvaluation(candidate._id, {
                final_grade: finalGrade,
                final_appreciation: finalAppreciation,
            });
            setCandidate({ ...candidate, final_grade: finalGrade, final_appreciation: finalAppreciation, status: "evaluated" });
            router.push("/evaluateur");
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmittingEvaluation(false);
        }
    };

    // ── Loading ──
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f6f9]">
                <Loader2 className="h-8 w-8 animate-spin text-[#1a237e] mb-3" />
                <p className="text-sm font-bold text-gray-400 animate-pulse">Chargement du dossier…</p>
            </div>
        );
    }

    if (!candidate) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f6f9]">
                <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
                <h2 className="text-xl font-bold text-[#1a237e]">Candidat introuvable</h2>
                <button onClick={() => router.push("/evaluateur")} className="mt-4 px-4 py-2 bg-[#1a237e] text-white rounded-lg text-sm font-bold">
                    Retour à la liste
                </button>
            </div>
        );
    }

    const candId    = generateId(candidate);
    const cert      = candidate.answers?.["Certification souhaitée"] || "Non spécifiée";
    const alertsLen = candidate.cheat_alerts?.length || 0;
    const hasExam   = !!candidate.exam_document;

    return (
        <div className="bg-[#f4f6f9] min-h-screen font-sans">

            {/* ── Sticky Header ── */}
            <div className="sticky top-0 z-40 bg-white border-b shadow-sm" style={{ borderColor: "#e8eaf6" }}>
                <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
                    <button
                        onClick={() => router.push("/evaluateur")}
                        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors shrink-0"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-base font-black text-[#1a237e] truncate">Dossier Candidat</h1>
                        <p className="text-xs text-gray-400 font-semibold">{candId}</p>
                    </div>
                    {/* Statut rapide */}
                    {candidate.final_grade ? (
                        <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Évaluation finalisée
                        </span>
                    ) : hasExam ? (
                        <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                            Copie soumise
                        </span>
                    ) : (
                        <span className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                            En attente d&apos;examen
                        </span>
                    )}
                </div>
            </div>

            {/* ── Main ── */}
            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">

                {/* ════════════════════════════════════════════
                    CARTE CANDIDAT — style modal
                ════════════════════════════════════════════ */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                    style={{ borderColor: "#e8eaf6" }}
                >
                    {/* Top strip */}
                    <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #1a237e 0%, #2e7d32 100%)" }} />

                    <div className="p-6">
                        <div className="flex flex-col sm:flex-row gap-6 items-start">

                            {/* Avatar */}
                            <div className="shrink-0 flex flex-col items-center gap-2">
                                <div
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-md"
                                    style={{ backgroundColor: "#1a237e" }}
                                >
                                    {candId.slice(-4)}
                                </div>
                                <span
                                    className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                    style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}
                                >
                                    {candId}
                                </span>
                            </div>

                            {/* Infos */}
                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                                {/* Certification */}
                                <div className="bg-[#f4f6f9] rounded-xl p-3.5 flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                        <Award className="h-4 w-4" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Certification</p>
                                        <p className="text-sm font-bold text-gray-800 leading-snug">{cert}</p>
                                    </div>
                                </div>

                                {/* Date soumission */}
                                <div className="bg-[#f4f6f9] rounded-xl p-3.5 flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                        <Calendar className="h-4 w-4" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Soumis le</p>
                                        <p className="text-sm font-bold text-gray-800">{formatDate(candidate.submitted_at)}</p>
                                    </div>
                                </div>

                                {/* Statut examen */}
                                <div className="bg-[#f4f6f9] rounded-xl p-3.5 flex items-start gap-3">
                                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                        <ClipboardCheck className="h-4 w-4" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Statut examen</p>
                                        <p className="text-sm font-bold text-gray-800 capitalize">
                                            {candidate.exam_status || "Non passé"}
                                        </p>
                                    </div>
                                </div>

                                {/* Alertes anti-triche */}
                                {hasExam && (
                                    <div className={`rounded-xl p-3.5 flex items-start gap-3 ${alertsLen > 0 ? "bg-rose-50" : "bg-emerald-50"}`}>
                                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${alertsLen > 0 ? "bg-rose-100" : "bg-emerald-100"}`}>
                                            <ShieldCheck className={`h-4 w-4 ${alertsLen > 0 ? "text-rose-600" : "text-emerald-600"}`} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Anti-triche</p>
                                            <p className={`text-sm font-bold ${alertsLen > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                                                {alertsLen} alerte{alertsLen !== 1 ? "s" : ""}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Correcteur assigné — affiché seulement si assigné */}
                                {candidate.assigned_examiner_email && (
                                    <div className="bg-[#f4f6f9] rounded-xl p-3.5 flex items-start gap-3 sm:col-span-2">
                                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                            <Mail className="h-4 w-4" style={{ color: "#1a237e" }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Correcteur assigné</p>
                                            <p className="text-sm font-bold text-[#1a237e] truncate">{candidate.assigned_examiner_email}</p>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ════════════════════════════════════════════
                    DEUX COLONNES : Correcteur  |  Actions
                ════════════════════════════════════════════ */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                    {/* ── Assigner correcteur ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                        style={{ borderColor: "#e8eaf6" }}
                    >
                        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "#e8eaf6" }}>
                            <UserPlus className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                            <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                                Correcteur
                            </h3>
                        </div>
                        <div className="p-5 space-y-3">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                                Adresse e-mail
                            </label>
                            <input
                                type="email"
                                placeholder="correcteur@irisq.sn"
                                value={examinerEmail}
                                onChange={e => setExaminerEmail(e.target.value)}
                                className="w-full bg-[#f4f6f9] border border-gray-200 text-sm text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
                            />
                            <div className="flex gap-2 pt-1">
                                <button
                                    onClick={() => handleAssignExaminer("assign")}
                                    disabled={!examinerEmail || isAssigning}
                                    className="flex-1 py-2.5 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    style={{ backgroundColor: "#1a237e" }}
                                >
                                    {isAssigning ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : assignSuccess ? (
                                        <><CheckCircle className="h-3.5 w-3.5" /> Assigné !</>
                                    ) : (
                                        "Assigner / Modifier"
                                    )}
                                </button>
                                {candidate.assigned_examiner_email && (
                                    <button
                                        onClick={() => handleAssignExaminer("remove")}
                                        disabled={isAssigning}
                                        className="px-4 py-2.5 bg-white text-rose-600 border border-rose-200 text-xs font-bold rounded-xl hover:bg-rose-50 disabled:opacity-50 transition-colors"
                                    >
                                        Retirer
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>

                    {/* ── Décision finale ── */}
                    {hasExam && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                            style={{ borderColor: "#e8eaf6" }}
                        >
                            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#e8eaf6" }}>
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                                    <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>Décision Finale</h3>
                                </div>
                                {candidate.final_grade && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Validé
                                    </span>
                                )}
                            </div>
                            <div className="p-5">
                                {/* Avis correcteur */}
                                {(candidate.exam_grade || candidate.exam_comments) && (
                                    <div className="mb-4 bg-[#f4f6f9] rounded-xl p-4 space-y-1">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Avis du correcteur</p>
                                        <p className="text-lg font-black text-[#1a237e]">{candidate.exam_grade}</p>
                                        {candidate.exam_comments && (
                                            <p className="text-xs text-gray-500 italic">"{candidate.exam_comments}"</p>
                                        )}
                                    </div>
                                )}

                                {candidate.final_grade ? (
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Décision enregistrée</p>
                                        <p className="text-2xl font-black text-emerald-800">{candidate.final_grade}</p>
                                        <p className="text-xs text-emerald-700">{candidate.final_appreciation}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            placeholder="Ex : Admis, 18/20…"
                                            value={finalGrade}
                                            onChange={e => setFinalGrade(e.target.value)}
                                            className="w-full bg-[#f4f6f9] border border-gray-200 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
                                        />
                                        <textarea
                                            placeholder="Appréciation globale du comité…"
                                            value={finalAppreciation}
                                            onChange={e => setFinalAppreciation(e.target.value)}
                                            rows={3}
                                            className="w-full bg-[#f4f6f9] border border-gray-200 text-sm px-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20 resize-none"
                                        />
                                        <button
                                            onClick={handleSubmitEvaluation}
                                            disabled={!finalGrade || !finalAppreciation || isSubmittingEvaluation}
                                            className="w-full py-2.5 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex justify-center items-center gap-2 transition-all"
                                            style={{ backgroundColor: "#1a237e" }}
                                        >
                                            {isSubmittingEvaluation ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sceller l'évaluation finale"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* ════════════════════════════════════════════
                    PHOTOS DE SURVEILLANCE
                ════════════════════════════════════════════ */}
                {candidate.candidate_photos && candidate.candidate_photos.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                        style={{ borderColor: "#e8eaf6" }}
                    >
                        <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: "#e8eaf6" }}>
                            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                            <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                                Photos de surveillance
                            </h3>
                            <span className="ml-auto text-[10px] font-bold text-gray-400">{candidate.candidate_photos.length} capture{candidate.candidate_photos.length > 1 ? "s" : ""}</span>
                        </div>
                        <div className="p-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {candidate.candidate_photos.map((photoUrl: string, idx: number) => {
                                    const fullUrl = photoUrl.startsWith("http") ? photoUrl : `${API_URL.replace("/api", "")}${photoUrl}`;
                                    return (
                                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group">
                                            <Image src={fullUrl} alt={`Surveillance ${idx + 1}`} fill className="object-contain group-hover:scale-105 transition-transform duration-300" />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile({ url: fullUrl, title: `Surveillance ${idx + 1}` })}
                                                    className="text-white text-[11px] font-bold bg-[#1a237e] px-3 py-1.5 rounded-lg border border-white/20"
                                                >
                                                    Agrandir
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ════════════════════════════════════════════
                    COPIE D'EXAMEN — PDF
                ════════════════════════════════════════════ */}
                {hasExam && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-2xl shadow-sm border overflow-hidden"
                        style={{ borderColor: "#e8eaf6" }}
                    >
                        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "#e8eaf6" }}>
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 shrink-0" style={{ color: "#1a237e" }} />
                                <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>Copie de l&apos;examen</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPreviewFile({
                                    url: candidate.exam_document.startsWith("http") ? candidate.exam_document : `${API_URL.replace("/api", "")}${candidate.exam_document}`,
                                    title: `Copie — ${candId}`,
                                })}
                                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors"
                                style={{ color: "#1a237e", backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}
                            >
                                <Eye className="h-3.5 w-3.5" />
                                Plein écran
                            </button>
                        </div>
                        <div className="h-[700px] w-full bg-gray-100">
                            <iframe
                                src={candidate.exam_document.startsWith("http") ? candidate.exam_document : `${API_URL.replace("/api", "")}${candidate.exam_document}`}
                                className="w-full h-full"
                                title="Copie Examen PDF"
                            />
                        </div>
                    </motion.div>
                )}

            </div>

            {/* Preview modal */}
            {previewFile && (
                <FilePreviewModal
                    url={previewFile.url}
                    title={previewFile.title}
                    onClose={() => setPreviewFile(null)}
                />
            )}
        </div>
    );
}
