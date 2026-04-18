"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
    ArrowLeft,
    CheckCircle2,
    FileText,
    Download,
    Mail,
    User,
    MessageSquareWarning,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    Eye,
} from "lucide-react";

import {
    fetchResponse,
    updateDocumentsValidation,
    requestDocumentResubmit,
    updateResponseStatus,
    type DocumentValidationEntry,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const DOC_KEYS = [
    { key: "CV", label: "Curriculum Vitae" },
    { key: "Pièce d'identité", label: "Pièce d'identité" },
    { key: "Justificatif d'expérience", label: "Justificatif d'expérience" },
    { key: "Diplômes", label: "Diplômes / attestations" },
];

function extractUrl(value: unknown): string | null {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (Array.isArray(value) && value.length > 0) {
        const first = value[0];
        if (typeof first === "string") return first;
    }
    return null;
}

export default function CandidateDossierPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const params = useParams<{ id: string; candidatId: string }>();
    const sessionId = params?.id as string;
    const candidatId = params?.candidatId as string;

    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [resubmitTarget, setResubmitTarget] = useState<string | null>(null);
    const [resubmitMessage, setResubmitMessage] = useState("");
    const [sendingResubmit, setSendingResubmit] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    async function load() {
        try {
            setLoading(true);
            const r = await fetchResponse(candidatId);
            setResponse(r);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (candidatId) load();
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

    const allValid =
        availableDocs.length > 0 &&
        availableDocs.every(d => validation[d.key]?.valid === true) &&
        !availableDocs.some(d => validation[d.key]?.resubmit_requested);

    async function toggleValid(docKey: string, nextValid: boolean) {
        if (!response) return;
        const next: Record<string, DocumentValidationEntry> = {
            ...validation,
            [docKey]: {
                ...(validation[docKey] || {}),
                valid: nextValid,
                resubmit_requested: nextValid ? false : validation[docKey]?.resubmit_requested,
            },
        };
        try {
            setSaving(true);
            const updated = await updateDocumentsValidation(response._id, next);
            setResponse(updated);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur");
        } finally {
            setSaving(false);
        }
    }

    async function submitResubmit() {
        if (!response || !resubmitTarget) return;
        try {
            setSendingResubmit(true);
            await requestDocumentResubmit(response._id, {
                document_name: resubmitTarget,
                message: resubmitMessage.trim() || undefined,
            });
            setResubmitTarget(null);
            setResubmitMessage("");
            await load();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur");
        } finally {
            setSendingResubmit(false);
        }
    }

    async function validateCandidacy() {
        if (!response) return;
        try {
            setValidating(true);
            const updated = await updateResponseStatus(response._id, "approved");
            setResponse(updated);
            alert("Candidature validée. Un email a été envoyé au candidat.");
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur");
        } finally {
            setValidating(false);
        }
    }

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

    return (
        <div className="space-y-6">
            <Link
                href={`/dashboard/sessions/${sessionId}`}
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="h-3 w-3" /> Retour à la session
            </Link>

            {/* ── Dossier header ── */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-4">
                        <div
                            className="h-14 w-14 rounded-2xl flex items-center justify-center text-white text-lg font-black"
                            style={{ backgroundColor: "#1a237e" }}
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
                            </div>
                        </div>
                    </div>
                    <span
                        className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-full"
                        style={{
                            backgroundColor:
                                response.status === "approved"
                                    ? "#e8f5e9"
                                    : response.status === "rejected"
                                        ? "#ffebee"
                                        : "#fff8e1",
                            color:
                                response.status === "approved"
                                    ? "#2e7d32"
                                    : response.status === "rejected"
                                        ? "#c62828"
                                        : "#b45309",
                        }}
                    >
                        {response.status}
                    </span>
                </div>
            </div>

            {/* ── Documents checklist ── */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                        <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                        Documents du candidat
                    </h2>
                    {saving && <span className="text-[11px] text-gray-400">Enregistrement…</span>}
                </div>

                {availableDocs.length === 0 ? (
                    <p className="text-sm text-gray-400">Aucun document n&apos;a été joint par le candidat.</p>
                ) : (
                    <div className="space-y-3">
                        {availableDocs.map(doc => {
                            const v = validation[doc.key] || {};
                            const isValid = v.valid === true;
                            const hasIssue = !!v.resubmit_requested;
                            return (
                                <div
                                    key={doc.key}
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor: hasIssue ? "#fecaca" : isValid ? "#c8e6c9" : "#e5e7eb",
                                        backgroundColor: hasIssue ? "#fff5f5" : isValid ? "#f1f8f4" : "#f9fafb",
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3 flex-wrap">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div
                                                className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                                                style={{ backgroundColor: "#e8eaf6" }}
                                            >
                                                <FileText className="h-4 w-4" style={{ color: "#1a237e" }} />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-gray-800 text-sm">{doc.label}</p>
                                                <button
                                                    type="button"
                                                    onClick={() => doc.url && setPreviewFile({ url: doc.url, title: doc.label })}
                                                    className="text-[11px] text-indigo-600 hover:underline truncate inline-flex items-center gap-1 mt-0.5"
                                                >
                                                    <Eye className="h-3 w-3" />
                                                    Visualiser
                                                </button>
                                                {v.notes && (
                                                    <p className="text-[11px] text-gray-500 mt-1 italic">{v.notes}</p>
                                                )}
                                                {hasIssue && (
                                                    <p className="text-[11px] text-red-600 font-semibold mt-1 inline-flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Relance envoyée au candidat
                                                        {v.resubmit_requested_at &&
                                                            ` — ${new Date(v.resubmit_requested_at).toLocaleDateString("fr-FR")}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => doc.url && setPreviewFile({ url: doc.url, title: doc.label })}
                                                className="p-2 rounded-lg border text-gray-500 hover:text-gray-800 hover:bg-white"
                                                style={{ borderColor: "#e0e0e0" }}
                                                title="Aperçu"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </button>
                                            <a
                                                href={doc.url || "#"}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="p-2 rounded-lg border text-gray-500 hover:text-gray-800 hover:bg-white"
                                                style={{ borderColor: "#e0e0e0" }}
                                                title="Télécharger"
                                            >
                                                <Download className="h-4 w-4" />
                                            </a>
                                            {response.status !== "approved" && (
                                                <>
                                                    <label
                                                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer select-none"
                                                        style={{
                                                            borderColor: isValid ? "#2e7d32" : "#e0e0e0",
                                                            backgroundColor: isValid ? "#e8f5e9" : "white",
                                                            color: isValid ? "#2e7d32" : "#555",
                                                        }}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4"
                                                            checked={isValid}
                                                            disabled={hasIssue || saving}
                                                            onChange={e => toggleValid(doc.key, e.target.checked)}
                                                        />
                                                        <span className="text-xs font-bold">
                                                            {isValid ? "Valide" : "Valider"}
                                                        </span>
                                                    </label>
                                                    <button
                                                        onClick={() => {
                                                            setResubmitTarget(doc.key);
                                                            setResubmitMessage("");
                                                        }}
                                                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border text-xs font-bold"
                                                        style={{
                                                            borderColor: "#fecaca",
                                                            color: "#c62828",
                                                            backgroundColor: "white",
                                                        }}
                                                        title="Relancer le candidat par email pour ce document"
                                                    >
                                                        <MessageSquareWarning className="h-3 w-3" />
                                                        Relancer
                                                    </button>
                                                </>
                                            )}
                                            {response.status === "approved" && isValid && (
                                                <span
                                                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-bold"
                                                    style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}
                                                >
                                                    <CheckCircle2 className="h-3 w-3" /> Validé
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {response.status === "approved" ? (
                    <div className="pt-4 border-t border-gray-100">
                        <div
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                            style={{ backgroundColor: "#e8f5e9", color: "#2e7d32", border: "1px solid #c8e6c9" }}
                        >
                            <ShieldCheck className="h-4 w-4" />
                            Candidature validée — aucune action complémentaire requise.
                        </div>
                    </div>
                ) : (
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between flex-wrap gap-3">
                        <p className="text-xs text-gray-500">
                            {allValid
                                ? "Tous les documents sont validés. Vous pouvez valider la candidature."
                                : "La candidature peut être validée uniquement lorsque tous les documents sont cochés comme valides et qu'aucun document n'est en attente de relance."}
                        </p>
                        <button
                            onClick={validateCandidacy}
                            disabled={!allValid || validating}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                            style={{
                                backgroundColor: allValid ? "#2e7d32" : "#9ca3af",
                                boxShadow: allValid ? "0 6px 16px rgba(46,125,50,0.25)" : "none",
                            }}
                        >
                            <ShieldCheck className="h-4 w-4" />
                            {validating ? "Validation…" : "Valider la candidature"}
                        </button>
                    </div>
                )}
            </div>

            {/* ── File preview modal ── */}
            {previewFile && (
                <FilePreviewModal
                    url={previewFile.url}
                    title={previewFile.title}
                    onClose={() => setPreviewFile(null)}
                />
            )}

            {/* ── Resubmit modal ── */}
            {resubmitTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div
                            className="px-6 py-4 flex items-center gap-2"
                            style={{ backgroundColor: "#c62828" }}
                        >
                            <MessageSquareWarning className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">
                                Demande de renvoi
                            </span>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Envoyer un email au candidat pour qu&apos;il renvoie le document suivant :
                            </p>
                            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800">
                                {resubmitTarget}
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                    Message (optionnel)
                                </label>
                                <textarea
                                    value={resubmitMessage}
                                    onChange={e => setResubmitMessage(e.target.value)}
                                    rows={3}
                                    placeholder="Précisez ce qui ne va pas avec le document…"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setResubmitTarget(null);
                                        setResubmitMessage("");
                                    }}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={submitResubmit}
                                    disabled={sendingResubmit}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                                    style={{ backgroundColor: "#c62828" }}
                                >
                                    {sendingResubmit ? "Envoi…" : "Envoyer l'email"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
