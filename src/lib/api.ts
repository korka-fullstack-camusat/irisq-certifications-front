export const API_URL = (process.env.NEXT_PUBLIC_API_URL)

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
    if (!res.ok) throw new Error("Failed to submit response");
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

export async function fetchExams(certification?: string) {
    const path = certification
        ? `exams?certification=${encodeURIComponent(certification)}`
        : "exams";
    const res = await apiFetch(url(path), { redirect: "follow" });
    if (!res.ok) throw new Error("Failed to fetch exams");
    return res.json();
}

export async function createExam(data: any) {
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
// Espace candidat (self-service)
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

// Compte candidat
export interface CandidateAccount {
    id: string;
    account_id: string;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
    profile?: string | null;
    date_of_birth?: string | null;
    created_at?: string;
    must_change_password?: boolean;
}

// Dossier de candidature
export interface CandidateDossier {
    _id: string;
    public_id?: string;
    candidate_id?: string;
    form_id?: string;
    account_id?: string;
    status?: string;
    session_id?: string;
    submitted_at?: string;
    answers?: Record<string, any>;
    documents_validation?: Record<string, DocumentValidationEntry>;
    exam_status?: string;
    exam_grade?: string;
    final_grade?: string;
    final_appreciation?: string;
    exam_mode?: string;
    exam_type?: string;
}

export interface CandidateLoginResult {
    access_token: string;
    account_id: string;
    must_change_password: boolean;
}

export interface CandidateRegisterData {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    phone?: string;
    profile?: string;
    date_of_birth?: string;
}

export async function candidateRegister(data: CandidateRegisterData): Promise<CandidateAccount> {
    const res = await fetch(url("candidate/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur lors de la création du compte");
    }
    return res.json();
}

export async function candidateLogin(email: string, password: string): Promise<CandidateLoginResult> {
    const res = await fetch(url("candidate/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Email ou mot de passe invalide");
    }
    return res.json();
}

export async function candidateForgotPassword(email: string): Promise<{ message: string }> {
    const res = await fetch(url("candidate/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
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

export async function candidateMe(): Promise<CandidateAccount> {
    const res = await candidateFetch(url("candidate/me"));
    if (!res.ok) throw new Error("Session expirée");
    return res.json();
}

export async function candidateFetchCertifications(): Promise<any[]> {
    const res = await candidateFetch(url("candidate/certifications"));
    if (!res.ok) throw new Error("Impossible de récupérer les certifications");
    return res.json();
}

export async function candidateFetchDossiers(): Promise<CandidateDossier[]> {
    const res = await candidateFetch(url("candidate/dossiers"));
    if (!res.ok) throw new Error("Impossible de récupérer les dossiers");
    return res.json();
}

export async function candidateApply(
    formId: string,
    data: {
        session_id?: string;
        exam_mode?: string;
        exam_type?: string;
        answers?: Record<string, any>;
    }
): Promise<CandidateDossier> {
    const res = await candidateFetch(url(`candidate/apply/${formId}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Erreur lors de la soumission de la candidature");
    }
    return res.json();
}

export async function candidateResubmitDocument(
    dossierId: string,
    documentName: string,
    fileUrl: string
): Promise<CandidateDossier> {
    const res = await candidateFetch(url("candidate/resubmit-document"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dossier_id: dossierId, document_name: documentName, file_url: fileUrl }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Échec du renvoi du document");
    }
    return res.json();
}
