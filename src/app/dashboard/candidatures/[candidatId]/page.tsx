"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
    ArrowLeft,
    FileText,
    Download,
    Mail,
    User,
    MessageSquareWarning,
    Loader2,
    ShieldCheck,
    AlertTriangle,
    Eye,
    CheckCircle2,
    XCircle,
    Ban,
    Trash2,
} from "lucide-react";

import {
    fetchResponse,
    updateDocumentsValidation,
    requestDocumentResubmit,
    updateResponseStatus,
    deleteResponse,
    type DocumentValidationEntry,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const DOC_KEYS = [
    { key: "CV",                        label: "Curriculum Vitae" },
    { key: "Pièce d'identité",          label: "Pièce d'identité" },
    { key: "Justificatif d'expérience", label: "Justificatif d'expérience" },
    { key: "Diplômes",                  label: "Diplôme" },
    { key: "Attestation de formation",  label: "Attestation de formation" },
];

function extractUrls(value: unknown): string[] {
    if (!value) return [];
    if (typeof value === "string" && value.length > 0) return [value];
    if (Array.isArray(value)) {
        return value.filter((v): v is string => typeof v === "string" && v.length > 0);
    }
    return [];
}

function CandidatureDossierInner() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const params = useParams<{ candidatId: string }>();
    const searchParams = useSearchParams();
    const candidatId = params?.candidatId as string;

    const fromMode = searchParams.get("from");
    const backHref = fromMode === "online" || fromMode === "onsite"
        ? `/dashboard/candidatures?mode=${fromMode}`
        : "/dashboard/candidatures";

    const [response, setResponse] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [validating, setValidating] = useState(false);
    const [resubmitTarget, setResubmitTarget] = useState<string | null>(null);
    const [resubmitMessage, setResubmitMessage] = useState("");
    const [sendingResubmit, setSendingResubmit] = useState(false);
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [rejecting, setRejecting] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
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
        const docs: { validationKey: string; renderKey: string; label: string; url: string }[] = [];
        for (const d of DOC_KEYS) {
            const urls = extractUrls(answers[d.key]);
            if (urls.length === 0) continue;
            if (urls.length === 1) {
                docs.push({ validationKey: d.key, renderKey: d.key, label: d.label, url: urls[0] });
            } else {
                urls.forEach((url, i) => {
                    docs.push({
                        validationKey: d.key,
                        renderKey: `${d.key}_${i}`,
                        label: `${d.label} ${i + 1}`,
                        url,
                    });
                });
            }
        }
        return docs;
    }, [response]);

    const allValid =
        availableDocs.length > 0 &&
        availableDocs.every(d => validation[d.validationKey]?.valid === true) &&
        !availableDocs.some(d => validation[d.validationKey]?.resubmit_requested);

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

    async function rejectCandidacy() {
        if (!response) return;
        const reason = rejectReason.trim();
        if (!reason) {
            alert("Merci d'indiquer un motif de refus pour informer le candidat.");
            return;
        }
        try {
            setRejecting(true);
            const updated = await updateResponseStatus(response._id, "rejected", reason);
            setResponse(updated);
            setRejectOpen(false);
            setRejectReason("");
            alert("Candidature rejetée. Un email a été envoyé et l'accès du candidat a été bloqué.");
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur");
        } finally {
            setRejecting(false);
        }
    }

    async function confirmDelete() {
        if (!response) return;
        try {
            setDeleting(true);
            await deleteResponse(response._id);
            setDeleteOpen(false);
            router.replace("/dashboard/candidatures");
        } catch (e) {
            alert(e instanceof Error ? e.message : "Erreur lors de la suppression");
        } finally {
            setDeleting(false);
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
                href={backHref}
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="h-3 w-3" /> Retour à la revue des demandes
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
                            const v = validation[doc.validationKey] || {};
                            const isValid = v.valid === true;
                            const hasIssue = !!v.resubmit_requested;
                            const justResubmitted = !hasIssue && !isValid && !!v.resubmitted_at;
                            return (
                                <div
                                    key={doc.renderKey}
                                    className="rounded-xl border p-4"
                                    style={{
                                        borderColor: hasIssue ? "#fecaca" : justResubmitted ? "#fcd34d" : isValid ? "#c8e6c9" : "#e5e7eb",
                                        backgroundColor: hasIssue ? "#fff5f5" : justResubmitted ? "#fffbeb" : isValid ? "#f1f8f4" : "#f9fafb",
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
                                                {justResubmitted && (
                                                    <div className="mt-1 space-y-0.5">
                                                        <p className="text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: "#b45309" }}>
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Nouveau document reçu — {new Date(v.resubmitted_at!).toLocaleDateString("fr-FR")}
                                                        </p>
                                                        {v.previous_url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setPreviewFile({ url: v.previous_url!, title: `${doc.label} — ancien fichier` })}
                                                                className="block text-[10px] text-amber-700 hover:underline"
                                                            >
                                                                Comparer avec l&apos;ancien fichier
                                                            </button>
                                                        )}
                                                    </div>
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
                                                title="Ouvrir / télécharger"
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
                                                            onChange={e => toggleValid(doc.validationKey, e.target.checked)}
                                                        />
                                                        <span className="text-xs font-bold">
                                                            {isValid ? "Valide" : "Valider"}
                                                        </span>
                                                    </label>
                                                    <button
                                                        onClick={() => {
                                                            setResubmitTarget(doc.validationKey);
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
                            {response.status === "rejected"
                                ? "Candidature rejetée — l'accès du candidat est désactivé."
                                : allValid
                                    ? "Tous les documents sont validés. Vous pouvez valider la candidature."
                                    : "La candidature peut être validée uniquement lorsque tous les documents sont cochés comme valides et qu'aucun document n'est en attente de relance."}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => {
                                    setRejectReason("");
                                    setRejectOpen(true);
                                }}
                                disabled={rejecting || response.status === "rejected"}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                style={{
                                    backgroundColor: "white",
                                    color: "#c62828",
                                    border: "2px solid #c62828",
                                }}
                                title="Refuser la candidature et bloquer l'accès du candidat"
                            >
                                <Ban className="h-4 w-4" />
                                {response.status === "rejected" ? "Candidature rejetée" : "Rejeter la candidature"}
                            </button>
                            {response.status === "rejected" && (
                                <button
                                    onClick={() => setDeleteOpen(true)}
                                    disabled={deleting}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                    style={{
                                        backgroundColor: "#c62828",
                                        boxShadow: "0 6px 16px rgba(198,40,40,0.25)",
                                    }}
                                    title="Supprimer définitivement ce dossier rejeté"
                                >
                                    <Trash2 className="h-4 w-4" />
                                    Supprimer
                                </button>
                            )}
                            <button
                                onClick={validateCandidacy}
                                disabled={!allValid || validating || response.status === "rejected"}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                                style={{
                                    backgroundColor: allValid && response.status !== "rejected" ? "#2e7d32" : "#9ca3af",
                                    boxShadow: allValid && response.status !== "rejected" ? "0 6px 16px rgba(46,125,50,0.25)" : "none",
                                }}
                            >
                                <ShieldCheck className="h-4 w-4" />
                                {validating ? "Validation…" : "Valider la candidature"}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Reject modal ── */}
            {rejectOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div
                            className="px-6 py-4 flex items-center gap-2"
                            style={{ backgroundColor: "#c62828" }}
                        >
                            <XCircle className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">
                                Rejeter la candidature
                            </span>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Un email avec le motif ci-dessous sera envoyé au candidat. Son accès à l&apos;espace candidat sera <strong>immédiatement désactivé</strong>.
                            </p>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                    Motif du refus <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={rejectReason}
                                    onChange={e => setRejectReason(e.target.value)}
                                    rows={4}
                                    placeholder="Expliquez au candidat les raisons du refus de sa candidature…"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
                                />
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => {
                                        setRejectOpen(false);
                                        setRejectReason("");
                                    }}
                                    disabled={rejecting}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={rejectCandidacy}
                                    disabled={rejecting || !rejectReason.trim()}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                                    style={{ backgroundColor: "#c62828" }}
                                >
                                    {rejecting ? "Envoi…" : "Rejeter et notifier"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete confirmation modal ── */}
            {deleteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                        <div
                            className="px-6 py-4 flex items-center gap-2"
                            style={{ backgroundColor: "#c62828" }}
                        >
                            <Trash2 className="h-4 w-4 text-white/80" />
                            <span className="text-sm font-bold uppercase tracking-widest text-white">
                                Supprimer définitivement
                            </span>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-gray-700">
                                Confirmez la suppression du dossier de <strong>{candidateName}</strong>
                                {response.public_id && <> (<span className="font-mono">{response.public_id}</span>)</>}.
                            </p>
                            <div className="p-3 rounded-xl text-xs" style={{ backgroundColor: "#ffebee", color: "#c62828", border: "1px solid #ffcdd2" }}>
                                <strong>Action irréversible.</strong> Toutes les données associées (réponses, documents joints, validation) seront définitivement effacées.
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteOpen(false)}
                                    disabled={deleting}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    Annuler
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    disabled={deleting}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                                    style={{ backgroundColor: "#c62828" }}
                                >
                                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    {deleting ? "Suppression…" : "Oui, supprimer"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

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

export default function CandidatureDossierPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400 text-sm">Chargement…</div>}>
            <CandidatureDossierInner />
        </Suspense>
    );
}
