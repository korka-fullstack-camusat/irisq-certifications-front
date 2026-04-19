"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
    Loader2,
    Upload,
    CheckCircle2,
    AlertCircle,
    Monitor,
    MapPin,
    BookOpen,
    GraduationCap,
    FileText,
    ArrowLeft,
} from "lucide-react";

import {
    candidateApply,
    uploadFiles,
    fetchPublicCertifications,
    type PublicCertification,
    fetchSessions,
    type Session,
} from "@/lib/api";
import { useCandidate } from "@/lib/candidate-context";

const REQUIRED_DOCS = [
    { key: "CV", label: "Curriculum Vitae (CV)", required: true },
    { key: "Pièce d'identité", label: "Pièce d'identité", required: true },
    { key: "Diplômes", label: "Diplômes / Attestations", required: false },
    { key: "Justificatif d'expérience", label: "Justificatif d'expérience professionnelle", required: false },
];

export default function CandidaterPage({ params }: { params: Promise<{ formId: string }> }) {
    const { formId } = use(params);
    const router = useRouter();
    const { account, refresh } = useCandidate();

    const [certification, setCertification] = useState<PublicCertification | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [examMode, setExamMode] = useState<"online" | "onsite">("online");
    const [examType, setExamType] = useState<"direct" | "after_formation">("direct");
    const [sessionId, setSessionId] = useState("");
    const [uploads, setUploads] = useState<Record<string, File | null>>({});
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});

    useEffect(() => {
        Promise.all([fetchPublicCertifications(), fetchSessions().catch(() => [])])
            .then(([certs, sess]) => {
                const cert = certs.find(c => c._id === formId);
                setCertification(cert || null);
                setSessions(sess);
            })
            .finally(() => setLoading(false));
    }, [formId]);

    async function handleFileChange(docKey: string, file: File | null) {
        if (!file) return;
        setUploads(u => ({ ...u, [docKey]: file }));
        setUploadingDoc(docKey);
        try {
            const fd = new FormData();
            fd.append("files", file);
            const { file_urls } = await uploadFiles(fd);
            setUploadedUrls(u => ({ ...u, [docKey]: file_urls[0] }));
        } catch (e) {
            setError(`Échec de l'upload : ${e instanceof Error ? e.message : "Erreur inconnue"}`);
        } finally {
            setUploadingDoc(null);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        const missingRequired = REQUIRED_DOCS.filter(d => d.required && !uploadedUrls[d.key]);
        if (missingRequired.length > 0) {
            setError(`Documents obligatoires manquants : ${missingRequired.map(d => d.label).join(", ")}`);
            return;
        }

        try {
            setSubmitting(true);
            await candidateApply({
                form_id: formId,
                session_id: sessionId || undefined,
                exam_mode: examMode,
                exam_type: examType,
                answers: uploadedUrls,
            });
            await refresh();
            setSuccess(true);
            setTimeout(() => router.replace("/candidat/dossiers"), 2500);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de la candidature");
        } finally {
            setSubmitting(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!certification) {
        return (
            <div className="text-center py-16">
                <AlertCircle className="h-12 w-12 mx-auto text-red-400 mb-3" />
                <p className="text-gray-700 font-bold">Certification introuvable.</p>
                <button
                    onClick={() => router.back()}
                    className="mt-4 text-sm text-indigo-600 hover:underline"
                >
                    ← Retour
                </button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <CheckCircle2 className="h-16 w-16" style={{ color: "#2e7d32" }} />
                <h2 className="text-xl font-black" style={{ color: "#1a237e" }}>Candidature envoyée !</h2>
                <p className="text-sm text-gray-500">
                    Votre dossier a été soumis. Vous recevrez un email de confirmation.<br />
                    Redirection vers vos dossiers…
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="h-9 w-9 rounded-xl flex items-center justify-center transition-colors hover:bg-gray-100"
                >
                    <ArrowLeft className="h-4 w-4 text-gray-500" />
                </button>
                <div>
                    <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>Candidater</h1>
                    <p className="text-sm text-gray-500">{certification.title}</p>
                </div>
            </div>

            {/* Infos compte (pré-remplies) */}
            <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
            >
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Vos informations (depuis votre compte)</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                    <div>
                        <span className="text-xs text-gray-400 block">Nom complet</span>
                        <span className="font-semibold text-gray-800">{account?.first_name} {account?.last_name}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-400 block">Email</span>
                        <span className="font-semibold text-gray-800">{account?.email}</span>
                    </div>
                    {account?.phone && (
                        <div>
                            <span className="text-xs text-gray-400 block">Téléphone</span>
                            <span className="font-semibold text-gray-800">{account.phone}</span>
                        </div>
                    )}
                    {account?.profile && (
                        <div>
                            <span className="text-xs text-gray-400 block">Profil</span>
                            <span className="font-semibold text-gray-800">{account.profile}</span>
                        </div>
                    )}
                    {account?.company && (
                        <div>
                            <span className="text-xs text-gray-400 block">Entreprise</span>
                            <span className="font-semibold text-gray-800">{account.company}</span>
                        </div>
                    )}
                </div>
            </motion.div>

            <form onSubmit={handleSubmit} className="space-y-5">
                {/* Mode d'examen */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                        Mode de passage de l’examen *
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {([
                            { value: "online", label: "En ligne", icon: Monitor, desc: "Examen à distance" },
                            { value: "onsite", label: "Présentiel", icon: MapPin, desc: "Examen sur site" },
                        ] as const).map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setExamMode(opt.value)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                                style={{
                                    borderColor: examMode === opt.value ? "#1a237e" : "#e5e7eb",
                                    backgroundColor: examMode === opt.value ? "#e8eaf6" : "#fff",
                                }}
                            >
                                <opt.icon
                                    className="h-6 w-6"
                                    style={{ color: examMode === opt.value ? "#1a237e" : "#9ca3af" }}
                                />
                                <span
                                    className="text-sm font-bold"
                                    style={{ color: examMode === opt.value ? "#1a237e" : "#374151" }}
                                >
                                    {opt.label}
                                </span>
                                <span className="text-[10px] text-gray-400">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Type d'examen */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                        Type de passage *
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        {([
                            { value: "direct", label: "Examen direct", icon: BookOpen, desc: "Sans formation préalable" },
                            { value: "after_formation", label: "Après formation", icon: GraduationCap, desc: "Avec formation IRISQ" },
                        ] as const).map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => setExamType(opt.value)}
                                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all"
                                style={{
                                    borderColor: examType === opt.value ? "#2e7d32" : "#e5e7eb",
                                    backgroundColor: examType === opt.value ? "#e8f5e9" : "#fff",
                                }}
                            >
                                <opt.icon
                                    className="h-6 w-6"
                                    style={{ color: examType === opt.value ? "#2e7d32" : "#9ca3af" }}
                                />
                                <span
                                    className="text-sm font-bold"
                                    style={{ color: examType === opt.value ? "#2e7d32" : "#374151" }}
                                >
                                    {opt.label}
                                </span>
                                <span className="text-[10px] text-gray-400">{opt.desc}</span>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Session (optionnelle) */}
                {sessions.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                    >
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                            Session (optionnel)
                        </p>
                        <select
                            value={sessionId}
                            onChange={e => setSessionId(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                        >
                            <option value="">Aucune session spécifique</option>
                            {sessions
                                .filter(s => s.status === "open" || s.status === "active")
                                .map(s => (
                                    <option key={s._id} value={s._id}>{s.name}</option>
                                ))
                            }
                        </select>
                    </motion.div>
                )}

                {/* Documents */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm"
                >
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                        Documents à fournir
                    </p>
                    <div className="space-y-4">
                        {REQUIRED_DOCS.map(doc => {
                            const uploaded = !!uploadedUrls[doc.key];
                            const isUploading = uploadingDoc === doc.key;
                            return (
                                <div key={doc.key}>
                                    <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1.5">
                                        <FileText className="h-3.5 w-3.5 text-gray-400" />
                                        {doc.label}
                                        {doc.required && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                            onChange={e => handleFileChange(doc.key, e.target.files?.[0] || null)}
                                            className="hidden"
                                            id={`file-${doc.key}`}
                                        />
                                        <label
                                            htmlFor={`file-${doc.key}`}
                                            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer transition-all"
                                            style={{
                                                borderColor: uploaded ? "#2e7d32" : "#e5e7eb",
                                                backgroundColor: uploaded ? "#f0fdf4" : "#fafafa",
                                            }}
                                        >
                                            {isUploading ? (
                                                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                            ) : uploaded ? (
                                                <CheckCircle2 className="h-4 w-4" style={{ color: "#2e7d32" }} />
                                            ) : (
                                                <Upload className="h-4 w-4 text-gray-400" />
                                            )}
                                            <span className="text-sm" style={{ color: uploaded ? "#2e7d32" : "#6b7280" }}>
                                                {isUploading
                                                    ? "Upload en cours…"
                                                    : uploaded
                                                    ? uploads[doc.key]?.name || "Fichier téléchargé"
                                                    : "Cliquer pour sélectionner un fichier"}
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {error && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting || !!uploadingDoc}
                    className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 20px rgba(26,35,126,0.25)" }}
                >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <GraduationCap className="h-4 w-4" />}
                    {submitting ? "Envoi en cours…" : "Soumettre ma candidature"}
                </button>
            </form>
        </div>
    );
}
