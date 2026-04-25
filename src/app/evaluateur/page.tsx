"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, File as FileIcon, X, Eye, Loader2,
  CheckCircle2, Filter, ChevronLeft, ChevronRight,
  CalendarDays, FileText, ShieldCheck,
  Award, Calendar, ClipboardCheck, Mail,
  AlertTriangle,
} from "lucide-react";
import {
  fetchSessionResponses, fetchCertifications,
  fetchResponse, submitFinalEvaluation, API_URL,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Image from "next/image";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const ITEMS_PER_PAGE   = 8;
const SESSION_ID_KEY   = "irisq_evaluateur_session";
const SESSION_NAME_KEY = "irisq_evaluateur_session_name";

// ─── helpers ─────────────────────────────────────────────────────────────────

const generateId  = (r: any) => r?.candidate_id || `CAND-${r?._id?.slice(-6).toUpperCase()}`;
const formatDate  = (iso?: string) => iso
  ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
  : "—";

// ─── Composant modal candidat ─────────────────────────────────────────────────

function CandidateModal({
  responseId,
  onClose,
}: {
  responseId: string;
  onClose: () => void;
}) {
  const [candidate, setCandidate]                 = useState<any>(null);
  const [isLoading, setIsLoading]                 = useState(true);
  const [finalGrade, setFinalGrade]               = useState("");
  const [finalAppreciation, setFinalAppreciation] = useState("");
  const [isSubmitting, setIsSubmitting]           = useState(false);
  const [previewFile, setPreviewFile]             = useState<{ url: string; title?: string } | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchResponse(responseId);
      setCandidate(data);
      setFinalGrade(data.final_grade || "");
      setFinalAppreciation(data.final_appreciation || "");
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [responseId]);

  useEffect(() => { load(); }, [load]);

  const handleSubmitEval = async () => {
    if (!candidate || !finalGrade || !finalAppreciation) return;
    setIsSubmitting(true);
    try {
      await submitFinalEvaluation(candidate._id, { final_grade: finalGrade, final_appreciation: finalAppreciation });
      setCandidate({ ...candidate, final_grade: finalGrade, final_appreciation: finalAppreciation });
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const fullUrl = (path: string) =>
    path.startsWith("http") ? path : `${API_URL.replace("/api", "")}${path}`;

  return (
    <>
      {/* Overlay */}
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal centré */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg pointer-events-auto overflow-hidden"
          style={{ border: "2px solid #e8eaf6", maxHeight: "90vh" }}
        >
          {/* ── Header ── */}
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: "#e8eaf6" }}>
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                style={{ backgroundColor: "#1a237e" }}
              >
                {candidate ? generateId(candidate).slice(-4) : "—"}
              </div>
              <div>
                <h2 className="text-sm font-black" style={{ color: "#1a237e" }}>
                  {candidate ? generateId(candidate) : "Chargement…"}
                </h2>
                <p className="text-xs text-gray-400">Dossier candidat</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Corps scrollable ── */}
          <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 65px)" }}>

            {/* Chargement */}
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-[#1a237e] mb-3" />
                <p className="text-xs font-bold text-gray-400 animate-pulse">Chargement…</p>
              </div>
            ) : !candidate ? (
              <div className="flex flex-col items-center justify-center py-16">
                <AlertTriangle className="h-10 w-10 text-rose-400 mb-3" />
                <p className="text-sm font-bold text-gray-600">Candidat introuvable</p>
              </div>
            ) : (
              <div className="p-6 space-y-5">

                {/* ── Infos principales ── */}
                <div className="space-y-3">
                  {/* Certification */}
                  <div className="flex items-center gap-3">
                    <Award className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">Certification</span>
                      <span className="text-xs font-bold text-gray-800 text-right max-w-[60%]">
                        {candidate.answers?.["Certification souhaitée"] || "Non spécifiée"}
                      </span>
                    </div>
                  </div>

                  {/* Séparateur */}
                  <div className="h-px bg-gray-100" />

                  {/* Date */}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">Soumis le</span>
                      <span className="text-xs font-bold text-gray-800">{formatDate(candidate.submitted_at)}</span>
                    </div>
                  </div>

                  <div className="h-px bg-gray-100" />

                  {/* Statut examen */}
                  <div className="flex items-center gap-3">
                    <ClipboardCheck className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">Statut examen</span>
                      <span className="text-xs font-bold text-gray-800 capitalize">
                        {candidate.exam_status || "Non passé"}
                      </span>
                    </div>
                  </div>

                  {/* Alertes anti-triche */}
                  {candidate.exam_document && (
                    <>
                      <div className="h-px bg-gray-100" />
                      <div className="flex items-center gap-3">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-gray-400" />
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">Alertes anti-triche</span>
                          <span className={`text-xs font-bold ${(candidate.cheat_alerts?.length || 0) > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            {candidate.cheat_alerts?.length || 0} alerte{(candidate.cheat_alerts?.length || 0) !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="h-px bg-gray-100" />

                  {/* Correcteur */}
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 shrink-0 text-gray-400" />
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <span className="text-xs text-gray-500">Correcteur</span>
                      {candidate.assigned_examiner_email ? (
                        <span className="text-xs font-bold text-[#1a237e]">{candidate.assigned_examiner_email}</span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Pas encore de correcteur</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Décision finale ── */}
                {candidate.exam_document && (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="w-2 h-2 rotate-45 shrink-0" style={{ backgroundColor: "#2e7d32", display: "inline-block" }} />
                      <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                        Décision finale
                      </p>

                      {/* Avis correcteur */}
                      {(candidate.exam_grade || candidate.exam_comments) && (
                        <div className="bg-[#f4f6f9] rounded-xl p-3 mb-3 space-y-1">
                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Avis du correcteur</p>
                          <p className="text-base font-black text-[#1a237e]">{candidate.exam_grade}</p>
                          {candidate.exam_comments && (
                            <p className="text-xs text-gray-500 italic">"{candidate.exam_comments}"</p>
                          )}
                        </div>
                      )}

                      {candidate.final_grade ? (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                          <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Décision enregistrée</p>
                          <p className="text-2xl font-black text-emerald-800 mt-1">{candidate.final_grade}</p>
                          <p className="text-xs text-emerald-700 mt-1">{candidate.final_appreciation}</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <input
                            type="text"
                            placeholder="Note finale (ex : Admis, 18/20…)"
                            value={finalGrade}
                            onChange={e => setFinalGrade(e.target.value)}
                            className="w-full bg-[#f4f6f9] border border-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20"
                          />
                          <textarea
                            placeholder="Appréciation globale du comité…"
                            value={finalAppreciation}
                            onChange={e => setFinalAppreciation(e.target.value)}
                            rows={3}
                            className="w-full bg-[#f4f6f9] border border-gray-200 text-sm px-3 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1a237e]/20 resize-none"
                          />
                          <button
                            onClick={handleSubmitEval}
                            disabled={!finalGrade || !finalAppreciation || isSubmitting}
                            className="w-full py-2.5 text-white text-xs font-bold rounded-xl disabled:opacity-50 flex justify-center items-center gap-2 transition-all"
                            style={{ backgroundColor: "#2e7d32" }}
                          >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sceller l'évaluation finale"}
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── Bouton copie PDF ── */}
                {candidate.exam_document && (
                  <button
                    type="button"
                    onClick={() => setPreviewFile({ url: fullUrl(candidate.exam_document), title: `Copie — ${generateId(candidate)}` })}
                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-colors"
                    style={{ color: "#1a237e", borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}
                  >
                    <FileText className="h-4 w-4" />
                    Voir la copie d&apos;examen
                  </button>
                )}

                {/* ── Photos de surveillance ── */}
                {candidate.candidate_photos && candidate.candidate_photos.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Photos de surveillance · {candidate.candidate_photos.length}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {candidate.candidate_photos.map((url: string, idx: number) => {
                        const src = fullUrl(url);
                        return (
                          <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group">
                            <Image src={src} alt={`Surveillance ${idx + 1}`} fill className="object-contain group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setPreviewFile({ url: src, title: `Surveillance ${idx + 1}` })}
                                className="text-white text-[11px] font-bold bg-[#1a237e] px-2 py-1 rounded-lg"
                              >
                                <Eye className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Preview plein écran */}
      {previewFile && (
        <FilePreviewModal url={previewFile.url} title={previewFile.title} onClose={() => setPreviewFile(null)} />
      )}
    </>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function EvaluatorPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  // ── Session (lecture depuis localStorage) ──
  const [selectedSessionId] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) || "" : "")
  );
  const [sessionName] = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(SESSION_NAME_KEY) || "" : "")
  );

  // ── Réponses ──
  const [responses, setResponses]   = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(false);

  // ── Modal candidat ──
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ── Filtres ──
  const [certifications, setCertifications]         = useState<string[]>([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeCertFilter, setActiveCertFilter]     = useState<string | null>(null);
  const [searchQuery, setSearchQuery]               = useState("");
  const [currentPage, setCurrentPage]               = useState(1);

  useEffect(() => {
    fetchCertifications().then(setCertifications).catch(() => {});
    if (!selectedSessionId) return;
    setIsLoading(true);
    fetchSessionResponses(selectedSessionId)
      .then(data => applyRows(data as any[]))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  function applyRows(data: any[]) {
    setResponses(
      data
        .filter((r: any) => r.status === "approved")
        .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())
    );
    setCurrentPage(1);
  }

  const handleSearchChange = (val: string) => { setSearchQuery(val); setCurrentPage(1); };
  const handleCertFilter   = (cert: string | null) => { setActiveCertFilter(cert); setCurrentPage(1); setShowFilterDropdown(false); };

  const filteredResponses = responses.filter(r => {
    const matchesSearch = generateId(r).includes(searchQuery.toUpperCase());
    const matchesCert   = activeCertFilter ? r.answers?.["Certification souhaitée"] === activeCertFilter : true;
    return matchesSearch && matchesCert;
  });
  const totalPages         = Math.ceil(filteredResponses.length / ITEMS_PER_PAGE);
  const paginatedResponses = filteredResponses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE
  );

  const getStatusBadge = (status: string) => {
    const cfg: Record<string, { bg: string; color: string; border: string; text: string; icon: React.ReactNode }> = {
      approved: { bg: "#e8f5e9", color: "#2e7d32", border: "#c8e6c9", text: "Approuvé",   icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
      rejected: { bg: "#fef2f2", color: "#c62828", border: "#fecaca", text: "Rejeté",     icon: <span className="h-3.5 w-3.5 rounded-full bg-red-500" /> },
      pending:  { bg: "#fffbeb", color: "#b45309", border: "#fde68a", text: "En attente", icon: <span className="h-3.5 w-3.5 rounded-full bg-amber-500" /> },
    };
    const c = cfg[status] || cfg.pending;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
        style={{ backgroundColor: c.bg, color: c.color, borderColor: c.border }}>
        {c.icon} {c.text}
      </span>
    );
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f6f9]">
        <Loader2 className="animate-spin text-[#1a237e] h-8 w-8" />
      </div>
    );
  }

  return (
    <div
      className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen"
      onClick={() => showFilterDropdown && setShowFilterDropdown(false)}
    >

      {/* ── En-tête ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
          Candidatures validées
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Dossiers approuvés · en attente d&apos;attribution ou d&apos;évaluation
        </p>
      </div>

      {/* ── Badge session ── */}
      {sessionName && (
        <div className="flex items-center gap-2">
          <CalendarDays className="h-3.5 w-3.5" style={{ color: "#1a237e" }} />
          <span className="text-xs font-semibold text-gray-500">{sessionName}</span>
        </div>
      )}

      {/* ── Barre de recherche + Filtre ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#c5cae9" }}>
          <Search className="text-[#1a237e] h-5 w-5 shrink-0" />
          <input
            type="text"
            placeholder="Chercher par ID Candidat..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 uppercase"
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => handleSearchChange("")}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setShowFilterDropdown(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm border shadow-sm transition-all ${
              activeCertFilter
                ? "bg-[#1a237e] text-white border-[#1a237e]"
                : "bg-white text-[#1a237e] border-[#c5cae9] hover:bg-[#e8eaf6]"
            }`}
          >
            <Filter className="h-4 w-4" />
            {activeCertFilter ? "Filtré" : "Filtrer"}
          </button>

          <AnimatePresence>
            {showFilterDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border z-50 overflow-hidden"
                style={{ borderColor: "#c5cae9" }}
              >
                <div className="px-4 py-3 border-b bg-[#f8f9fa]" style={{ borderColor: "#e8eaf6" }}>
                  <p className="text-xs font-black uppercase tracking-wider text-[#1a237e]">Filtrer par certification</p>
                </div>
                <div className="py-2 max-h-80 overflow-y-auto">
                  <button onClick={() => handleCertFilter(null)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      !activeCertFilter ? "bg-[#e8eaf6] text-[#1a237e] font-bold" : "text-gray-700 hover:bg-gray-50"
                    }`}>
                    Toutes les certifications
                  </button>
                  {certifications.map(cert => (
                    <button key={cert} onClick={() => handleCertFilter(cert)}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                        activeCertFilter === cert ? "bg-[#e8eaf6] text-[#1a237e] font-bold" : "text-gray-700 hover:bg-gray-50"
                      }`}>
                      {cert}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {activeCertFilter && (
        <div className="flex items-center gap-2 -mt-4">
          <span className="text-xs text-gray-500 font-medium">Filtre actif :</span>
          <span className="inline-flex items-center gap-2 bg-[#e8eaf6] text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-full border border-[#c5cae9]">
            {activeCertFilter}
            <button onClick={() => handleCertFilter(null)} className="hover:text-rose-500 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* ── Tableau ── */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#1a237e]">
          <Loader2 className="h-8 w-8 animate-spin mb-4" />
          <p className="text-sm font-bold animate-pulse">Chargement des dossiers...</p>
        </div>
      ) : !selectedSessionId ? (
        <div className="bg-white rounded-2xl p-12 text-center border shadow-sm" style={{ borderColor: "#e0e0e0" }}>
          <div className="w-16 h-16 bg-[#e8eaf6] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="h-8 w-8 text-[#1a237e]" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Aucune session active</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">Créez ou activez une session pour voir les candidatures.</p>
        </div>
      ) : filteredResponses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border shadow-sm" style={{ borderColor: "#e0e0e0" }}>
          <div className="w-16 h-16 bg-[#e8eaf6] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileIcon className="h-8 w-8 text-[#1a237e]" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Aucun dossier approuvé</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Aucun dossier approuvé pour cette session ou correspondant à votre recherche.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ borderColor: "#c5cae9" }}
        >
          <div className="px-6 py-4 border-b flex items-center justify-between"
            style={{ backgroundColor: "#1a237e", borderColor: "#283593" }}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              {activeCertFilter || sessionName || "Candidatures validées"}
            </h2>
            <div className="text-xs text-white/70 font-bold bg-white/20 px-3 py-1 rounded-lg">
              {filteredResponses.length} Dossier{filteredResponses.length !== 1 ? "s" : ""}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-[#f8f9fa] border-b text-xs uppercase font-bold text-[#1a237e]"
                style={{ borderColor: "#e8eaf6" }}>
                <tr>
                  <th className="px-6 py-4">ID Candidat</th>
                  <th className="px-6 py-4">Certification</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4">Correcteur</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#f0f2f5" }}>
                {paginatedResponses.map(response => {
                  const candId = generateId(response);
                  const cert   = response.answers?.["Certification souhaitée"] || "—";
                  return (
                    <tr key={response._id}
                      onClick={() => setSelectedId(response._id)}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">
                            {candId.slice(-4)}
                          </div>
                          <span className="font-bold text-gray-900 tracking-wide">{candId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg leading-tight block max-w-[200px]">
                          {cert}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm font-medium whitespace-nowrap">
                        {new Date(response.submitted_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(response.status)}</td>
                      <td className="px-6 py-4">
                        {response.assigned_examiner_email ? (
                          <span className="text-xs font-medium text-[#1a237e] bg-[#e8eaf6] px-2 py-1 rounded-lg">
                            {response.assigned_examiner_email}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={e => { e.stopPropagation(); setSelectedId(response._id); }}
                          className="inline-flex items-center justify-center p-2 rounded-xl border border-gray-200 text-[#1a237e] hover:bg-[#1a237e] hover:border-[#1a237e] hover:text-white transition-all shadow-sm"
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

          {totalPages > 1 && (
            <div className="px-6 py-4 border-t flex items-center justify-between bg-[#f8f9fa]"
              style={{ borderColor: "#e8eaf6" }}>
              <p className="text-xs text-gray-500 font-medium">
                Page <span className="font-bold text-[#1a237e]">{currentPage}</span> sur{" "}
                <span className="font-bold">{totalPages}</span>
                {" "}· {filteredResponses.length} résultat{filteredResponses.length !== 1 ? "s" : ""}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | string)[]>((acc, p, idx, arr) => {
                    if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p); return acc;
                  }, [])
                  .map((p, idx) =>
                    p === "..." ? <span key={`e-${idx}`} className="text-gray-400 text-sm font-bold px-1">…</span>
                    : <button key={p} onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${
                          currentPage === p ? "bg-[#1a237e] text-white" : "border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]"
                        }`}>{p}</button>
                  )}
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Modal candidat (panneau latéral) ── */}
      <AnimatePresence>
        {selectedId && (
          <CandidateModal
            key={selectedId}
            responseId={selectedId}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
