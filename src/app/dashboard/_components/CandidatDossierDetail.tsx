"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    FileText,
    Download,
    Mail,
    User,
    Loader2,
    ShieldCheck,
    Eye,
    CheckCircle2,
    CalendarDays,
    ClipboardCheck,
    Trophy,
    RotateCcw,
    Minus,
    GraduationCap,
    Send,
    ScrollText,
} from "lucide-react";

import { fetchResponse, API_URL, type DocumentValidationEntry } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FilePreviewModal } from "@/components/FilePreviewModal";
import { AnnotatedCopyModal } from "@/components/AnnotatedCopyModal";

function resolveDocUrl(u: string) {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    return `${API_URL.replace("/api", "")}${u}`;
}

const DOC_KEYS = [
    { key: "CV", label: "Curriculum Vitae" },
    { key: "Pièce d'identité", label: "Pièce d'identité" },
    { key: "Justificatif d'expérience", label: "Justificatif d'expérience" },
    { key: "Diplômes", label: "Diplômes / attestations" },
];

type ProgressKey = "realized" | "passed" | "retake" | "none";

const PROGRESS_META: Record<ProgressKey, { label: string; icon: any; bg: string; color: string; border: string }> = {
    none:     { label: "Pas encore", icon: Minus,        bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" },
    realized: { label: "Réalisé",    icon: ClipboardCheck, bg: "#e8eaf6", color: "#1a237e", border: "#c5cae9" },
    passed:   { label: "Réussi",     icon: Trophy,        bg: "#e8f5e9", color: "#2e7d32", border: "#c8e6c9" },
    retake:   { label: "Rattrapage", icon: RotateCcw,     bg: "#fff8e1", color: "#b26a00", border: "#ffe0b2" },
};

function deriveExamProgress(r: any): ProgressKey {
    const es = (r?.exam_status || "").toString().toLowerCase().trim();
    const hasFinal = !!(r?.final_grade || r?.final_appreciation);
    const hasExam = !!(r?.exam_grade || r?.exam_status || r?.exam_document);
    if (es.includes("non acquis") || es === "rattrapage") return "retake";
    if (hasFinal || es === "acquis" || es === "admis") return "passed";
    if (hasExam) return "realized";
    return "none";
}

function extractUrl(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") return value[0];
    return null;
}

interface Props {
    candidatId: string;
    variant?: "validee" | "certifie";
}

export function CandidatDossierDetail({ candidatId, variant = "validee" }: Props) {
    const { user, isLoading } = useAuth();
    const router = useRouter();

    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);
    const [showAnnotatedModal, setShowAnnotatedModal] = useState(false);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    useEffect(() => {
        if (!candidatId) return;
        (async () => {
            try {
                setLoading(true);
                const r = await fetchResponse(candidatId);
                setResponse(r);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Erreur");
            } finally {
                setLoading(false);
            }
        })();
    }, [candidatId]);

    const validation: Record<string, DocumentValidationEntry> = useMemo(
        () => (response?.documents_validation as any) || {},
        [response],
    );

    const availableDocs = useMemo(() => {
        if (!response) return [];
        const answers = response.answers || {};
        return DOC_KEYS.map(d => {
            const url = extractUrl(answers[d.key]);
            return { ...d, url };
        }).filter(d => d.url);
    }, [response]);

    if (isLoading || !user) return null;

    if (loading) {
        return (
            <div className="p-16 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (error || !response) {
        return (
            <div className="p-8 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error || "Dossier introuvable"}
            </div>
        );
    }

    const candidateName = response.name || "Candidat";
    const candidateEmail = response.email;
    const certification = response.answers?.["Certification souhaitée"] || "—";
    const submittedAt = response.submitted_at;

    return (
        <div className="space-y-6">

            {/* ── Retour (page précédente) ── */}
            <button
                onClick={() => router.back()}
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
            >
                <ArrowLeft className="h-3 w-3" /> Retour
            </button>

            {/* ── Dossier header ── */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                        <div
                            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-black"
                            style={{ backgroundColor: "#2e7d32" }}
                        >
                            {candidateName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>
                                Dossier — {candidateName}
                            </h1>
                            <div className="flex items-center gap-4 mt-1 text-xs text-gray-500 flex-wrap">
                                {response.public_id && (
                                    <span className="font-mono px-2 py-0.5 rounded bg-gray-100">{response.public_id}</span>
                                )}
                                {candidateEmail && (
                                    <span className="inline-flex items-center gap-1">
                                        <Mail className="h-3 w-3" /> {candidateEmail}
                                    </span>
                                )}
                                <span className="inline-flex items-center gap-1">
                                    <User className="h-3 w-3" /> {certification}
                                </span>
                                {submittedAt && (
                                    <span className="inline-flex items-center gap-1">
                                        <CalendarDays className="h-3 w-3" />
                                        Déposée le {new Date(submittedAt).toLocaleDateString("fr-FR")}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <span
                        className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}
                    >
                        <ShieldCheck className="h-4 w-4" /> Candidature validée
                    </span>
                </div>
            </div>

            {/* ── Statut examen ── */}
            {(() => {
                const pk = deriveExamProgress(response);
                const pmeta = PROGRESS_META[pk];
                const PIcon = pmeta.icon;
                const canSendCertificate = pk === "passed";
                return (
                    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex items-center gap-4 flex-wrap">
                        <div className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: pmeta.bg }}>
                            <GraduationCap className="h-5 w-5" style={{ color: pmeta.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Examen</p>
                            <p className="text-sm font-bold text-gray-800 truncate">Statut actuel du candidat</p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: pmeta.bg, color: pmeta.color, border: `1px solid ${pmeta.border}` }}>
                            <PIcon className="h-4 w-4" /> {pmeta.label}
                        </span>
                        <button
                            type="button"
                            onClick={() => { if (!canSendCertificate) return; alert("Envoi du certificat — à implémenter."); }}
                            disabled={!canSendCertificate}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 shrink-0"
                            style={{
                                backgroundColor: canSendCertificate ? "#2e7d32" : "#9ca3af",
                                boxShadow: canSendCertificate ? "0 6px 16px rgba(46,125,50,0.25)" : undefined,
                            }}
                        >
                            <Send className="h-4 w-4" /> Envoyer certificat
                        </button>
                    </div>
                );
            })()}

            {/* ── Documents (read-only) ── */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                        Documents déposés par le candidat
                    </h2>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                        Consultation uniquement
                    </span>
                </div>

                {availableDocs.length === 0 && !(variant === "validee" && response.exam_document) ? (
                    <p className="text-sm text-gray-400">Aucun document n&apos;a été joint par le candidat.</p>
                ) : (
                    <div className="space-y-3">
                        {availableDocs.map(doc => {
                            const v = validation[doc.key] || {};
                            const isValid = v.valid === true;
                            return (
                                <div key={doc.key} className="rounded-xl border p-4"
                                    style={{ borderColor: isValid ? "#c8e6c9" : "#e5e7eb", backgroundColor: isValid ? "#f1f8f4" : "#f9fafb" }}>
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: "#e8eaf6" }}>
                                                <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-800 text-sm">{doc.label}</p>
                                                <button type="button"
                                                    onClick={() => doc.url && setPreviewFile({ url: doc.url, title: doc.label })}
                                                    className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1 mt-0.5">
                                                    <Eye className="h-3 w-3" /> Visualiser
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {isValid && (
                                                <span className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold"
                                                    style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}>
                                                    <CheckCircle2 className="h-3 w-3" /> Validé
                                                </span>
                                            )}
                                            <button type="button"
                                                onClick={() => doc.url && setPreviewFile({ url: doc.url, title: doc.label })}
                                                className="p-2 rounded-lg border text-gray-500 hover:text-gray-800 hover:bg-white"
                                                style={{ borderColor: "#e0e0e0" }}>
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <a href={doc.url || "#"} target="_blank" rel="noreferrer"
                                                className="p-2 rounded-lg border text-gray-500 hover:text-gray-800 hover:bg-white"
                                                style={{ borderColor: "#e0e0e0" }}>
                                                <Download className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Copie corrigée — ajoutée dans la liste pour variant "validee" */}
                        {variant === "validee" && response.exam_document && (
                            <div className="rounded-xl border p-4"
                                style={{ borderColor: "#e5e7eb", backgroundColor: "#f9fafb" }}>
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: "#e8eaf6" }}>
                                            <ScrollText className="h-4 w-4" style={{ color: "#1a237e" }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm">Copie corrigée</p>
                                            <button type="button"
                                                onClick={() => setShowAnnotatedModal(true)}
                                                className="text-[11px] text-indigo-600 hover:underline inline-flex items-center gap-1 mt-0.5">
                                                <Eye className="h-3 w-3" /> Visualiser (avec notes)
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button type="button"
                                            onClick={() => setShowAnnotatedModal(true)}
                                            className="p-2 rounded-lg border text-gray-500 hover:text-gray-800 hover:bg-white"
                                            style={{ borderColor: "#e0e0e0" }}>
                                            <Eye className="h-4 w-4" />
                                        </button>
                                        <a href={resolveDocUrl(response.exam_document)} target="_blank" rel="noreferrer"
                                            className="p-2 rounded-lg border text-gray-500 hover:text-gray-800 hover:bg-white"
                                            style={{ borderColor: "#e0e0e0" }}>
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>



            {/* ── Copie d'examen — variant "certifie" ── */}
            {variant === "certifie" && response.exam_document && response.is_certified && (
                <div className="bg-white rounded-2xl p-6 border shadow-sm space-y-4"
                    style={{ borderColor: "#c8e6c9" }}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <h2 className="font-bold text-gray-800 flex items-center gap-2">
                            <ScrollText className="h-4 w-4" style={{ color: "#2e7d32" }} />
                            Copie d&apos;examen
                        </h2>
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}>
                            <Trophy className="h-3.5 w-3.5" /> Candidat certifié
                        </span>
                    </div>

                    {/* 3 notes : correcteur + jury + finale */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {response.exam_grade && (
                            <div className="rounded-xl border-2 p-4 text-center"
                                style={{ borderColor: "#fecaca", backgroundColor: "#fff5f5" }}>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#c62828" }}>Note correcteur</p>
                                <p className="text-2xl font-black" style={{ color: "#c62828" }}>{response.exam_grade}</p>
                                {response.exam_appreciation && (
                                    <p className="text-[10px] text-gray-400 mt-1">{response.exam_appreciation}</p>
                                )}
                            </div>
                        )}
                        {response.jury_grade && (
                            <div className="rounded-xl border-2 p-4 text-center"
                                style={{ borderColor: "#90caf9", backgroundColor: "#e3f2fd" }}>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#1565c0" }}>Note jury</p>
                                <p className="text-2xl font-black" style={{ color: "#1565c0" }}>{response.jury_grade}</p>
                                {response.jury_appreciation && (
                                    <p className="text-[10px] text-gray-400 mt-1">{response.jury_appreciation}</p>
                                )}
                            </div>
                        )}
                        {response.final_grade && (
                            <div className="rounded-xl border-2 p-4 text-center"
                                style={{ borderColor: "#c8e6c9", backgroundColor: "#e8f5e9" }}>
                                <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "#2e7d32" }}>Note finale</p>
                                <p className="text-2xl font-black" style={{ color: "#2e7d32" }}>{response.final_grade}</p>
                                {response.final_appreciation && (
                                    <p className="text-[10px] text-gray-400 mt-1">{response.final_appreciation}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Fichier */}
                    <div className="rounded-xl border p-4 flex items-center justify-between gap-4 flex-wrap"
                        style={{ borderColor: "#e5e7eb", backgroundColor: "#f9fafb" }}>
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ backgroundColor: "#e8f5e9" }}>
                                <FileText className="h-5 w-5" style={{ color: "#2e7d32" }} />
                            </div>
                            <div className="min-w-0">
                                <p className="font-bold text-gray-800 text-sm">Copie corrigée</p>
                                <p className="text-[11px] text-gray-400 truncate">
                                    {response.assigned_examiner_email
                                        ? `Corrigée par ${response.assigned_examiner_email}`
                                        : "Copie de l'examen"}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button type="button"
                                onClick={() => setShowAnnotatedModal(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold text-gray-700 hover:bg-white transition-colors"
                                style={{ borderColor: "#d1d5db" }}>
                                <Eye className="h-3.5 w-3.5" /> Visualiser (avec notes)
                            </button>
                            <a href={resolveDocUrl(response.exam_document)} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white transition-all hover:-translate-y-0.5"
                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 4px 12px rgba(46,125,50,0.25)" }}>
                                <Download className="h-3.5 w-3.5" /> Télécharger
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {previewFile && (
                <FilePreviewModal
                    url={previewFile.url}
                    title={previewFile.title}
                    onClose={() => setPreviewFile(null)}
                />
            )}

            <AnnotatedCopyModal
                open={showAnnotatedModal}
                onClose={() => setShowAnnotatedModal(false)}
                examDocument={response?.exam_document || ""}
                answerGrades={response?.answer_grades}
                juryAnswerGrades={response?.jury_answer_grades}
                candidateName={response?.name}
            />
        </div>
    );
}
