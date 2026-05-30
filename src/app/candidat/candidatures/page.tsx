"use client";

import { motion } from "framer-motion";
import {
    CheckCircle2,
    AlertTriangle,
    Clock,
    Layers,
    CalendarDays,
    BadgeCheck,
    FileText,
} from "lucide-react";
import { useCandidate } from "@/lib/candidate-context";
import type { CandidateDossier } from "@/lib/api";

function statusConfig(status?: string) {
    if (status === "approved")
        return {
            label: "Validé",
            color: "#2e7d32",
            bg: "#e8f5e9",
            border: "#a5d6a7",
            Icon: CheckCircle2,
        };
    if (status === "rejected")
        return {
            label: "Refusé",
            color: "#c62828",
            bg: "#ffebee",
            border: "#ef9a9a",
            Icon: AlertTriangle,
        };
    return {
        label: "En attente",
        color: "#b45309",
        bg: "#fff8e1",
        border: "#ffe082",
        Icon: Clock,
    };
}

function CandidatureCard({ d, index, isActive, onSelect }: {
    d: CandidateDossier;
    index: number;
    isActive: boolean;
    onSelect: () => void;
}) {
    const s = statusConfig(d.status);
    const cert = d.answers?.["Certification souhaitée"] || "Certification non précisée";
    const submittedAt = d.submitted_at
        ? new Date(d.submitted_at).toLocaleDateString("fr-FR", {
            day: "2-digit", month: "long", year: "numeric",
          })
        : null;

    const examLabel =
        d.exam_status === "passed" ? "Examen passé"
        : d.exam_token ? "Convoqué à l'examen"
        : "Non convoqué";

    const examColor =
        d.exam_status === "passed" ? "#2e7d32"
        : d.exam_token ? "#1a237e"
        : "#9ca3af";

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.06 }}
            onClick={onSelect}
            className="cursor-pointer rounded-2xl p-5 transition-all"
            style={{
                backgroundColor: "#ffffff",
                border: isActive ? "2px solid #1a237e" : "2px solid #e8eaf6",
                boxShadow: isActive
                    ? "0 4px 20px rgba(26,35,126,0.12)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
            }}
        >
            <div className="flex items-start gap-4">
                {/* Numéro */}
                <div
                    className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0"
                    style={{ backgroundColor: isActive ? "#1a237e" : "#9ca3af" }}
                >
                    {index + 1}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Certification */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-800 text-base leading-tight">{cert}</h3>
                        {/* Badge statut */}
                        <span
                            className="flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                            style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
                        >
                            <s.Icon className="h-3.5 w-3.5" />
                            {s.label}
                        </span>
                    </div>

                    {/* ID public */}
                    <p className="text-xs font-mono text-gray-400 mt-1">{d.public_id}</p>

                    {/* Infos secondaires */}
                    <div className="mt-3 flex flex-wrap gap-3">
                        {submittedAt && (
                            <span className="flex items-center gap-1.5 text-xs text-gray-500">
                                <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
                                Soumis le {submittedAt}
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: examColor }}>
                            <FileText className="h-3.5 w-3.5" />
                            {examLabel}
                        </span>
                        {d.final_grade != null && (
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                                <BadgeCheck className="h-3.5 w-3.5 text-indigo-500" />
                                Note finale : {d.final_grade}
                                {d.final_appreciation && ` — ${d.final_appreciation}`}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Indicateur actif */}
            {isActive && (
                <div
                    className="mt-4 pt-3 flex items-center gap-2 text-xs font-bold"
                    style={{ borderTop: "1px solid #e8eaf6", color: "#1a237e" }}
                >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#2e7d32" }} />
                    Candidature active — les autres sections affichent les données de ce dossier
                </div>
            )}
        </motion.div>
    );
}

export default function MesCandidaturesPage() {
    const { dossiers, dossier: activeDossier, setActiveDossierId, loading } = useCandidate();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-3">
                <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#e8eaf6" }}
                >
                    <Layers className="h-5 w-5" style={{ color: "#1a237e" }} />
                </div>
                <div>
                    <h1 className="text-xl font-extrabold" style={{ color: "#1a237e" }}>
                        Mes candidatures
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {dossiers.length} candidature{dossiers.length > 1 ? "s" : ""} enregistrée{dossiers.length > 1 ? "s" : ""}
                    </p>
                </div>
            </div>

            {dossiers.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Layers className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold">Aucune candidature trouvée</p>
                </div>
            ) : (
                <>
                    {dossiers.length > 1 && (
                        <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                            Vous avez plusieurs candidatures. Cliquez sur une carte pour la sélectionner comme dossier actif — les sections <strong>Mes dossiers</strong>, <strong>Mes Examens</strong> et <strong>Mes corrections</strong> afficheront les données correspondantes.
                        </p>
                    )}

                    <div className="grid gap-4">
                        {dossiers.map((d, i) => (
                            <CandidatureCard
                                key={d._id}
                                d={d}
                                index={i}
                                isActive={d._id === activeDossier?._id}
                                onSelect={() => setActiveDossierId(d._id)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
