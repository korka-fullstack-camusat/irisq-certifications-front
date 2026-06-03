"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus, Trash2, Download, Search, Loader2,
  FileText, Send, X, Plus, Upload, Eye,
  Clock, CalendarDays, Filter, CheckCircle2,
  ChevronLeft, ChevronRight, AlertCircle, RefreshCw,
  BookOpen,
} from "lucide-react";
import RichTextEditor from "@/components/RichTextEditor";
import {
  API_URL, fetchExams, createExam, deleteExam, uploadFiles, publishExam,
  reparseExam, fetchCertifications, fetchExamCandidates, type ExamCandidate,
} from "@/lib/api";

/** Résout un chemin relatif /api/files/... en URL absolue vers le backend. */
function resolveDocUrl(raw: string | undefined | null): string {
    if (!raw) return "";
    if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
    const base = API_URL.replace(/\/api\/?$/, "");
    return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

const SESSION_ID_KEY   = "irisq_evaluateur_session";
const SESSION_NAME_KEY = "irisq_evaluateur_session_name";
const EXAMS_PER_PAGE   = 8;
import { FilePreviewModal } from "@/components/FilePreviewModal";

export default function ExamensPage() {
  // ── Session (lecture seule depuis localStorage) ──
  const [selectedSessionId]  = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(SESSION_ID_KEY) || "" : "")
  );
  const [sessionName]        = useState<string>(
    () => (typeof window !== "undefined" ? localStorage.getItem(SESSION_NAME_KEY) || "" : "")
  );

  // ── Certifications ──
  const [certifications, setCertifications]   = useState<string[]>([]);

  // ── Exams ──
  const [exams, setExams]                     = useState<any[]>([]);
  const [isLoading, setIsLoading]             = useState(false);
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [publishingId, setPublishingId]       = useState<string | null>(null);

  // ── Modal aperçu rendu examen ──
  type ExamQuestion = {
    id: string; text: string; type: string;
    options?: string[]; section?: string;
    subsection?: string; has_justification?: boolean;
    parts?: Array<{ id: string; label: string; type: string }>;
  };
  const [examPreview, setExamPreview] = useState<{
    url: string; title: string; certification: string;
    duration?: number; questions: ExamQuestion[];
  } | null>(null);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});
  const [previewPage, setPreviewPage]       = useState(0);
  const PREVIEW_PER_PAGE = 3;

  // ── Modal publication ──
  const [publishModal, setPublishModal] = useState<{ examId: string; certification: string } | null>(null);
  const [publishCandidates, setPublishCandidates] = useState<ExamCandidate[]>([]);
  const [publishSelected, setPublishSelected] = useState<Set<string>>(new Set());
  const [publishLoadingCandidates, setPublishLoadingCandidates] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [reparsingId, setReparsingId]         = useState<string | null>(null);
  const [searchQuery, setSearchQuery]         = useState("");
  const [showModal, setShowModal]             = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeCertFilter, setActiveCertFilter]     = useState<string | null>(null);
  const [currentPage, setCurrentPage]               = useState(1);
  const [uploadError, setUploadError]         = useState<string | null>(null);
  const [previewFile, setPreviewFile]         = useState<{ url: string; title?: string } | null>(null);

  const [newExam, setNewExam] = useState({
    certification: "",
    title: "",
    duration_minutes: "" as string | number,
    deadline: "",
  });
  const [file, setFile] = useState<File | null>(null);

  // ── Chargement initial ──
  useEffect(() => {
    fetchCertifications()
      .then(list => {
        setCertifications(list);
        if (list.length > 0) setNewExam(prev => ({ ...prev, certification: list[0] }));
      })
      .catch(() => {});
  }, []);

  // ── Load exams when session changes ──
  useEffect(() => {
    loadExams();
  }, [selectedSessionId]);

  const loadExams = async () => {
    setIsLoading(true);
    try {
      const data = await fetchExams(selectedSessionId ? { session_id: selectedSessionId } : undefined);
      setExams(data);
    } catch {
      /* ignore */
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !newExam.title || !newExam.certification) return;
    setIsSubmitting(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const uploadResult = await uploadFiles(formData);
      const docUrl = uploadResult.file_urls[0];

      const duration = newExam.duration_minutes !== ""
        ? Number(newExam.duration_minutes)
        : null;

      await createExam({
        certification: newExam.certification,
        title: newExam.title,
        document_url: docUrl,
        duration_minutes: duration,
        session_id: selectedSessionId || null,
        deadline: newExam.deadline || null,
      });

      closeModal();
      await loadExams();
    } catch (error: any) {
      setUploadError(error?.message || "Erreur lors de la création de l'examen.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Voulez-vous vraiment supprimer cet examen ?")) return;
    try {
      await deleteExam(id);
      setExams(prev => prev.filter(e => e._id !== id));
    } catch {
      alert("Erreur lors de la suppression.");
    }
  };

  const handleReparse = async (id: string) => {
    setReparsingId(id);
    try {
      const result = await reparseExam(id);
      alert(
        `Document re-parsé avec succès !\n` +
        `HTML généré : ${result.exam_content_html_length} caractères\n` +
        `Questions extraites : ${result.parsed_questions_count}`
      );
      await loadExams();
    } catch (err: any) {
      alert(err?.message || "Erreur lors du re-parsing du document.");
    } finally {
      setReparsingId(null);
    }
  };

  const openPublishModal = async (id: string, certification: string) => {
    setPublishModal({ examId: id, certification });
    setPublishLoadingCandidates(true);
    setPublishCandidates([]);
    setPublishSelected(new Set());
    try {
      const list = await fetchExamCandidates(id);
      setPublishCandidates(list);
      setPublishSelected(new Set(list.map(c => c.response_id)));
    } catch {
      setPublishCandidates([]);
    } finally {
      setPublishLoadingCandidates(false);
    }
  };

  const togglePublishCandidate = (id: string) => {
    setPublishSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleConfirmPublish = async () => {
    if (!publishModal) return;
    setIsPublishing(true);
    setPublishingId(publishModal.examId);
    try {
      const result = await publishExam(publishModal.examId, Array.from(publishSelected));
      setPublishModal(null);
      alert(`Succès ! ${result.notified_candidates_count} candidat(s) ont reçu le lien d'examen.`);
    } catch {
      alert("Erreur lors de la publication de l'examen.");
    } finally {
      setIsPublishing(false);
      setPublishingId(null);
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    setFile(null);
    setUploadError(null);
    setNewExam(prev => ({ ...prev, title: "", duration_minutes: "", deadline: "" }));
  };

  const filteredExams = useMemo(() => exams.filter(e => {
    const matchesSearch = !searchQuery ||
      e.certification.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCert = !activeCertFilter || e.certification === activeCertFilter;
    return matchesSearch && matchesCert;
  }), [exams, searchQuery, activeCertFilter]);

  const totalPages      = Math.ceil(filteredExams.length / EXAMS_PER_PAGE);
  const paginatedExams  = filteredExams.slice(
    (currentPage - 1) * EXAMS_PER_PAGE, currentPage * EXAMS_PER_PAGE
  );

  return (
    <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
            Gestion des Examens
          </h1>
          <p className="text-gray-400 text-sm mt-1">Créez et publiez les sujets d&apos;examen par certification.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 text-white text-sm font-bold px-4 py-2 rounded-lg shrink-0 transition-colors"
          style={{ backgroundColor: "#1a237e" }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#283593")}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#1a237e")}
        >
          <Plus className="h-4 w-4" />
          Nouvel Examen
        </button>
      </div>

      {/* Session active en sous-titre discret si disponible */}
      {sessionName && (
        <div className="flex items-center gap-2 -mt-4">
          <CalendarDays className="h-3.5 w-3.5" style={{ color: "#1a237e" }} />
          <span className="text-xs font-semibold text-gray-500">{sessionName}</span>
        </div>
      )}

      {/* ── Search + Filtre ── */}
      <div className="flex items-center gap-3">
        {/* Barre de recherche */}
        <div className="flex-1 bg-white rounded-xl border shadow-sm flex items-center gap-3 px-4 py-3" style={{ borderColor: "#e0e0e0" }}>
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            placeholder="Rechercher un examen ou une certification…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-gray-700 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Bouton ouvrir modal filtre */}
        <button
          onClick={() => setShowFilterDropdown(true)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm border shadow-sm transition-colors shrink-0 ${
            activeCertFilter
              ? "bg-[#1a237e] text-white border-[#1a237e]"
              : "bg-white text-[#1a237e] border-[#c5cae9] hover:bg-[#e8eaf6]"
          }`}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">{activeCertFilter ? "Filtré" : "Filtrer"}</span>
        </button>
      </div>

      {/* Chip filtre actif */}
      {activeCertFilter && (
        <div className="flex items-center gap-2 -mt-4">
          <span className="text-xs text-gray-500 font-medium">Filtre actif :</span>
          <span className="inline-flex items-center gap-2 bg-[#e8eaf6] text-[#1a237e] text-xs font-bold px-3 py-1.5 rounded-full border border-[#c5cae9]">
            {activeCertFilter}
            <button onClick={() => setActiveCertFilter(null)} className="hover:text-rose-500 transition-colors">
              <X className="h-3 w-3" />
            </button>
          </span>
        </div>
      )}

      {/* ── MODAL Filtre par certification ── */}
      <AnimatePresence>
        {showFilterDropdown && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowFilterDropdown(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl"
              style={{ border: "1px solid #c5cae9" }}
            >
              {/* Header modal */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <Filter className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Filtrer par certification</h2>
                </div>
                <button onClick={() => setShowFilterDropdown(false)} className="text-white/70 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Liste */}
              <div className="p-3 max-h-96 overflow-y-auto space-y-1">
                <button
                  onClick={() => { setActiveCertFilter(null); setShowFilterDropdown(false); }}
                  className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between ${
                    !activeCertFilter
                      ? "bg-[#e8eaf6] text-[#1a237e]"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Toutes les certifications
                  {!activeCertFilter && <CheckCircle2 className="h-4 w-4 text-[#1a237e] shrink-0" />}
                </button>
                {certifications.map(cert => (
                  <button
                    key={cert}
                    onClick={() => { setActiveCertFilter(cert); setShowFilterDropdown(false); }}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-between gap-2 ${
                      activeCertFilter === cert
                        ? "bg-[#e8eaf6] text-[#1a237e]"
                        : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span className="leading-snug">{cert}</span>
                    {activeCertFilter === cert && <CheckCircle2 className="h-4 w-4 text-[#1a237e] shrink-0" />}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-gray-100 bg-[#f4f6f9] flex justify-end">
                <button
                  onClick={() => setShowFilterDropdown(false)}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors"
                >
                  Fermer
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Exam list ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: "#c5cae9" }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Liste des Examens</h2>
          <div className="text-xs text-white/70">{filteredExams.length} examen(s)</div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#1a237e" }} />
            <p className="text-sm">Chargement des examens…</p>
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Aucun examen trouvé.</p>
            <p className="text-xs mt-1">Créez-en un avec le bouton &quot;Nouvel Examen&quot;.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {paginatedExams.map((exam, idx) => (
              <motion.div
                key={exam._id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center justify-between px-6 py-4 hover:bg-[#f4f6f9] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                    <FileText className="h-5 w-5" style={{ color: "#1a237e" }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-sm group-hover:text-[#1a237e] transition-colors">{exam.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{exam.certification}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-[10px] text-gray-300 uppercase tracking-wider">
                        Créé le {new Date(exam.created_at).toLocaleDateString("fr-FR")}
                      </p>
                      {exam.duration_minutes && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                          <Clock className="h-3 w-3" />
                          {exam.duration_minutes} min
                        </span>
                      )}
                      {exam.deadline && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "#ffebee", color: "#c62828" }}>
                          <CalendarDays className="h-3 w-3" />
                          Limite : {new Date(exam.deadline).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openPublishModal(exam._id, exam.certification)}
                    disabled={publishingId === exam._id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all disabled:opacity-50"
                    style={{ borderColor: "#c5cae9", color: "#1a237e" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#e8eaf6")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    {publishingId === exam._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">Publier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewAnswers({});
                      setPreviewPage(0);
                      setExamPreview({
                        url: resolveDocUrl(exam.document_url),
                        title: exam.title,
                        certification: exam.certification,
                        duration: exam.duration_minutes,
                        questions: exam.parsed_questions || [],
                      });
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all"
                    style={{ borderColor: "#c8e6c9", color: "#2e7d32", backgroundColor: "#f1f8e9" }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = "#e8f5e9")}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = "#f1f8e9")}
                    title="Voir le rendu côté candidat"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Aperçu</span>
                  </button>
                  <a
                    href={resolveDocUrl(exam.document_url)}
                    download
                    className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                    title="Télécharger"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => handleReparse(exam._id)}
                    disabled={reparsingId === exam._id}
                    className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-amber-500 hover:bg-amber-50 hover:border-amber-200 disabled:opacity-50 transition-all"
                    title="Re-parser le document (régénérer le contenu HTML)"
                  >
                    {reparsingId === exam._id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(exam._id)}
                    className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-rose-400 hover:bg-rose-50 hover:border-rose-200 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t flex items-center justify-between bg-[#f8f9fa]"
            style={{ borderColor: "#e8eaf6" }}>
            <p className="text-xs text-gray-500 font-medium">
              Page <span className="font-bold text-[#1a237e]">{currentPage}</span> sur{" "}
              <span className="font-bold">{totalPages}</span>
              {" "}· {filteredExams.length} examen{filteredExams.length !== 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && typeof arr[idx-1] === "number" && (p as number) - (arr[idx-1] as number) > 1) acc.push("...");
                  acc.push(p); return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? <span key={`e-${idx}`} className="text-gray-400 text-sm px-1">…</span>
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

      {/* ── MODAL Nouvel Examen ── */}
      <AnimatePresence>
        {showModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
              style={{ border: "1px solid #c5cae9" }}
            >
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <FilePlus className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-white">Nouvel Examen</h2>
                </div>
                <button onClick={closeModal} className="text-white/70 hover:text-white transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">

                {/* Erreur */}
                {uploadError && (
                  <div className="flex items-start gap-3 p-4 rounded-xl border text-sm"
                    style={{ background: "#fef2f2", borderColor: "#fecaca", color: "#c62828" }}>
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p className="font-semibold">{uploadError}</p>
                  </div>
                )}

                {/* Session (rappel) */}
                {sessionName && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                    style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                    <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                    Session : {sessionName}
                  </div>
                )}

                {/* Certification */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Certification <span className="text-rose-500">*</span>
                  </label>
                  {certifications.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                    </div>
                  ) : (
                    <select
                      value={newExam.certification}
                      onChange={e => setNewExam({ ...newExam, certification: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#f4f6f9] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer"
                      style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                    >
                      {certifications.map(cert => <option key={cert} value={cert}>{cert}</option>)}
                    </select>
                  )}
                </div>

                {/* Titre */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Titre de l&apos;examen <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="ex : Session Juin 2025 — Partie A"
                    value={newExam.title}
                    onChange={e => setNewExam({ ...newExam, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#f4f6f9] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                    style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                  />
                </div>

                {/* Durée */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Durée de l&apos;épreuve (minutes) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      min="1"
                      max="480"
                      step="1"
                      placeholder="ex : 90"
                      value={newExam.duration_minutes}
                      onChange={e => setNewExam({ ...newExam, duration_minutes: e.target.value })}
                      className="w-full pl-9 pr-16 py-2.5 bg-[#f4f6f9] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-semibold">min</span>
                  </div>
                </div>

                {/* Date limite de dépôt */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Date limite de dépôt
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Le candidat peut passer l&apos;examen à son heure, jusqu&apos;à cette date.
                  </p>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={newExam.deadline}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={e => setNewExam({ ...newExam, deadline: e.target.value })}
                      className="w-full pl-9 py-2.5 bg-[#f4f6f9] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all"
                      style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                    />
                  </div>
                </div>

                {/* Upload */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Document (PDF / DOCX) <span className="text-rose-500">*</span>
                  </label>
                  {file ? (
                    <div className="flex items-center justify-between p-3 rounded-xl border" style={{ background: "#e8f5e9", borderColor: "#c8e6c9" }}>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#c8e6c9" }}>
                          <FileText className="h-4 w-4" style={{ color: "#2e7d32" }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold truncate max-w-[220px]" style={{ color: "#2e7d32" }}>{file.name}</p>
                          <p className="text-xs" style={{ color: "#4caf50" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button onClick={() => setFile(null)} className="text-xs font-semibold hover:underline" style={{ color: "#c62828" }}>
                        Retirer
                      </button>
                    </div>
                  ) : (
                    <label
                      className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-[#e8eaf6]/30"
                      style={{ borderColor: "#c5cae9", backgroundColor: "#f9faff" }}
                    >
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                        <Upload className="h-5 w-5" style={{ color: "#1a237e" }} />
                      </div>
                      <p className="text-sm font-semibold text-gray-700">Cliquez pour importer le sujet</p>
                      <p className="text-xs text-gray-400">.pdf, .doc, .docx · Max 20 MB</p>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        className="sr-only"
                        onChange={e => {
                          if (e.target.files?.[0]) {
                            setFile(e.target.files[0]);
                            setUploadError(null);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3" style={{ backgroundColor: "#f4f6f9" }}>
                <button
                  onClick={closeModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !file || !newExam.title || !newExam.certification || !newExam.duration_minutes}
                  className="inline-flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: "#1a237e" }}
                  onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.backgroundColor = "#283593"; }}
                  onMouseLeave={e => { if (!isSubmitting) e.currentTarget.style.backgroundColor = "#1a237e"; }}
                >
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Création en cours…</>
                    : <><FilePlus className="h-4 w-4" /> Créer l&apos;examen</>
                  }
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

      {/* ── MODAL Aperçu rendu examen (vue candidat — mono-colonne) ── */}
      <AnimatePresence>
        {examPreview && (
          <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#f4f6f9" }}>

            {/* ── Barre du haut ── */}
            <div className="bg-white border-b shadow-sm px-5 py-3 flex items-center justify-between shrink-0" style={{ borderColor: "#e0e0e0" }}>
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                  <Eye className="h-4 w-4" style={{ color: "#1a237e" }} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Aperçu — Vue Candidat</p>
                  <p className="text-sm font-black text-gray-800 leading-tight">{examPreview.title}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {examPreview.duration && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ backgroundColor: "#e8eaf6", color: "#1a237e" }}>
                    <Clock className="h-3.5 w-3.5" />{examPreview.duration} min
                  </span>
                )}
                <button onClick={() => setExamPreview(null)} className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* ── Corps principal : panneau gauche + formulaire ── */}
            <div className="flex-1 flex overflow-hidden">

              {/* ── GAUCHE : Avancement des questions ── */}
              {examPreview.questions.length > 0 && (() => {
                const totalQ = examPreview.questions.length;
                const answeredQ = examPreview.questions.filter(q =>
                  previewAnswers[q.id] && previewAnswers[q.id] !== "<p></p>"
                ).length;
                return (
                  <div className="shrink-0 border-r flex flex-col overflow-y-auto" style={{ width: "320px", minWidth: "320px", backgroundColor: "#fff", borderColor: "#e0e0e0" }}>
                    {/* Titre + stats */}
                    <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: "#e8eaf6" }}>
                      <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>Avancement</p>
                      {/* Barre de progression */}
                      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
                        <div className="h-full rounded-full transition-all" style={{ width: `${totalQ > 0 ? (answeredQ / totalQ) * 100 : 0}%`, backgroundColor: "#2e7d32" }} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold" style={{ color: "#2e7d32" }}>{answeredQ} répondues</span>
                        <span className="text-[11px] text-gray-400">{totalQ - answeredQ} restantes</span>
                      </div>
                    </div>

                    {/* Grille de questions */}
                    <div className="px-5 py-4 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">Questions</p>
                      <div className="flex flex-wrap gap-2">
                        {examPreview.questions.map((q, idx) => {
                          const isAns = !!(previewAnswers[q.id] && previewAnswers[q.id] !== "<p></p>");
                          const qPage = Math.floor(idx / PREVIEW_PER_PAGE);
                          const isCurrent = qPage === previewPage;
                          return (
                            <button
                              key={q.id}
                              onClick={() => setPreviewPage(qPage)}
                              title={`Q${idx + 1} — ${isAns ? "Répondue" : "Non répondue"} — cliquer pour y aller`}
                              className="h-9 w-9 rounded-lg text-xs font-black transition-all flex items-center justify-center"
                              style={{
                                backgroundColor: isAns ? "#2e7d32" : "#ffebee",
                                color: isAns ? "white" : "#c62828",
                                border: isCurrent ? "2px solid #1a237e" : isAns ? "none" : "1px solid #ef9a9a",
                                boxShadow: isCurrent ? "0 0 0 3px #c5cae9" : "none",
                              }}
                            >
                              {idx + 1}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Légende */}
                    <div className="px-5 py-4 border-t space-y-2.5" style={{ borderColor: "#e8eaf6" }}>
                      <div className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-md shrink-0" style={{ backgroundColor: "#2e7d32" }} />
                        <span className="text-xs text-gray-600 font-semibold">Répondue</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-md shrink-0 border border-red-300" style={{ backgroundColor: "#ffebee" }} />
                        <span className="text-xs text-gray-600 font-semibold">Non répondue</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="h-5 w-5 rounded-md shrink-0" style={{ border: "2px solid #1a237e", boxShadow: "0 0 0 2px #c5cae9", backgroundColor: "white" }} />
                        <span className="text-xs text-gray-600 font-semibold">Page actuelle</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── DROITE : Contenu Google Forms style ── */}
              <div className="flex-1 overflow-y-auto" style={{ backgroundColor: "#f4f6f9" }}>

              {/* ── Formulaire dynamique ── */}
              <div className="px-6 pt-6 pb-10 space-y-0">
                {examPreview.questions.length > 0 ? (() => {
                  const totalPreviewPages = Math.ceil(examPreview.questions.length / PREVIEW_PER_PAGE);
                  const pageStart = previewPage * PREVIEW_PER_PAGE;
                  const pageQuestions = examPreview.questions.slice(pageStart, pageStart + PREVIEW_PER_PAGE);
                  const isLastPreviewPage = pageStart + PREVIEW_PER_PAGE >= examPreview.questions.length;

                  const nodes: React.ReactNode[] = [];
                  let lastSection    = previewPage > 0 ? (examPreview.questions[pageStart - 1]?.section || "") : "";
                  let lastSubsection = previewPage > 0 ? (examPreview.questions[pageStart - 1]?.subsection || "") : "";

                  pageQuestions.forEach((q, localIdx) => {
                    const i = pageStart + localIdx;
                    const section    = q.section    || "";
                    const subsection = q.subsection || "";
                    const answKey    = q.id;
                    const justKey    = `${q.id}_justif`;
                    const selected   = previewAnswers[answKey];
                    const qNum = i + 1;

                    // ── En-tête de section (bande verte) ──
                    if (section && section !== lastSection) {
                      lastSection    = section;
                      lastSubsection = "";
                      nodes.push(
                        <div key={`sec_${i}`} className="bg-white border border-t-0 px-6 py-3" style={{ borderColor: "#c5cae9" }}>
                          <p className="font-black text-sm" style={{ color: "#1a237e" }}>{section}</p>
                        </div>
                      );
                    }

                    // ── Sous-section (QCM / Questions Ouvertes) ──
                    if (subsection && subsection !== lastSubsection) {
                      lastSubsection = subsection;
                      nodes.push(
                        <div key={`sub_${i}`} className="bg-white border border-t-0 px-6 py-2" style={{ borderColor: "#c5cae9" }}>
                          <span className="text-xs font-bold italic text-gray-600">{subsection}</span>
                        </div>
                      );
                    }

                    // ── Carte question ──
                    nodes.push(
                      <div key={q.id} className="bg-white border border-t-0 overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                        {/* Texte de la question */}
                        <div className="px-6 pt-5 pb-3">
                          <p className="text-sm font-semibold text-gray-900 leading-relaxed whitespace-pre-wrap">
                            <span className="font-black" style={{ color: "#1a237e" }}>{qNum}.</span> {q.text}
                          </p>
                        </div>

                        {/* Options QCM — style document avec cases à cocher */}
                        {q.type === "qcm" && q.options && q.options.length > 0 && (
                          <div className="px-8 pb-4 space-y-2">
                            {q.options.map((opt, oi) => (
                              <label key={oi} className={`flex items-center gap-3 py-2 px-3 rounded-lg cursor-pointer transition-all group ${selected === opt ? "bg-[#e8f5e9]" : "hover:bg-gray-50"}`}>
                                <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${selected === opt ? "border-[#2e7d32] bg-[#2e7d32]" : "border-gray-400 group-hover:border-[#1a237e]"}`}>
                                  {selected === opt && <div className="h-2 w-2 rounded-full bg-white" />}
                                </div>
                                <input type="radio" name={`pq_${q.id}`} checked={selected === opt} onChange={() => setPreviewAnswers(prev => ({ ...prev, [answKey]: opt }))} className="sr-only" />
                                <span className={`text-sm leading-snug ${selected === opt ? "font-semibold text-gray-900" : "text-gray-700"}`}>{opt}</span>
                              </label>
                            ))}
                          </div>
                        )}

                        {/* "Justifiez votre choix" — ligne de séparation puis éditeur */}
                        {q.type === "qcm" && q.has_justification && (
                          <div className="px-6 pb-5">
                            <p className="text-xs font-bold text-gray-500 mb-2 italic underline">Justifiez votre/vos choix :</p>
                            <RichTextEditor
                              value={previewAnswers[justKey] || ""}
                              onChange={html => setPreviewAnswers(prev => ({ ...prev, [justKey]: html }))}
                              placeholder="Rédigez votre justification…"
                              minHeight="90px"
                            />
                          </div>
                        )}

                        {/* ── Questions composées Vrai/Faux ── */}
                        {q.type === "compound" && q.parts && q.parts.length > 0 && (
                          <div className="px-6 pb-5 space-y-3">
                            {q.parts.map((part) => (
                              <div key={part.id} className="border rounded-xl overflow-hidden" style={{ borderColor: "#e8eaf6" }}>
                                <div className="px-4 py-2 text-xs font-bold text-gray-700" style={{ backgroundColor: "#f4f6f9" }}>
                                  {part.label}
                                </div>
                                {part.type === "vraifaux" ? (
                                  <div className="px-4 py-3 flex gap-3">
                                    {["Vrai", "Faux"].map(val => {
                                      const key = `${q.id}_${part.id}`;
                                      const sel = previewAnswers[key] === val;
                                      return (
                                        <button key={val} onClick={() => setPreviewAnswers(prev => ({ ...prev, [key]: val }))}
                                          className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all border"
                                          style={{ backgroundColor: sel ? (val === "Vrai" ? "#2e7d32" : "#c62828") : "white", color: sel ? "white" : (val === "Vrai" ? "#2e7d32" : "#c62828"), borderColor: val === "Vrai" ? "#a5d6a7" : "#ef9a9a" }}>
                                          {val === "Vrai" ? "✓ Vrai" : "✗ Faux"}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="px-4 pb-3 pt-2">
                                    <RichTextEditor value={previewAnswers[`${q.id}_${part.id}`] || ""} onChange={html => setPreviewAnswers(prev => ({ ...prev, [`${q.id}_${part.id}`]: html }))} placeholder="Votre réponse…" minHeight="80px" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Réponse ouverte — éditeur Word complet */}
                        {q.type === "open" && (
                          <div className="px-6 pb-5">
                            <RichTextEditor value={previewAnswers[answKey] || ""} onChange={html => setPreviewAnswers(prev => ({ ...prev, [answKey]: html }))} placeholder="Rédigez votre réponse (vous pouvez utiliser du texte, des tableaux, des listes…)" minHeight="150px" />
                          </div>
                        )}

                        {/* Séparateur bas */}
                        <div className="h-px mx-6" style={{ backgroundColor: "#e8eaf6" }} />
                      </div>
                    );
                  });

                  // Pied de page — navigation pagination
                  nodes.push(
                    <div key="footer" className="bg-white border border-t-0 rounded-b-xl px-6 py-4 flex items-center justify-between gap-3" style={{ borderColor: "#c5cae9" }}>
                      <span className="text-xs text-gray-400">Page <strong>{previewPage + 1}</strong> / {totalPreviewPages}</span>
                      <div className="flex items-center gap-2">
                        {previewPage > 0 && (
                          <button onClick={() => setPreviewPage(p => p - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border" style={{ borderColor: "#c5cae9", color: "#1a237e" }}>
                            <ChevronLeft className="h-4 w-4" />Précédent
                          </button>
                        )}
                        {isLastPreviewPage ? (
                          <button
                            onClick={() => {
                              const totalQ = examPreview!.questions.length;
                              const answeredQ = examPreview!.questions.filter(q => previewAnswers[q.id] && previewAnswers[q.id] !== "<p></p>").length;
                              alert(`Aperçu uniquement — non interactif.\n\nDans l'examen réel :\n✅ ${answeredQ} question(s) répondues\n❌ ${totalQ - answeredQ} question(s) sans réponse\n\nLe candidat verra un modal de confirmation avant soumission.`);
                            }}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "#2e7d32" }}
                          >
                            <Send className="h-4 w-4" />Soumettre ma copie
                          </button>
                        ) : (
                          <button onClick={() => setPreviewPage(p => p + 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: "#1a237e" }}>
                            Suivant<ChevronRight className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );

                  return <>{nodes}</>;
                })() : (
                  /* Aucune question parsée — blocs libres */
                  <>
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className="bg-white border border-t-0 overflow-hidden" style={{ borderColor: "#c5cae9" }}>
                        <div className="px-6 pt-5 pb-2">
                          <p className="text-sm font-semibold text-gray-700">{n}. Question {n}</p>
                        </div>
                        <div className="px-6 pb-5">
                          <RichTextEditor value={previewAnswers[`free_${n}`] || ""} onChange={html => setPreviewAnswers(prev => ({ ...prev, [`free_${n}`]: html }))} placeholder="Rédigez votre réponse…" minHeight="130px" />
                        </div>
                        <div className="h-px mx-6" style={{ backgroundColor: "#e8eaf6" }} />
                      </div>
                    ))}
                    <div className="bg-white border border-t-0 rounded-b-xl px-6 py-4 text-center" style={{ borderColor: "#c5cae9" }}>
                      <p className="text-sm font-semibold text-amber-700">Questions non encore extraites.</p>
                      <p className="text-xs text-amber-600 mt-1">Fermez et cliquez <strong>⟳ Re-parser</strong> sur cet examen pour les extraire automatiquement.</p>
                    </div>
                  </>
                )}
              </div>
              </div>{/* fin DROITE */}
            </div>{/* fin corps principal */}
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL Publication — sélection des candidats ── */}
      <AnimatePresence>
        {publishModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => { if (!isPublishing) setPublishModal(null); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.22 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl"
              style={{ border: "1px solid #c5cae9" }}
            >
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <Send className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">Publier l&apos;examen</h2>
                    <p className="text-[11px] text-white/60 mt-0.5 truncate max-w-[220px]">{publishModal.certification}</p>
                  </div>
                </div>
                {!isPublishing && (
                  <button onClick={() => setPublishModal(null)} className="text-white/70 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Body */}
              <div className="p-5">
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Sélectionnez les candidats validés qui recevront le lien d&apos;accès à l&apos;examen par email.
                </p>

                {publishLoadingCandidates ? (
                  <div className="flex items-center justify-center py-10 gap-3 text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#1a237e" }} />
                    <span className="text-sm">Chargement des candidats…</span>
                  </div>
                ) : publishCandidates.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-medium">Aucun candidat validé</p>
                    <p className="text-xs mt-1">Il n&apos;y a pas de candidat approuvé pour cette certification.</p>
                  </div>
                ) : (
                  <>
                    {/* Tout sélectionner / désélectionner */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                        {publishCandidates.length} candidat(s) validé(s)
                      </span>
                      <button
                        onClick={() => {
                          if (publishSelected.size === publishCandidates.length)
                            setPublishSelected(new Set());
                          else
                            setPublishSelected(new Set(publishCandidates.map(c => c.response_id)));
                        }}
                        className="text-xs font-semibold underline"
                        style={{ color: "#1a237e" }}
                      >
                        {publishSelected.size === publishCandidates.length ? "Tout désélectionner" : "Tout sélectionner"}
                      </button>
                    </div>

                    {/* Liste candidats */}
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {publishCandidates.map(c => {
                        const checked = publishSelected.has(c.response_id);
                        return (
                          <label
                            key={c.response_id}
                            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                              checked
                                ? "border-[#c5cae9] bg-[#f0f2ff]"
                                : "border-gray-100 bg-gray-50 opacity-60"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePublishCandidate(c.response_id)}
                              className="accent-[#1a237e] h-4 w-4 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800 font-mono">{c.public_id}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3" style={{ backgroundColor: "#f4f6f9" }}>
                <span className="text-xs text-gray-400">
                  {publishSelected.size} / {publishCandidates.length} sélectionné(s)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPublishModal(null)}
                    disabled={isPublishing}
                    className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirmPublish}
                    disabled={isPublishing || publishSelected.size === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: "#1a237e" }}
                  >
                    {isPublishing
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>
                      : <><Send className="h-4 w-4" /> Envoyer</>
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
