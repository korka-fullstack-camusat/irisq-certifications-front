"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchResponse, assignExaminer, submitFinalEvaluation, API_URL } from "@/lib/api";
import {
    File as FileIcon, Loader2, AlertTriangle, ShieldCheck, UserPlus, FileText, CheckCircle,
    ChevronLeft, Eye
} from "lucide-react";
import Image from "next/image";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const HIDDEN_FIELDS = [
    "Nom", "Prénom", "Date de naissance", "Lieu de naissance",
    "Nationalité", "Adresse", "Téléphone", "Email", "Déclaration acceptée",
    "Expérience (années)", "Pièces justificatives", "CV", "Autres documents"
];

export default function CandidateDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [candidate, setCandidate] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [examinerEmail, setExaminerEmail] = useState("");
    const [isAssigning, setIsAssigning] = useState(false);

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
        if (!isoString) return "Inconnu";
        return new Date(isoString).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric'
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
                alert("Le correcteur a été retiré avec succès.");
            } else {
                alert("Le correcteur a été assigné avec succès.");
            }
        } catch (error) {
            console.error("Failed to assign examiner:", error);
            alert("Erreur lors de l'opération sur le correcteur.");
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
                final_appreciation: finalAppreciation
            });
            setCandidate({
                ...candidate,
                final_grade: finalGrade,
                final_appreciation: finalAppreciation,
                status: "evaluated"
            });
            alert("Évaluation finale soumise avec succès !");
            router.push("/evaluateur");
        } catch (err) {
            console.error(err);
            alert("Erreur lors de la soumission de l'évaluation.");
        } finally {
            setIsSubmittingEvaluation(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f6f9] text-[#1a237e]">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p className="text-sm font-bold animate-pulse">Chargement du dossier...</p>
            </div>
        );
    }

    if (!candidate) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f4f6f9]">
                <AlertTriangle className="h-12 w-12 text-rose-500 mb-4" />
                <h2 className="text-xl font-bold text-[#1a237e]">Candidat introuvable</h2>
                <button onClick={() => router.push("/evaluateur")} className="mt-4 px-4 py-2 bg-[#1a237e] text-white rounded-lg">Retour</button>
            </div>
        );
    }

    return (
        <div className="bg-[#f4f6f9] min-h-screen font-sans">
            {/* Header Sticky */}
            <div className="sticky top-0 z-40 bg-white border-b shadow-sm" style={{ borderColor: "#c5cae9" }}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push("/evaluateur")}
                            className="p-2 bg-gray-50 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 transition-colors"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <h1 className="text-xl font-black text-[#1a237e] uppercase tracking-wide">Dossier Candidat</h1>
                            <p className="text-sm font-bold text-gray-500">{generateId(candidate)}</p>
                        </div>
                    </div>
                    {candidate.assigned_examiner_email && (
                        <div className="hidden sm:flex items-center gap-2 bg-[#e8eaf6] text-[#1a237e] px-3 py-1.5 rounded-lg border border-[#c5cae9]">
                            <UserPlus className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider text-[#1a237e]">Assigné à</span>
                            <span className="text-sm font-black">{candidate.assigned_examiner_email}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Infos */}
                <div className="lg:col-span-1 space-y-6">

                    {/* Meta Card */}
                    <div className="bg-white rounded-2xl shadow-sm border p-6" style={{ borderColor: "#c5cae9" }}>
                        <div className="mb-6 pb-6 border-b border-gray-100 text-center">
                            <div className="w-20 h-20 bg-[#e8eaf6] text-[#1a237e] rounded-full flex items-center justify-center mx-auto text-2xl font-black mb-3 border-4 border-white shadow-md">
                                {generateId(candidate).slice(-4)}
                            </div>
                            <h2 className="text-xl font-bold text-gray-900">{generateId(candidate)}</h2>
                            <p className="text-sm text-gray-500 font-medium">Soumis le {formatDate(candidate.submitted_at)}</p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <p className="text-xs font-bold text-[#1a237e] uppercase tracking-wider mb-1">Certification Demandée</p>
                                <p className="text-sm font-semibold text-gray-800 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    {candidate.answers?.["Certification souhaitée"] || "Non spécifiée"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-bold text-[#1a237e] uppercase tracking-wider mb-1">Alertes Anti-Triche</p>
                                {candidate.exam_document ? (
                                    <div className={`p-3 rounded-xl border flex items-center gap-2 font-bold text-sm ${(candidate.cheat_alerts?.length || 0) > 0 ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                        }`}>
                                        {(candidate.cheat_alerts?.length || 0) > 0 ? <AlertTriangle className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                        {(candidate.cheat_alerts?.length || 0)} Alerte{(candidate.cheat_alerts?.length || 0) !== 1 ? 's' : ''}
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium text-gray-400 italic bg-gray-50 p-3 rounded-xl border border-gray-100">Examen non passé</p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Assigner Correcteur */}
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                        <div className="px-6 py-4 bg-[#f8f9fa] border-b" style={{ borderColor: "#e8eaf6" }}>
                            <h3 className="text-xs font-black uppercase tracking-wider text-[#1a237e] flex items-center gap-2">
                                <UserPlus className="h-4 w-4" /> Correcteur
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="flex flex-col gap-3">
                                <label className="text-xs font-bold text-gray-500 uppercase">Adresse Email</label>
                                <input
                                    type="email"
                                    placeholder="Ex: correcteur@irisq.sn"
                                    value={examinerEmail}
                                    onChange={(e) => setExaminerEmail(e.target.value)}
                                    className="bg-gray-50 border border-gray-200 text-sm text-gray-900 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
                                />
                                <div className="flex flex-col gap-2 mt-2">
                                    <button
                                        onClick={() => handleAssignExaminer("assign")}
                                        disabled={!examinerEmail || isAssigning}
                                        className="w-full py-3 bg-[#1a237e] text-white text-sm font-bold rounded-xl transition-colors hover:bg-[#283593] disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
                                    >
                                        {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assigner / Modifier"}
                                    </button>
                                    {candidate.assigned_examiner_email && (
                                        <button
                                            onClick={() => handleAssignExaminer("remove")}
                                            disabled={isAssigning}
                                            className="w-full py-2 bg-white text-rose-600 border border-rose-200 text-sm font-bold rounded-xl transition-colors hover:bg-rose-50 disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {isAssigning ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retirer l'assignation"}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Column: Dossier & Review */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Section Photos de Surveillance */}
                    {candidate.candidate_photos && candidate.candidate_photos.length > 0 && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[#c5cae9]">
                            <div className="px-6 py-4 bg-[#f8f9fa] border-b border-[#e8eaf6]">
                                <h3 className="text-xs font-black uppercase tracking-wider text-[#1a237e] flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4" /> Photos de Surveillance
                                </h3>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Captures automatiques pendant l'examen</p>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {candidate.candidate_photos.map((photoUrl: string, idx: number) => (
                                        <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100 shadow-inner group">
                                            <Image
                                                src={photoUrl.startsWith('http') ? photoUrl : `${API_URL.replace("/api", "")}${photoUrl}`}
                                                alt={`Photo de surveillance ${idx + 1}`}
                                                fill
                                                className="object-contain group-hover:scale-105 transition-transform duration-300"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewFile({
                                                        url: photoUrl.startsWith('http') ? photoUrl : `${API_URL.replace("/api", "")}${photoUrl}`,
                                                        title: `Surveillance ${idx + 1}`,
                                                    })}
                                                    className="text-white text-xs font-bold bg-[#1a237e] px-3 py-1.5 rounded-lg border border-white/20"
                                                >
                                                    Agrandir
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Section Decision Evaluateur (Moved up for better visibility) */}
                    {candidate.exam_document && (
                        <div className="bg-white rounded-2xl shadow-sm border border-[#1a237e]" style={{ boxShadow: "0 10px 40px -10px rgba(26,35,126,0.1)" }}>
                            <div className="px-6 py-4 bg-[#1a237e] text-white rounded-t-xl flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                                    <CheckCircle className="h-5 w-5" /> Décision Finale
                                </h3>
                                {candidate.final_grade && (
                                    <span className="bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">Validé</span>
                                )}
                            </div>
                            <div className="p-6 space-y-6">
                                {/* Corrector Status Summary */}
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Avis du Correcteur</h4>
                                    {candidate.exam_grade || candidate.exam_comments ? (
                                        <div className="flex flex-col sm:flex-row gap-6">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-4 mb-3">
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Note</p>
                                                        <p className="text-xl font-black text-[#1a237e]">{candidate.exam_grade}</p>
                                                    </div>
                                                    <div className="h-8 w-px bg-gray-200"></div>
                                                    <div>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase">Statut</p>
                                                        <p className="text-sm font-bold text-gray-700 mt-1">{candidate.exam_status}</p>
                                                    </div>
                                                </div>
                                                {candidate.exam_comments && (
                                                    <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-100 italic">
                                                        "{candidate.exam_comments}"
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3 text-amber-700 bg-amber-50 p-4 rounded-xl border border-amber-200">
                                            <AlertTriangle className="h-5 w-5" />
                                            <p className="text-sm font-medium">Le correcteur n'a pas encore validé cette copie.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Evaluator Form */}
                                <div>
                                    {candidate.final_grade ? (
                                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                                            <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-3">Votre Décision Enregistrée</h4>
                                            <p className="text-2xl font-black text-emerald-900 mb-2">{candidate.final_grade}</p>
                                            <p className="text-sm text-emerald-800 bg-white p-3 rounded-lg border border-emerald-100">{candidate.final_appreciation}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Prononcer la décision</h4>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Note Finale Officielle</label>
                                                <input
                                                    type="text"
                                                    placeholder="Ex: Admis, 18/20..."
                                                    value={finalGrade}
                                                    onChange={(e) => setFinalGrade(e.target.value)}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#1a237e] focus:border-transparent transition-all shadow-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Appréciation Globale du Comité</label>
                                                <textarea
                                                    placeholder="Observations finales validant la certification..."
                                                    value={finalAppreciation}
                                                    onChange={(e) => setFinalAppreciation(e.target.value)}
                                                    rows={3}
                                                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#1a237e] focus:border-transparent transition-all shadow-sm resize-none"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSubmitEvaluation}
                                                disabled={!finalGrade || !finalAppreciation || isSubmittingEvaluation}
                                                className="w-full py-3 bg-[#1a237e] hover:bg-[#283593] text-white font-bold rounded-xl transition-all disabled:opacity-50 flex justify-center items-center gap-2 shadow-md hover:shadow-lg"
                                            >
                                                {isSubmittingEvaluation ? <Loader2 className="h-5 w-5 animate-spin" /> : "Sceller l'Évaluation Finale"}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Dossier Professionnel (Formulaire d'Inscription) */}
                    <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                        <div className="px-6 py-4 bg-[#f8f9fa] border-b" style={{ borderColor: "#e8eaf6" }}>
                            <h3 className="text-xs font-black uppercase tracking-wider text-[#1a237e]">Dossier Professionnel du Candidat</h3>
                        </div>
                        <div className="p-6">
                            {/* Bandeau anonymisation */}
                            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 border border-amber-200/60 flex items-start gap-3 mb-6">
                                <span className="shrink-0 mt-0.5">⚠️</span>
                                <p>Conformément à nos politiques d'équité, les données personnelles (Nom, Adresse, Contact) du candidat ont été masquées dynamiquement.</p>
                            </div>

                            <div className="space-y-4">
                                {candidate.answers && Object.keys(candidate.answers).length > 0 ? (
                                    Object.entries(candidate.answers)
                                        .filter(([question]) => !HIDDEN_FIELDS.includes(question))
                                        .map(([question, answer]: [string, any], idx) => (
                                            <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-gray-100 bg-[#f8f9fa]">
                                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{question}</p>
                                                </div>
                                                <div className="px-5 py-4">
                                                    {Array.isArray(answer) ? (
                                                        answer.length > 0 ? (
                                                            <div className="flex flex-wrap gap-3">
                                                                {answer.map((url, i) => {
                                                                    const baseUrl = API_URL.replace("/api", "");
                                                                    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
                                                                    return (
                                                                        <button
                                                                            key={i}
                                                                            type="button"
                                                                            onClick={() => setPreviewFile({ url: fullUrl, title: `${question} — Pièce jointe ${i + 1}` })}
                                                                            className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#1a237e]/40 hover:bg-[#e8eaf6] transition-colors group"
                                                                        >
                                                                            <Eye className="h-4 w-4 text-gray-400 group-hover:text-[#1a237e]" />
                                                                            <span className="text-sm font-bold text-gray-600 group-hover:text-[#1a237e]">Pièce jointe {i + 1}</span>
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-sm text-gray-400 italic">Aucune pièce jointe</span>
                                                        )
                                                    ) : typeof answer === 'boolean' ? (
                                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${answer ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                                                            {answer ? "Oui" : "Non"}
                                                        </span>
                                                    ) : (
                                                        <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{String(answer || "—")}</p>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                ) : (
                                    <p className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        Aucune donnée professionnelle qualifiante disponible.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Visionneuse PDF */}
                    {candidate.exam_document && (
                        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                            <div className="px-6 py-4 bg-[#f8f9fa] border-b flex items-center justify-between" style={{ borderColor: "#e8eaf6" }}>
                                <h3 className="text-xs font-black uppercase tracking-wider text-[#1a237e] flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Copie de l'Examen
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setPreviewFile({
                                        url: candidate.exam_document.startsWith('http') ? candidate.exam_document : `${API_URL.replace("/api", "")}${candidate.exam_document}`,
                                        title: `Copie Examen — ${generateId(candidate)}`,
                                    })}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a237e] bg-[#e8eaf6] px-3 py-1.5 rounded-lg hover:bg-[#c5cae9] transition-colors border border-[#c5cae9]"
                                >
                                    <Eye className="h-3.5 w-3.5" />
                                    Aperçu plein écran
                                </button>
                            </div>
                            <div className="h-[800px] w-full bg-gray-200">
                                <iframe
                                    src={candidate.exam_document.startsWith('http') ? candidate.exam_document : `${API_URL.replace("/api", "")}${candidate.exam_document}`}
                                    className="w-full h-full"
                                    title="Copie Examen PDF"
                                />
                            </div>
                        </div>
                    )}

                </div>
            </div>

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
