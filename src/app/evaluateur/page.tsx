"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, File as FileIcon, X, Eye, Loader2,
  CheckCircle2, Filter, ChevronLeft, ChevronRight
} from "lucide-react";
import { fetchForms, fetchResponses, getCertFormId, setCertFormId, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";

const CERTIFICATIONS = [
  "Junior Implementor ISO/IEC17025:2017",
  "Implementor ISO/IEC17025:2017",
  "Lead Implementor ISO/IEC17025:2017",
  "Junior Implementor ISO 9001:2015",
  "Implementor ISO 9001:2015",
  "Lead Implementor ISO 9001:2015",
  "Junior Implementor ISO 14001:2015",
  "Implementor ISO 14001:2015",
  "Lead Implementor ISO 14001:2015"
];

const HIDDEN_FIELDS = [
  "Nom", "Prénom", "Date de naissance", "Lieu de naissance",
  "Nationalité", "Adresse", "Téléphone", "Email", "Déclaration acceptée",
  "Expérience (années)", "Pièces justificatives", "CV", "Autres documents"
];

const ITEMS_PER_PAGE = 8;

export default function EvaluatorPage() {
  const router = useRouter();
  const [responses, setResponses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Filter state
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [activeCertFilter, setActiveCertFilter] = useState<string | null>(null);

  const { user, logout, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        let formId = getCertFormId();
        if (!formId) {
          const formsData = await fetchForms();
          if (!formsData.length) { setIsLoading(false); return; }
          formId = formsData[0]._id;
          setCertFormId(formId!);
        }
        const allResponses = await fetchResponses(formId!);
        const approved = allResponses
          .filter((r: any) => r.status === "approved")
          .sort((a: any, b: any) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        setResponses(approved);
      } catch (error) {
        console.error("Failed to load evaluation data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const generateId = (r: any) => r.candidate_id || `CAND-${r._id.slice(-6).toUpperCase()}`;

  const formatDate = (isoString: string) => {
    if (!isoString) return "Inconnu";
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  // Filtered list
  const filteredResponses = responses.filter(r => {
    const candidateId = generateId(r);
    const matchesSearch = candidateId.includes(searchQuery.toUpperCase());
    const matchesCert = activeCertFilter
      ? r.answers?.["Certification souhaitée"] === activeCertFilter
      : true;
    return matchesSearch && matchesCert;
  });

  // Pagination
  const totalPages = Math.ceil(filteredResponses.length / ITEMS_PER_PAGE);
  const paginatedResponses = filteredResponses.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const handleCertFilter = (cert: string | null) => {
    setActiveCertFilter(cert);
    setCurrentPage(1);
    setShowFilterDropdown(false);
  };



  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; color: string; border: string; text: string; icon: React.ReactNode }> = {
      approved: { bg: "#e8f5e9", color: "#2e7d32", border: "#c8e6c9", text: "Approuvé", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
      rejected: { bg: "#fef2f2", color: "#c62828", border: "#fecaca", text: "Rejeté", icon: <span className="h-3.5 w-3.5 rounded-full bg-red-500"></span> },
      pending: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", text: "En attente", icon: <span className="h-3.5 w-3.5 rounded-full bg-amber-500"></span> },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border"
        style={{ backgroundColor: config.bg, color: config.color, borderColor: config.border }}
      >
        {config.icon} {config.text}
      </span>
    );
  };

  if (isAuthLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#f4f6f9]">
        <Loader2 className="animate-spin text-[#1a237e] h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 bg-[#f4f6f9] min-h-screen" onClick={() => showFilterDropdown && setShowFilterDropdown(false)}>

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight" style={{ color: "#1a237e" }}>
            Espace Évaluateur
          </h1>
          <p className="text-gray-400 text-sm mt-1">Connecté en tant que <span className="font-bold text-[#1a237e]">{user?.email}</span></p>
        </div>
        <button
          onClick={logout}
          className="text-xs font-bold text-gray-500 hover:text-red-500 transition-colors uppercase tracking-wider px-4 py-2 bg-white rounded-lg border shadow-sm border-gray-200 hover:border-red-200"
        >
          Déconnexion
        </button>
      </div>

      {/* ── Barre de recherche + Filtre ── */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white p-4 rounded-xl shadow-sm border flex items-center gap-3" style={{ borderColor: "#c5cae9" }}>
          <Search className="text-[#1a237e] h-5 w-5 shrink-0" />
          <input
            type="text"
            placeholder="Chercher par ID Candidat..."
            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-gray-700 placeholder-gray-400 uppercase"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => handleSearchChange("")}
              className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filtre Button */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowFilterDropdown(prev => !prev)}
            className={`flex items-center gap-2 px-4 py-3.5 rounded-xl font-bold text-sm border shadow-sm transition-all ${activeCertFilter
              ? 'bg-[#1a237e] text-white border-[#1a237e]'
              : 'bg-white text-[#1a237e] border-[#c5cae9] hover:bg-[#e8eaf6]'
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
                  <button
                    onClick={() => handleCertFilter(null)}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${!activeCertFilter
                      ? 'bg-[#e8eaf6] text-[#1a237e] font-bold'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    Toutes les certifications
                  </button>
                  {CERTIFICATIONS.map(cert => (
                    <button
                      key={cert}
                      onClick={() => handleCertFilter(cert)}
                      className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${activeCertFilter === cert
                        ? 'bg-[#e8eaf6] text-[#1a237e] font-bold'
                        : 'text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                      {cert}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Active filter chip */}
      {activeCertFilter && (
        <div className="flex items-center gap-2">
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
      ) : filteredResponses.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border shadow-sm" style={{ borderColor: "#e0e0e0" }}>
          <div className="w-16 h-16 bg-[#e8eaf6] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileIcon className="h-8 w-8 text-[#1a237e]" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Aucun dossier trouvé</h3>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Il n'y a pas encore de dossiers approuvés ou correspondant à votre recherche.
          </p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border shadow-sm overflow-hidden"
          style={{ borderColor: "#c5cae9" }}
        >
          {/* Table header */}
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: "#1a237e", borderColor: "#283593" }}>
            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
              {activeCertFilter || "Activités récentes"}
            </h2>
            <div className="text-xs text-white/70 font-bold bg-white/20 px-3 py-1 rounded-lg">
              {filteredResponses.length} Dossier{filteredResponses.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-[#f8f9fa] border-b text-xs uppercase font-bold text-[#1a237e]" style={{ borderColor: "#e8eaf6" }}>
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
                {paginatedResponses.map((response) => {
                  const candidateId = generateId(response);
                  const cert = response.answers?.["Certification souhaitée"] || "—";
                  return (
                    <tr
                      key={response._id}
                      onClick={() => router.push(`/evaluateur/${response._id}`)}
                      className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-[#e8eaf6] flex items-center justify-center text-[#1a237e] font-bold text-xs shrink-0">
                            {candidateId.slice(-4)}
                          </div>
                          <span className="font-bold text-gray-900 tracking-wide">{candidateId}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded-lg leading-tight block max-w-[200px]">
                          {cert}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 text-sm font-medium whitespace-nowrap">
                        {formatDate(response.submitted_at)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(response.status)}
                      </td>
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
                        <Link
                          href={`/evaluateur/${response._id}`}
                          className="inline-flex items-center justify-center p-2 rounded-xl border border-gray-200 text-[#1a237e] hover:bg-[#1a237e] hover:border-[#1a237e] hover:text-white transition-all shadow-sm"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t flex items-center justify-between bg-[#f8f9fa]" style={{ borderColor: "#e8eaf6" }}>
              <p className="text-xs text-gray-500 font-medium">
                Page <span className="font-bold text-[#1a237e]">{currentPage}</span> sur <span className="font-bold">{totalPages}</span>
                {" "}· {filteredResponses.length} résultat{filteredResponses.length !== 1 ? 's' : ''}
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
                    if (idx > 0 && typeof arr[idx - 1] === 'number' && (p as number) - (arr[idx - 1] as number) > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="text-gray-400 text-sm font-bold px-1">…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        className={`w-8 h-8 rounded-lg text-sm font-bold transition-colors ${currentPage === p
                          ? 'bg-[#1a237e] text-white'
                          : 'border border-gray-200 text-gray-600 hover:bg-[#e8eaf6]'
                          }`}
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
        </motion.div>
      )}


    </div>
  );
}