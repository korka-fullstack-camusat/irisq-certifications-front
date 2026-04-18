"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search, File as FileIcon, X, Eye, Loader2, ClipboardList,
    AlertTriangle, ShieldAlert, CheckCircle2, UserCheck, XCircle, Clock,
    Edit3, ShieldCheck, Camera
} from "lucide-react";
import { fetchForms, fetchResponses, updateExamGrade, fetchExams, API_URL } from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

export default function CorrectionsPage() {
    const [responses, setResponses] = useState<any[]>([]);
    const [exams, setExams] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
    const [showAlertsModal, setShowAlertsModal] = useState(false);

    // Form states for grading
    const [grade, setGrade] = useState("");
    const [status, setStatus] = useState("Acquis");
    const [comments, setComments] = useState("");
    const [isSubmittingGrade, setIsSubmittingGrade] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

    useEffect(() => {
        const loadCorrectionsData = async () => {
            try {
                const allExams = await fetchExams();
                setExams(allExams);

                const formsData = await fetchForms();
                if (formsData.length > 0) {
                    const formId = formsData[0]._id;
                    const allResponses = await fetchResponses(formId);

                    const submittedResponses = allResponses.filter((r: any) =>
                        r.status === 'approved' && (r.exam_answers || r.exam_document !== undefined)
                    );
                    setResponses(submittedResponses);
                }
            } catch (error) {
                console.error("Failed to load corrections data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadCorrectionsData();
    }, []);

    const generateId = (r: any) => r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;

    const formatDate = (isoString: string) => {
        if (!isoString) return "Inconnu";
        return new Date(isoString).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const handleOpenCorrection = (submission: any) => {
        setSelectedSubmission(submission);
        setGrade(submission.exam_grade || "");
        setStatus(submission.exam_status || "Acquis");
        setComments(submission.exam_comments || "");
    };

    const handleSubmitGrade = async () => {
        if (!grade || !selectedSubmission) return;
        setIsSubmittingGrade(true);
        try {
            const updatedResponse = await updateExamGrade(selectedSubmission._id, {
                exam_grade: grade,
                exam_status: status,
                exam_comments: comments
            });
            setResponses(prev => prev.map(r => r._id === updatedResponse._id ? updatedResponse : r));
            setSelectedSubmission(null);
            alert("La correction a été sauvegardée avec succès.");
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de la correction", error);
            alert("Une erreur est survenue.");
        } finally {
            setIsSubmittingGrade(false);
        }
    };

    const filteredResponses = responses.filter(r => {
        const candidateId = generateId(r);
        return candidateId.includes(searchQuery.toUpperCase());
    });

    const hasCheatAlerts = selectedSubmission?.cheat_alerts && selectedSubmission.cheat_alerts.length > 0;

    return (
        <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">
            {/* ── En-tête ── */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
                    Resultats des Corrections
                </h1>
                <p className="text-gray-400 text-sm mt-1">Évaluez les copies soumises par les candidats.</p>
            </div>

            {/* ── Recherche ── */}
            <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#c5cae9" }}>
                <Search className="text-[#1a237e] h-5 w-5" />
                <input
                    type="text"
                    placeholder="Chercher par ID Candidat (CAND-XXXXXX)..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* ── Liste des copies ── */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-[#1a237e]">
                    <Loader2 className="h-8 w-8 animate-spin mb-4" />
                    <p className="text-sm font-bold animate-pulse">Chargement des copies...</p>
                </div>
            ) : filteredResponses.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                    <div className="w-16 h-16 bg-[#e8eaf6] rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="h-8 w-8 text-[#1a237e]" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Aucune copie en attente</h3>
                    <p className="text-gray-500 text-sm max-w-sm mx-auto">
                        Il n'y a pas encore de copies soumises ou correspondant à votre recherche.
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-[#f8f9fa] border-b text-xs uppercase font-bold text-[#1a237e]" style={{ borderColor: "#e8eaf6" }}>
                                <tr>
                                    <th className="px-6 py-4">ID Candidat</th>
                                    <th className="px-6 py-4">Certification</th>
                                    <th className="px-6 py-4">Anti-Triche</th>
                                    <th className="px-6 py-4">Statut Correction</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: "#f0f2f5" }}>
                                {filteredResponses.map((r) => {
                                    const hasCheatAlerts = r.cheat_alerts && r.cheat_alerts.length > 0;
                                    const isGraded = !!r.exam_grade;

                                    return (
                                        <tr key={r._id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs">
                                                        {generateId(r).slice(-4)}
                                                    </div>
                                                    <span className="font-bold text-gray-900 tracking-wide">{generateId(r)}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-700">{r.profile}</td>
                                            <td className="px-6 py-4">
                                                {hasCheatAlerts ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                                        <ShieldAlert className="h-3.5 w-3.5" />
                                                        {r.cheat_alerts.length} Alerte(s)
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                        <ShieldCheck className="h-3.5 w-3.5" />
                                                        Clean
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isGraded ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                        Noté ({r.exam_grade})
                                                    </span>
                                                ) : r.assigned_examiner_email ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                        <UserCheck className="h-3.5 w-3.5" />
                                                        Assigné
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                        À corriger
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleOpenCorrection(r)}
                                                    className="inline-flex items-center justify-center p-2 rounded-xl border border-gray-200 text-[#1a237e] hover:bg-[#1a237e] hover:border-[#1a237e] hover:text-white transition-all shadow-sm group"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Modal de Correction ── */}
            <AnimatePresence>
                {selectedSubmission && (
                    <div className="fixed inset-0 z-50 flex overflow-hidden bg-gray-900/40 backdrop-blur-sm justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0"
                            onClick={() => setSelectedSubmission(null)}
                        />

                        <motion.div
                            initial={{ x: "100%", boxShadow: "-20px 0 40px rgba(0,0,0,0)" }}
                            animate={{ x: 0, boxShadow: "-20px 0 40px rgba(0,0,0,0.15)" }}
                            exit={{ x: "100%", boxShadow: "-20px 0 40px rgba(0,0,0,0)" }}
                            transition={{ type: "spring", damping: 30, stiffness: 200 }}
                            className="relative w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col z-10"
                        >
                            {/* Header */}
                            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: "#1a237e", borderColor: "#283593" }}>
                                <div className="flex items-center gap-3 text-white">
                                    <div className="bg-white/10 p-2 rounded-lg">
                                        <ClipboardList className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold">Correction Copie</h2>
                                        <p className="text-xs text-white/70 font-mono tracking-wider">{generateId(selectedSubmission)}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {hasCheatAlerts && (
                                        <button
                                            onClick={() => setShowAlertsModal(true)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-500 hover:bg-rose-400 text-white transition-colors border border-rose-400"
                                        >
                                            <ShieldAlert className="h-3.5 w-3.5" />
                                            Voir Alertes ({selectedSubmission.cheat_alerts.length})
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setSelectedSubmission(null)}
                                        className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                            </div>

                            {/* Scrollable Content */}
                            <div className="flex-1 overflow-y-auto bg-gray-50 flex flex-col relative">

                                {/* Correcteur assigné */}
                                <div className="mx-6 mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="px-4 py-2 border-b border-gray-100" style={{ backgroundColor: "#e8eaf6" }}>
                                        <p className="text-xs font-bold text-[#1a237e]">Correcteur Assigné</p>
                                    </div>
                                    <div className="px-4 py-3 flex items-center gap-2 w-full">
                                        <UserCheck className="h-4 w-4 shrink-0 text-[#1a237e]" />
                                        {selectedSubmission.assigned_examiner_email ? (
                                            <span className="text-sm font-semibold text-gray-800">
                                                {selectedSubmission.assigned_examiner_email}
                                            </span>
                                        ) : (
                                            <span className="text-sm text-gray-400 italic">Aucun correcteur assigné</span>
                                        )}
                                    </div>
                                </div>

                                {/* Vérification Webcam */}
                                {selectedSubmission.candidate_photos && selectedSubmission.candidate_photos.length > 0 && (
                                    <div className="mx-6 mt-6 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#e8eaf6" }}>
                                            <p className="text-xs font-bold text-[#1a237e] flex items-center gap-1.5"><Camera className="h-4 w-4" /> Surveillance Webcam</p>
                                            <span className="text-[10px] font-bold text-[#1a237e] bg-white px-2 py-0.5 rounded-full">{selectedSubmission.candidate_photos.length} Photos</span>
                                        </div>
                                        <div className="p-4 flex gap-4 overflow-x-auto">
                                            {selectedSubmission.candidate_photos.map((photoUrl: string, i: number) => {
                                                const baseUrl = API_URL.replace("/api", "");
                                                const fullUrl = photoUrl.startsWith('http') ? photoUrl : `${baseUrl}${photoUrl}`;
                                                let label = "Capture";
                                                if (i === 0) label = "Début d'épreuve";
                                                else if (i === selectedSubmission.candidate_photos.length - 1) label = "Fin d'épreuve";
                                                else label = "Milieu d'épreuve";

                                                return (
                                                    <div key={i} className="flex-shrink-0 flex flex-col items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setPreviewFile({ url: fullUrl, title: `Surveillance ${i + 1}` })}
                                                            className="h-24 w-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-[#1a237e] transition-colors"
                                                        >
                                                            <img src={fullUrl} alt={`Surveillance ${i + 1}`} className="w-full h-full object-cover" />
                                                        </button>
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase">{label}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Copie (Document PDF/Word) */}
                                {selectedSubmission.exam_document && (
                                    <div className="m-6 p-6 bg-white rounded-xl border border-dashed border-gray-300 text-center flex flex-col items-center">
                                        <FileIcon className="h-10 w-10 text-gray-400 mb-2" />
                                        <h3 className="font-bold text-gray-800">Copie format Fichier</h3>
                                        <p className="text-sm text-gray-500 mb-4">Le candidat a soumis un fichier pour son examen.</p>
                                        <button
                                            type="button"
                                            onClick={() => setPreviewFile({
                                                url: (selectedSubmission.exam_document.startsWith('http') ? '' : API_URL.replace('/api', '')) + selectedSubmission.exam_document,
                                                title: `Copie — ${generateId(selectedSubmission)}`,
                                            })}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a237e] text-white font-bold rounded-lg text-sm transition-transform hover:scale-105"
                                        >
                                            <Eye className="h-4 w-4" />
                                            Visualiser la copie
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Footer: Grading Form */}
                            <div className="bg-white border-t p-6 flex flex-col gap-6" style={{ borderColor: "#e0e0e0", boxShadow: "0 -10px 40px -5px rgba(0,0,0,0.05)" }}>
                                <div>
                                    <h3 className="text-sm font-black text-gray-800 mb-4 flex items-center gap-2">
                                        <Edit3 className="h-4 w-4 text-[#1a237e]" />
                                        Jury d'Évaluation
                                    </h3>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Note de l'examen</label>
                                            <input
                                                type="text"
                                                placeholder="Ex: 85%"
                                                className="w-full border border-gray-200 text-gray-900 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 bg-gray-50 text-sm font-bold"
                                                style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                                                value={grade}
                                                onChange={(e) => setGrade(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-600 mb-1">Décision Finale</label>
                                            <select
                                                className="w-full border border-gray-200 text-gray-900 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 bg-gray-50 text-sm font-bold"
                                                style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                                                value={status}
                                                onChange={(e) => setStatus(e.target.value)}
                                            >
                                                <option value="Acquis">Acquis (Certifié)</option>
                                                <option value="Non Acquis">Non Acquis</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-xs font-bold text-gray-600 mb-1">Observations / Remarques</label>
                                        <textarea
                                            placeholder="Commentaires pour le candidat..."
                                            className="w-full border border-gray-200 text-gray-900 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 bg-gray-50 text-sm"
                                            style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                                            rows={3}
                                            value={comments}
                                            onChange={(e) => setComments(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        onClick={handleSubmitGrade}
                                        disabled={!grade || isSubmittingGrade}
                                        className="w-full py-3.5 text-white rounded-xl font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                                        style={{ backgroundColor: "#2e7d32" }}
                                    >
                                        {isSubmittingGrade ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="h-4 w-4" />
                                        )}
                                        Enregistrer la correction
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ── Modal Alertes Anti-Triche ── */}
            <AnimatePresence>
                {showAlertsModal && selectedSubmission && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }}
                            transition={{ type: "spring", damping: 25, stiffness: 260 }}
                            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
                        >
                            {/* Header */}
                            <div className="px-6 py-4 flex items-center justify-between bg-rose-600">
                                <div className="flex items-center gap-3 text-white">
                                    <div className="bg-white/15 p-2 rounded-lg">
                                        <ShieldAlert className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-bold">Rapport Anti-Triche</h2>
                                        <p className="text-xs text-white/70 font-mono tracking-wider">
                                            {generateId(selectedSubmission)} — {selectedSubmission.cheat_alerts.length} alerte(s) détectée(s)
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowAlertsModal(false)}
                                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Alerts List */}
                            <div className="p-6 max-h-[60vh] overflow-y-auto bg-rose-50">
                                <ul className="space-y-3">
                                    {selectedSubmission.cheat_alerts.map((alert: string, i: number) => (
                                        <li
                                            key={i}
                                            className="flex items-start gap-3 bg-white border border-rose-200 rounded-xl px-4 py-3 shadow-sm"
                                        >
                                            <div className="mt-0.5 flex-shrink-0 h-5 w-5 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 font-black text-xs">
                                                {i + 1}
                                            </div>
                                            <p className="text-sm font-mono text-rose-900 leading-relaxed">{alert}</p>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Footer */}
                            <div className="px-6 py-4 bg-white border-t border-rose-100 flex justify-end">
                                <button
                                    onClick={() => setShowAlertsModal(false)}
                                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold transition-colors"
                                >
                                    Fermer
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

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