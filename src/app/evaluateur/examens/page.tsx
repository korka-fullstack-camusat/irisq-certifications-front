"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FilePlus, Trash2, Download, Search, Loader2,
  FileText, AlertCircle, Send, X, Plus, Upload, Eye
} from "lucide-react";
import { fetchExams, createExam, deleteExam, uploadFiles, publishExam } from "@/lib/api";
import { FilePreviewModal } from "@/components/FilePreviewModal";

const CERTIFICATIONS = [
  "Junior Implementor ISO/IEC17025:2017",
  "Implementor ISO/IEC17025:2017",
  "Lead Implementor ISO/IEC17025:2017",
  "Junior Implementor ISO 9001:2015",
  "Implementor ISO 9001:2015",
  "Lead Implementor ISO 9001:2015",
  "Junior Implementor ISO 14001:2015",
  "Implementor ISO 14001:2015",
  "Lead Implementor ISO 14001:2015",
];

export default function ExamensPage() {
  const [exams, setExams]               = useState<any[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [showModal, setShowModal]       = useState(false);
  const [uploadError, setUploadError]   = useState<string | null>(null);
  const [previewFile, setPreviewFile]   = useState<{ url: string; title?: string } | null>(null);

  const [newExam, setNewExam] = useState({
    certification: CERTIFICATIONS[0],
    title: "",
  });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => { loadExams(); }, []);

  const loadExams = async () => {
    setIsLoading(true);
    try {
      const data = await fetchExams();
      setExams(data);
    } catch (error) {
      console.error("Failed to load exams:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!file || !newExam.title) return;
    setIsSubmitting(true);
    setUploadError(null);

    try {
      // 1. Upload du fichier
      const formData = new FormData();
      formData.append("files", file);
      const uploadResult = await uploadFiles(formData);
      const docUrl = uploadResult.file_urls[0];

      // 2. Création de l'examen
      await createExam({
        certification: newExam.certification,
        title: newExam.title,
        document_url: docUrl,
      });

      // 3. Reset & refresh
      closeModal();
      await loadExams();

    } catch (error: any) {
      console.error("Failed to create exam:", error);
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
    } catch (error) {
      console.error("Failed to delete exam:", error);
      alert("Erreur lors de la suppression.");
    }
  };

  const handlePublish = async (id: string, certification: string) => {
    if (!confirm(
      `Confirmer la publication de l'examen pour le parcours "${certification}" ?\n` +
      `Tous les candidats validés recevront un email avec leur lien d'examen sécurisé.`
    )) return;
    setPublishingId(id);
    try {
      const result = await publishExam(id);
      alert(`Succès ! ${result.notified_candidates_count} candidat(s) ont reçu le lien.`);
    } catch (error) {
      console.error("Failed to publish exam:", error);
      alert("Erreur lors de la publication de l'examen.");
    } finally {
      setPublishingId(null);
    }
  };

  const closeModal = () => {
    if (isSubmitting) return;
    setShowModal(false);
    setFile(null);
    setUploadError(null);
    setNewExam({ certification: CERTIFICATIONS[0], title: "" });
  };

  const filteredExams = exams.filter(e =>
    e.certification.toLowerCase().includes(searchQuery.toLowerCase()) ||
    e.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
          Gestion des Examens
        </h1>
        <p className="text-gray-400 text-sm mt-1">Créez et publiez les sujets d'examen par certification.</p>
      </div>

      {/* ── Search + Nouvel Examen ── */}
      <div className="bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3" style={{ borderColor: "#e0e0e0" }}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un examen ou une certification…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 transition-all"
            style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
          />
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

      {/* ── Exams list ── */}
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
            <p className="text-xs mt-1">Créez-en un avec le bouton "Nouvel Examen".</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredExams.map((exam, idx) => (
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
                    <p className="text-[10px] text-gray-300 mt-1 uppercase tracking-wider">
                      Créé le {new Date(exam.created_at).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePublish(exam._id, exam.certification)}
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
                    onClick={() => setPreviewFile({ url: exam.document_url, title: exam.title })}
                    className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-[#e8eaf6] hover:text-[#1a237e] hover:border-[#c5cae9] transition-all"
                    title="Visualiser"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  <a
                    href={exam.document_url}
                    download
                    className="h-8 w-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all"
                    title="Télécharger"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
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
                    <div>
                      <p className="font-semibold mb-0.5">Erreur</p>
                      <p className="text-xs opacity-80">{uploadError}</p>
                      <p className="text-xs mt-2 opacity-70">
                        Vérifiez la console et assurez-vous que votre endpoint <code className="bg-red-100 px-1 rounded">/api/upload/</code> retourne <code className="bg-red-100 px-1 rounded">{"{ file_urls: [\"...\"] }"}</code>
                      </p>
                    </div>
                  </div>
                )}

                {/* Certification */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Certification <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={newExam.certification}
                    onChange={e => setNewExam({ ...newExam, certification: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#f4f6f9] border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 transition-all cursor-pointer"
                    style={{ "--tw-ring-color": "#1a237e33" } as React.CSSProperties}
                  >
                    {CERTIFICATIONS.map(cert => <option key={cert} value={cert}>{cert}</option>)}
                  </select>
                </div>

                {/* Titre */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Titre de l'examen <span className="text-rose-500">*</span>
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
                  disabled={isSubmitting || !file || !newExam.title}
                  className="inline-flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-bold transition-colors disabled:cursor-not-allowed"
                  style={{ backgroundColor: isSubmitting || !file || !newExam.title ? "#9e9e9e" : "#1a237e" }}
                  onMouseEnter={e => { if (!isSubmitting && file && newExam.title) e.currentTarget.style.backgroundColor = "#283593"; }}
                  onMouseLeave={e => { if (!isSubmitting && file && newExam.title) e.currentTarget.style.backgroundColor = "#1a237e"; }}
                >
                  {isSubmitting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Création en cours…</>
                    : <><FilePlus className="h-4 w-4" /> Créer l'examen</>
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
    </div>
  );
}
