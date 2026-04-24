"use client";

import { useState, useEffect } from "react";
import { fetchResponses, updateExamGrade, fetchForms, getCertFormId, setCertFormId, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Search, FileText, CheckCircle, AlertTriangle,
  X, Save, FilePenLine, FileCheck, MessageSquare,
  ChevronLeft, ChevronRight, Eye
} from "lucide-react";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const ITEMS_PER_PAGE = 8;

export default function CorrecteurPage() {
  const [responses, setResponses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedResponse, setSelectedResponse] = useState<any | null>(null);
  const [grade, setGrade] = useState("");
  const [comments, setComments] = useState("");
  const [examStatus, setExamStatus] = useState("completed");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [previewFile, setPreviewFile] = useState<{ url: string; title?: string } | null>(null);

  const { user, logout, isLoading: isAuthLoading } = useAuth();
  const correctorEmail = user?.email || "";

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      let formId = getCertFormId();
      if (!formId) {
        const forms = await fetchForms();
        const certForm = forms.find((f: any) => f.title === "Fiche de demande - IRISQ CERTIFICATION");
        if (!certForm) { setIsLoading(false); return; }
        formId = certForm._id;
        setCertFormId(formId!);
      }
      const allResponses = await fetchResponses(formId!);
      const filtered = allResponses
        .filter((r: any) => r.status === "approved")
        .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
      setResponses(filtered);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateId = (r: any) => r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;

  const formatDate = (isoString: string) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const resolveUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    return `${API_URL.replace("/api", "")}${url}`;
  };

  const getExamDocUrl = (response: any): string | null => {
    if (response.exam_document) return resolveUrl(response.exam_document);
    return null;
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResponse || !grade) return;
    setIsSubmitting(true);
    try {
      const updated = await updateExamGrade(selectedResponse._id, {
        exam_grade: grade,
        exam_status: examStatus,
        exam_comments: comments,
      });
      setResponses(responses.map(r => r._id === updated._id ? updated : r));
      setSelectedResponse(null);
    } catch (error) {
      console.error("Failed to submit grade:", error);
      alert("Erreur lors de la soumission de la note.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openGradingModal = (response: any) => {
    setSelectedResponse(response);
    setGrade(response.exam_grade || "");
    setComments(response.exam_comments || "");
    setExamStatus(response.exam_status || "completed");
  };

  // Remove fake login handlers

  const filteredResponses = responses.filter(r => {
    // Only show responses assigned to this corrector
    if (r.assigned_examiner_email?.toLowerCase() !== correctorEmail) {
      return false;
    }
    const candidateId = generateId(r).toLowerCase();
    const cert = (r.answers?.["Certification souhaitée"] || "").toLowerCase();
    return candidateId.includes(searchQuery.toLowerCase()) || cert.includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredResponses.length / ITEMS_PER_PAGE);
  const paginatedResponses = filteredResponses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f4f6f9]">
        <Loader2 className="animate-spin text-[#1a237e] h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
            Évaluations Candidats
          </h1>
          <p className="text-gray-500 text-sm mt-1">Connecté en tant que <span className="font-bold text-[#1a237e]">{correctorEmail}</span></p>
        </div>
        <button
          onClick={logout}
          className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-wider px-4 py-2 bg-white rounded-lg border shadow-sm border-gray-200 hover:border-red-200"
        >
          Déconnexion
        </button>
      </div>

      {/* ── Search ── */}
      <div className="bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#c5cae9" }}>
        <Search className="text-[#1a237e] h-5 w-5 shrink-0" />
        <input
          type="text"
          placeholder="Chercher par ID Candidat ou Certification…"
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 uppercase"
        />
        {searchQuery && (
          <button
            onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
        style={{ borderColor: "#c5cae9" }}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
          <h2 className="text-sm font-bold uppercase tracking-widest text-white">Liste des Copies</h2>
          <div className="text-xs text-white/70">{filteredResponses.length} copie(s)</div>
        </div>

        {isLoading ? (
          <div className="p-16 text-center text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: "#1a237e" }} />
            <p className="text-sm">Chargement des copies…</p>
          </div>

        ) : filteredResponses.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium">Aucune copie trouvée.</p>
          </div>

        ) : (
          <>
            <div className="grid grid-cols-12 px-6 py-3 bg-[#f8f9fa] border-b text-xs font-bold uppercase tracking-wider text-[#1a237e]" style={{ borderColor: "#e8eaf6" }}>
              <div className="col-span-3">Candidat</div>
              <div className="col-span-5">Certification</div>
              <div className="col-span-2 text-center">Note</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            <div className="divide-y" style={{ borderColor: "#f0f2f5" }}>
              {paginatedResponses.map((response, idx) => {
                const candidateId = generateId(response);
                const graded = !!response.exam_grade;
                const hasDoc = !!getExamDocUrl(response);

                return (
                  <motion.div
                    key={response._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="grid grid-cols-12 items-center px-6 py-4 hover:bg-gray-50/50 transition-colors group"
                  >
                    <div className="col-span-3 flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">
                        {candidateId.slice(-4)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 tracking-wide text-sm group-hover:text-[#1a237e] transition-colors">
                          {candidateId}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(response.submitted_at)}</p>
                      </div>
                    </div>

                    <div className="col-span-5">
                      <p className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg leading-tight inline-block max-w-[260px] truncate">
                        {response.answers?.["Certification souhaitée"] || "Non spécifiée"}
                      </p>
                    </div>

                    <div className="col-span-2 flex justify-center">
                      {graded ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                          style={{ background: "#e8f5e9", color: "#2e7d32", borderColor: "#c8e6c9" }}>
                          <CheckCircle className="h-3 w-3" />
                          {response.exam_grade}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
                          style={{ background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }}>
                          <AlertTriangle className="h-3 w-3" />
                          En attente
                        </span>
                      )}
                    </div>

                    <div className="col-span-2 flex items-center justify-end">
                      <button
                        onClick={() => openGradingModal(response)}
                        disabled={!hasDoc}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: "#1a237e" }}
                        onMouseEnter={e => { if (hasDoc) e.currentTarget.style.backgroundColor = "#283593"; }}
                        onMouseLeave={e => { if (hasDoc) e.currentTarget.style.backgroundColor = "#1a237e"; }}
                        title={!hasDoc ? "Aucune copie soumise" : ""}
                      >
                        <FilePenLine className="h-3.5 w-3.5" />
                        {graded ? "Modifier" : "Corriger"}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t flex items-center justify-between bg-[#f8f9fa]" style={{ borderColor: "#e8eaf6" }}>
                <p className="text-xs text-gray-500 font-medium">
                  Page <span className="font-bold text-[#1a237e]">{currentPage}</span> sur <span className="font-bold">{totalPages}</span>
                  {" "}· {filteredResponses.length} résultat{filteredResponses.length !== 1 ? "s" : ""}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .reduce<(number | string)[]>((acc, p, idx, arr) => {
                      if (idx > 0 && typeof arr[idx - 1] === "number" && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "..." ? (
                        <span key={`e-${idx}`} className="text-gray-400 text-sm font-bold px-1">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setCurrentPage(p as number)}
                          className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === p ? "bg-[#1a237e] text-white" : "border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]"}`}
                        >
                          {p}
                        </button>
                      )
                    )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-200 text-[#1a237e] hover:bg-[#e8eaf6] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>

      {/* ── MODAL Correction ── */}
      <AnimatePresence>
        {selectedResponse && (
          <div className="fixed inset-0 z-50 flex bg-black/50 backdrop-blur-sm overflow-hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0"
              onClick={() => !isSubmitting && setSelectedResponse(null)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              className="relative ml-auto w-full max-w-5xl bg-white h-full shadow-2xl flex flex-col z-10"
            >
              {/* Header */}
              <div className="px-6 py-4 flex items-center justify-between shrink-0" style={{ backgroundColor: "#1a237e" }}>
                <div className="flex items-center gap-3">
                  <div className="bg-white/10 p-2 rounded-lg">
                    <FilePenLine className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold uppercase tracking-widest text-white">Évaluation Technique</h2>
                    <p className="text-xs text-white/60 font-mono mt-0.5">{generateId(selectedResponse)}</p>
                  </div>
                </div>
                <button
                  onClick={() => !isSubmitting && setSelectedResponse(null)}
                  disabled={isSubmitting}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Split layout */}
              <div className="flex-1 flex overflow-hidden">

                {/* ── LEFT: PDF Viewer ── */}
                <div className="flex-[3] flex flex-col overflow-hidden border-r" style={{ borderColor: "#e8eaf6" }}>
                  {/* Toolbar */}
                  <div className="px-5 py-3 bg-[#f8f9fa] border-b flex items-center justify-between shrink-0" style={{ borderColor: "#e8eaf6" }}>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-[#1a237e]" />
                      <span className="text-xs font-bold text-[#1a237e] uppercase tracking-wider">Copie du candidat</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const u = getExamDocUrl(selectedResponse);
                        if (u) setPreviewFile({ url: u, title: `Copie — ${generateId(selectedResponse)}` });
                      }}
                      disabled={!getExamDocUrl(selectedResponse)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#1a237e] bg-[#e8eaf6] px-3 py-1.5 rounded-lg hover:bg-[#c5cae9] transition-colors border border-[#c5cae9] disabled:opacity-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Aperçu plein écran
                    </button>
                  </div>

                  {/* PDF iframe — fills all remaining height */}
                  <div className="flex-1 bg-gray-200">
                    <iframe
                      src={getExamDocUrl(selectedResponse) || ""}
                      className="w-full h-full"
                      title="Copie du candidat"
                    />
                  </div>
                </div>

                {/* ── RIGHT: Grading form ── */}
                <div className="flex-[1.2] flex flex-col bg-gray-50 overflow-y-auto">
                  <form onSubmit={handleGradeSubmit} className="flex flex-col flex-1 p-6 gap-5">

                    <h3 className="text-xs font-black uppercase tracking-wider text-[#1a237e] pb-2 border-b border-[#e8eaf6]">
                      Notation
                    </h3>

                    {/* Note */}
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Note finale <span className="text-rose-500">*</span>
                        <span className="normal-case font-normal ml-1 text-gray-400">(ex: 15/20 ou 85%)</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={grade}
                        onChange={e => setGrade(e.target.value)}
                        placeholder="Saisissez la note…"
                        className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all font-mono"
                        style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                      />
                    </div>

                    {/* Commentaires */}
                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        <span className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          Commentaires / Observations
                        </span>
                      </label>
                      <textarea
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        placeholder="Ajoutez vos observations sur la copie…"
                        className="flex-1 w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none min-h-[200px]"
                        style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                      />
                    </div>

                    {/* Already graded info */}
                    {selectedResponse.exam_grade && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        Note actuelle : <span className="font-black">{selectedResponse.exam_grade}</span>
                      </div>
                    )}

                    {/* Buttons */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-gray-200">
                      <button
                        type="submit"
                        disabled={isSubmitting || !grade}
                        className="w-full py-3 px-4 text-white rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed flex justify-center items-center gap-2"
                        style={{ backgroundColor: isSubmitting || !grade ? "#9e9e9e" : "#1a237e" }}
                        onMouseEnter={e => { if (!isSubmitting && grade) e.currentTarget.style.backgroundColor = "#283593"; }}
                        onMouseLeave={e => { if (!isSubmitting && grade) e.currentTarget.style.backgroundColor = "#1a237e"; }}
                      >
                        {isSubmitting
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement…</>
                          : <><Save className="h-4 w-4" /> Enregistrer l'évaluation</>
                        }
                      </button>
                      <button
                        type="button"
                        onClick={() => !isSubmitting && setSelectedResponse(null)}
                        disabled={isSubmitting}
                        className="w-full py-2.5 px-4 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                </div>
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