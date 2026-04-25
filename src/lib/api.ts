export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "https://irisq-certifications-api.onrender.com/api")

// ─── Shared cache helpers ────────────────────────────────────────────────────
const CERT_FORM_ID_KEY = "irisq_form_id";
const AUDIT_ACTION_TYPES_KEY = "irisq_audit_action_types";

export function getCertFormId(): string | null {
    return typeof window !== "undefined" ? localStorage.getItem(CERT_FORM_ID_KEY) : null;
}
export function setCertFormId(id: string): void {
    if (typeof window !== "undefined") localStorage.setItem(CERT_FORM_ID_KEY, id);
}
export function getCachedActionTypes(): { value: string; label: string }[] | null {
    try {
        const raw = typeof window !== "undefined" ? localStorage.getItem(AUDIT_ACTION_TYPES_KEY) : null;
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
export function setCachedActionTypes(types: { value: string; label: string }[]): void {
    if (typeof window !== "undefined") localStorage.setItem(AUDIT_ACTION_TYPES_KEY, JSON.stringify(types));
}
// ────────────────────────────────────────────────────────────────────────────

async function apiFetch(input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("auth_token");
        if (token) {
            headers.set("Authorization", `Bearer ${token}`);
        }
    }
    return fetch(input, { ...init, headers });
}

function url(path: string) {
    return `${API_URL}/${path.replace(/^\//, "")}`;
}

export async function fetchForms() {
    const res = await apiFetch(url("forms"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch forms");
    return res.json();
}

export async function createForm(data: any) {
    const res = await apiFetch(url("forms"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to create form");
    return res.json();
}

export async function fetchFormById(id: string) {
    const res = await apiFetch(url(`forms/${id}`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch form");
    return res.json();
}

export async function fetchResponses(formId: string) {
    const res = await apiFetch(url(`forms/${formId}/responses`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch responses");
    return res.json();
}

export async function fetchResponse(id: string) {
    const res = await apiFetch(url(`responses/${id}`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch response");
    return res.json();
}

export async function submitResponse(formId: string, data: any) {
    const res = await apiFetch(url(`forms/${formId}/responses`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.detail;
        if (detail && typeof detail === "object" && detail.code) {
            const e: any = new Error(detail.message || "Failed to submit response");
            e.code = detail.code;
            throw e;
        }
        throw new Error(typeof detail === "string" ? detail : "Failed to submit response");
    }
    return res.json();
}

export interface EligibilityResult {
    eligible: boolean;
    code?: "ALREADY_APPLIED" | "APPLICATION_REJECTED";
    message?: string;
}

export async function checkSessionEligibility(sessionId: string, email: string): Promise<EligibilityResult> {
    const res = await apiFetch(url(`sessions/${sessionId}/eligibility?email=${encodeURIComponent(email)}`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to check eligibility");
    return res.json();
}

/**
 * Check if an email already has an active or rejected candidature across ALL
 * currently-open sessions. Called as soon as the candidate finishes typing
 * their email (on blur), before they even pick a session.
 */
export async function checkEmailEligibility(email: string): Promise<EligibilityResult> {
    const res = await fetch(url(`responses/check-email?email=${encodeURIComponent(email.trim())}`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to check email eligibility");
    return res.json();
}

export async function updateResponseStatus(responseId: string, status: string, reason?: string) {
    const payload: Record<string, unknown> = { status };
    if (reason) payload.reason = reason;
    const res = await apiFetch(url(`responses/${responseId}/status`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to update status");
    return res.json();
}

export async function deleteResponse(responseId: string): Promise<{ status: string; id: string }> {
    const res = await apiFetch(url(`responses/${responseId}`), {
        method: "DELETE",
        redirect: "follow",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete candidature");
    }
    return res.json();
}

export async function uploadFiles(formData: FormData): Promise<{ file_urls: string[] }> {
    const res = await apiFetch(url("upload"), {
        method: "POST",
        body: formData,
        redirect: "follow",
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error("Upload HTTP error:", res.status, errorText);
        throw new Error(`Failed to upload files: ${res.status}`);
    }

    const data = await res.json();
    console.log("📦 Upload raw response:", data);

    // Normalise la réponse quelle que soit la forme retournée par le backend
    const fileUrls: string[] =
        data?.file_urls ??
        data?.urls ??
        (data?.files ? data.files.map((f: any) => f.file_url || f.url || f) : null) ??
        (data?.url ? [data.url] : null) ??
        (Array.isArray(data) ? data.map((f: any) => (typeof f === 'string' ? f : f.file_url)) : null) ??
        [];

    if (fileUrls.length === 0) {
        console.error("Réponse upload inattendue:", data);
        throw new Error(
            "L'upload a réussi (HTTP 200) mais aucune URL de fichier n'a été retournée. " +
            "Vérifiez que votre endpoint /api/upload/ retourne bien { file_urls: [...] }."
        );
    }

    return { file_urls: fileUrls };
}

export async function updateEvaluatorDocument(responseId: string, documentUrl: string) {
    const res = await apiFetch(url(`responses/${responseId}/evaluate`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluator_document: documentUrl }),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to update evaluator document");
    return res.json();
}

export async function updateExamGrade(responseId: string, data: { exam_grade: string; exam_status: string; exam_comments?: string }) {
    const res = await apiFetch(url(`responses/${responseId}/grade`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to update exam grade");
    return res.json();
}

export async function fetchExams(opts?: { certification?: string; session_id?: string }) {
    const p = new URLSearchParams();
    if (opts?.certification) p.set("certification", opts.certification);
    if (opts?.session_id)    p.set("session_id", opts.session_id);
    const qs = p.toString();
    const res = await apiFetch(url(qs ? `exams?${qs}` : "exams"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch exams");
    return res.json();
}

export async function fetchCertifications(): Promise<string[]> {
    const res = await apiFetch(url("certifications"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch certifications");
    const data = await res.json();
    return data.certifications as string[];
}

export async function createExam(data: {
    certification: string;
    title: string;
    document_url: string;
    duration_minutes?: number | null;
    session_id?: string | null;
}) {
    const res = await apiFetch(url("exams"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to create exam");
    return res.json();
}

export async function deleteExam(id: string) {
    const res = await apiFetch(url(`exams/${id}`), { method: "DELETE", redirect: "follow" });
    if (!res.ok) throw new Error("Failed to delete exam");
    return res.json();
}

export async function publishExam(id: string) {
    const res = await apiFetch(url(`exams/${id}/publish`), { method: "POST", redirect: "follow" });
    if (!res.ok) throw new Error("Failed to publish exam");
    return res.json();
}

export async function submitExamWithAntiCheat(
    responseId: string,
    data: {
        exam_document?: string;
        exam_answers?: { question_id: string, answer: string }[];
        cheat_alerts: string[];
        candidate_photos?: string[];
    }
) {
    const res = await apiFetch(url(`responses/${responseId}/anti-cheat`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to submit exam with anti-cheat data");
    return res.json();
}

export async function assignExaminer(responseId: string, examiner_email: string) {
    const res = await apiFetch(url(`responses/${responseId}/assign`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examiner_email }),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to assign examiner");
    return res.json();
}

export async function submitFinalEvaluation(
    responseId: string,
    data: { final_grade: string; final_appreciation: string }
) {
    const res = await apiFetch(url(`responses/${responseId}/final-evaluation`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to submit final evaluation");
    return res.json();
}

// ──────────────────────────────────────────────────────────────
// Sessions (admin only for mutations)
// ──────────────────────────────────────────────────────────────

export interface Session {
    _id: string;
    name: string;
    description?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    status: string;
    created_at?: string;
    updated_at?: string;
}

export async function fetchSessions(): Promise<Session[]> {
    const res = await apiFetch(url("sessions"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch sessions");
    return res.json();
}

export async function fetchSession(id: string): Promise<Session> {
    const res = await apiFetch(url(`sessions/${id}`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch session");
    return res.json();
}

export async function createSession(data: {
    name: string;
    description?: string;
    start_date?: string;
    end_date?: string;
    status?: string;
}): Promise<Session> {
    const res = await apiFetch(url("sessions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to create session");
    return res.json();
}

export async function updateSession(id: string, data: Partial<Omit<Session, "_id">>): Promise<Session> {
    const res = await apiFetch(url(`sessions/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to update session");
    return res.json();
}

export async function deleteSession(id: string) {
    const res = await apiFetch(url(`sessions/${id}`), { method: "DELETE", redirect: "follow" });
    if (!res.ok) throw new Error("Failed to delete session");
    return res.json();
}

export async function fetchSessionResponses(sessionId: string) {
    const res = await apiFetch(url(`sessions/${sessionId}/responses`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch session candidatures");
    return res.json();
}

export type ExportFilters = {
    mode?: "" | "online" | "onsite";
    formation?: string;
    status?: "" | "approved" | "rejected" | "pending";
};

function buildExportQuery(filters?: ExportFilters): string {
    if (!filters) return "";
    const p = new URLSearchParams();
    if (filters.mode) p.set("mode", filters.mode);
    if (filters.formation) p.set("formation", filters.formation);
    if (filters.status) p.set("status", filters.status);
    const qs = p.toString();
    return qs ? `?${qs}` : "";
}

async function triggerZipDownload(res: Response, fallbackName: string) {
    if (!res.ok) throw new Error("Failed to export dossiers");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || fallbackName;
    const objectUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(objectUrl);
}

export async function downloadSessionDossiersZip(
    sessionId: string,
    sessionName?: string,
    filters?: ExportFilters,
) {
    const res = await apiFetch(
        url(`sessions/${sessionId}/export${buildExportQuery(filters)}`),
        { redirect: "follow" },
    );
    const fallback = `dossiers_${(sessionName || "session").replace(/[^A-Za-z0-9._-]+/g, "_")}.zip`;
    return triggerZipDownload(res, fallback);
}

export async function downloadAllDossiersZip(filters?: ExportFilters & { sessionId?: string }) {
    const p = new URLSearchParams();
    if (filters?.mode) p.set("mode", filters.mode);
    if (filters?.formation) p.set("formation", filters.formation);
    if (filters?.status) p.set("status", filters.status);
    if (filters?.sessionId) p.set("session_id", filters.sessionId);
    const qs = p.toString() ? `?${p.toString()}` : "";
    const res = await apiFetch(url(`sessions/export-all${qs}`), { redirect: "follow" });
    return triggerZipDownload(res, "dossiers.zip");
}

// ──────────────────────────────────────────────────────────────
// Document validation checklist (admin / RH)
// ──────────────────────────────────────────────────────────────

export interface DocumentValidationEntry {
    valid?: boolean;
    notes?: string;
    resubmit_requested?: boolean;
    resubmit_requested_at?: string;
    resubmit_message?: string;
    resubmitted_at?: string;
    previous_url?: string;
}

export async function updateDocumentsValidation(
    responseId: string,
    documents_validation: Record<string, DocumentValidationEntry>,
) {
    const res = await apiFetch(url(`responses/${responseId}/documents-validation`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents_validation }),
        redirect: "follow",
    });
    if (!res.ok) throw new Error("Failed to update documents validation");
    return res.json();
}

export async function requestDocumentResubmit(
    responseId: string,
    data: { document_name: string; message?: string },
) {
    const res = await apiFetch(url(`responses/${responseId}/request-document-resubmit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        redirect: "follow",
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to request document resubmit");
    }
    return res.json();
}

// ──────────────────────────────────────────────────────────────
// Audit logs (admin / RH only)
// ──────────────────────────────────────────────────────────────

export interface AuditLog {
    _id: string;
    timestamp: string;
    user_email: string;
    user_role: string;
    user_name: string;
    action: string;
    action_label: string;
    resource_type: string;
    resource_id: string;
    resource_label: string;
    details: Record<string, unknown>;
}

export interface AuditLogsResponse {
    total: number;
    page: number;
    limit: number;
    pages: number;
    logs: AuditLog[];
}

export interface AuditLogsFilters {
    page?: number;
    limit?: number;
    action?: string;
    actions?: string;
    user_email?: string;
    resource_type?: string;
    date_from?: string;
    date_to?: string;
}

export async function fetchAuditLogs(filters?: AuditLogsFilters): Promise<AuditLogsResponse> {
    const p = new URLSearchParams();
    if (filters?.page) p.set("page", String(filters.page));
    if (filters?.limit) p.set("limit", String(filters.limit));
    if (filters?.actions) p.set("actions", filters.actions);
    else if (filters?.action) p.set("action", filters.action);
    if (filters?.user_email) p.set("user_email", filters.user_email);
    if (filters?.resource_type) p.set("resource_type", filters.resource_type);
    if (filters?.date_from) p.set("date_from", filters.date_from);
    if (filters?.date_to) p.set("date_to", filters.date_to);
    const qs = p.toString() ? `?${p.toString()}` : "";
    const res = await apiFetch(url(`audit-logs${qs}`), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch audit logs");
    return res.json();
}

export async function deleteAuditLog(logId: string): Promise<{ status: string; id: string }> {
    const res = await apiFetch(url(`audit-logs/${logId}`), { method: "DELETE", redirect: "follow" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete audit log");
    }
    return res.json();
}

export async function fetchAuditActionTypes(): Promise<{ value: string; label: string }[]> {
    const res = await apiFetch(url("audit-logs/actions"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch action types");
    return res.json();
}

// ──────────────────────────────────────────────────────────────
// Correcteurs (evaluateur only)
// ──────────────────────────────────────────────────────────────

export interface Correcteur {
    id: string;
    email: string;
    full_name?: string | null;
    role: string;
    is_active: boolean;
    created_at?: string;
}

export async function fetchCorrecteurs(): Promise<Correcteur[]> {
    const res = await apiFetch(url("correcteurs"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch correcteurs");
    return res.json();
}

export async function createCorrecteur(data: {
    email: string;
    password: string;
    full_name?: string;
}): Promise<Correcteur> {
    const res = await apiFetch(url("correcteurs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, role: "CORRECTEUR" }),
        redirect: "follow",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to create correcteur");
    }
    return res.json();
}

export interface UnassignedResponse {
    id: string;
    public_id?: string;
    name?: string;
    profile?: string;
    session_id?: string;
    exam_mode?: string;
}

export async function fetchUnassignedResponses(): Promise<UnassignedResponse[]> {
    const res = await apiFetch(url("correcteurs/unassigned-responses"), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch unassigned responses");
    return res.json();
}

export async function bulkAssignCorrecteur(
    correcteur_email: string,
    response_ids: string[],
): Promise<{ assigned: number }> {
    const res = await apiFetch(url("correcteurs/assign-bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correcteur_email, response_ids }),
        redirect: "follow",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to assign");
    }
    return res.json();
}

export async function deleteCorrecteur(id: string): Promise<{ id: string; deleted: boolean }> {
    const res = await apiFetch(url(`correcteurs/${id}`), {
        method: "DELETE",
        redirect: "follow",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete correcteur");
    }
    return res.json();
}

export async function signCorrections(): Promise<{ signed: boolean; signed_at: string; count: number }> {
    const res = await apiFetch(url("correcteur/sign"), { method: "POST", redirect: "follow" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur lors de la signature");
    }
    return res.json();
}

export async function relancerCorrecteur(id: string): Promise<{ sent: boolean; pending_count: number }> {
    const res = await apiFetch(url(`correcteurs/${id}/relancer`), { method: "POST", redirect: "follow" });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur lors de la relance");
    }
    return res.json();
}

export async function toggleCorrecteurStatus(id: string): Promise<{ id: string; is_active: boolean }> {
    const res = await apiFetch(url(`correcteurs/${id}/toggle`), {
        method: "PATCH",
        redirect: "follow",
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to toggle correcteur status");
    }
    return res.json();
}

// ──────────────────────────────────────────────────────────────
// Candidate space (self-service)
// ──────────────────────────────────────────────────────────────

const CANDIDATE_TOKEN_KEY = "candidate_token";

export function getCandidateToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(CANDIDATE_TOKEN_KEY);
}

export function setCandidateToken(token: string) {
    if (typeof window === "undefined") return;
    localStorage.setItem(CANDIDATE_TOKEN_KEY, token);
}

export function clearCandidateToken() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(CANDIDATE_TOKEN_KEY);
}

async function candidateFetch(input: RequestInfo | URL, init?: RequestInit) {
    const headers = new Headers(init?.headers || {});
    const token = getCandidateToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
}

export interface CandidateDossier {
    _id: string;
    public_id?: string;
    candidate_id?: string;
    name?: string;
    email?: string;
    status?: string;
    session_id?: string;
    submitted_at?: string;
    answers?: Record<string, any>;
    documents_validation?: Record<string, DocumentValidationEntry>;
    exam_status?: string;
    exam_grade?: string;
    final_grade?: string;
    final_appreciation?: string;
    must_change_password?: boolean;
}

export interface CandidateLoginResult {
    access_token: string;
    response_id: string;
    must_change_password: boolean;
}

export async function candidateLogin(publicId: string, password: string): Promise<CandidateLoginResult> {
    const res = await fetch(url("candidate/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: publicId, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Identifiants invalides");
    }
    return res.json();
}

export async function candidateForgotPassword(publicId: string, email: string): Promise<{ message: string }> {
    const res = await fetch(url("candidate/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_id: publicId, email }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur lors de la réinitialisation du mot de passe");
    }
    return res.json();
}

export async function candidateChangePassword(currentPassword: string, newPassword: string): Promise<CandidateLoginResult> {
    const res = await candidateFetch(url("candidate/change-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Échec du changement de mot de passe");
    }
    return res.json();
}

export async function candidateMe(): Promise<CandidateDossier> {
    const res = await candidateFetch(url("candidate/me"));
    if (!res.ok) throw new Error("Session expirée");
    return res.json();
}

export async function candidateResubmitDocument(documentName: string, fileUrl: string): Promise<CandidateDossier> {
    const res = await candidateFetch(url("candidate/resubmit-document"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_name: documentName, file_url: fileUrl }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Échec du renvoi du document");
    }
    return res.json();
}
