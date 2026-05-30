"use client";

import { motion } from "framer-motion";
import {
    Trophy,
    ShieldCheck,
    Star,
    CalendarDays,
    Loader2,
    Award,
    CheckCircle2,
} from "lucide-react";
import { useCandidate } from "@/lib/candidate-context";

// ── Correspondance certification → domaine visuel ──────────────────────────
function getCertColor(cert: string): { bg: string; border: string; text: string; badge: string } {
    const c = cert.toLowerCase();
    if (c.includes("17025"))  return { bg: "#f0fdf4", border: "#86efac", text: "#15803d", badge: "#dcfce7" };
    if (c.includes("9001"))   return { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", badge: "#dbeafe" };
    if (c.includes("14001"))  return { bg: "#f0fdf4", border: "#6ee7b7", text: "#047857", badge: "#d1fae5" };
    if (c.includes("45001"))  return { bg: "#fff7ed", border: "#fdba74", text: "#c2410c", badge: "#ffedd5" };
    return { bg: "#f5f3ff", border: "#c4b5fd", text: "#6d28d9", badge: "#ede9fe" };
}

function getLevelLabel(cert: string): string {
    const c = cert.toLowerCase();
    if (c.includes("lead"))   return "Lead";
    if (c.includes("junior")) return "Junior";
    return "Implementor";
}

function getLevelIcon(cert: string) {
    const level = getLevelLabel(cert);
    if (level === "Lead")   return <Star className="h-3.5 w-3.5" />;
    if (level === "Junior") return <CheckCircle2 className="h-3.5 w-3.5" />;
    return <ShieldCheck className="h-3.5 w-3.5" />;
}

// ──────────────────────────────────────────────────────────────────────────
export default function CertificationsPage() {
    const { dossiers, loading } = useCandidate();

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
        );
    }

    // Dossiers certifiés uniquement
    const certified = dossiers.filter(d => d.final_decision === "certified");

    return (
        <div className="max-w-xl mx-auto space-y-8 py-4">

            {/* ── En-tête ── */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gray-400 mb-1">
                    Espace candidat
                </p>
                <h1 className="text-3xl font-black leading-tight" style={{ color: "#1a237e" }}>
                    Mes certifications
                </h1>
                <p className="text-sm text-gray-400 mt-1">
                    {certified.length === 0
                        ? "Aucune certification obtenue pour le moment."
                        : `${certified.length} certification${certified.length > 1 ? "s" : ""} obtenue${certified.length > 1 ? "s" : ""}`}
                </p>
            </motion.div>

            {/* ── Liste des certifications ── */}
            {certified.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 }}
                    className="flex flex-col items-center justify-center py-16 px-6 text-center bg-white rounded-2xl border border-gray-100 shadow-sm"
                >
                    <div
                        className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                        style={{ backgroundColor: "#e8eaf6" }}
                    >
                        <Award className="h-8 w-8" style={{ color: "#1a237e" }} />
                    </div>
                    <p className="font-bold text-gray-700 mb-1">Pas encore de certification</p>
                    <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
                        Vos certifications obtenues apparaîtront ici une fois que le comité aura rendu sa décision.
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-4">
                    {certified.map((d, i) => {
                        const cert  = d.answers?.["Certification souhaitée"] || "Certification";
                        const col   = getCertColor(cert);
                        const level = getLevelLabel(cert);
                        const date  = d.submitted_at
                            ? new Date(d.submitted_at).toLocaleDateString("fr-FR", {
                                day: "2-digit", month: "long", year: "numeric",
                              })
                            : null;

                        return (
                            <motion.div
                                key={d._id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.07 }}
                                className="rounded-2xl border overflow-hidden shadow-sm"
                                style={{ backgroundColor: col.bg, borderColor: col.border }}
                            >
                                {/* Header carte */}
                                <div className="px-5 pt-5 pb-4 flex items-start gap-4">
                                    {/* Icône trophée */}
                                    <div
                                        className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                        style={{ backgroundColor: col.badge, border: `1.5px solid ${col.border}` }}
                                    >
                                        <Trophy className="h-6 w-6" style={{ color: col.text }} />
                                    </div>

                                    {/* Infos certification */}
                                    <div className="flex-1 min-w-0">
                                        {/* Badge niveau */}
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                            <span
                                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                                                style={{ backgroundColor: col.badge, color: col.text, border: `1px solid ${col.border}` }}
                                            >
                                                {getLevelIcon(cert)}
                                                {level}
                                            </span>
                                        </div>

                                        {/* Nom certification */}
                                        <p
                                            className="font-black text-base leading-snug"
                                            style={{ color: col.text }}
                                        >
                                            {cert}
                                        </p>

                                        {/* Mode examen */}
                                        {d.exam_mode && (
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                Mode : <span className="font-semibold">{d.exam_mode}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Badge CERTIFIÉ */}
                                    <span
                                        className="shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl"
                                        style={{ backgroundColor: col.badge, color: col.text, border: `1.5px solid ${col.border}` }}
                                    >
                                        Certifié ✓
                                    </span>
                                </div>

                                {/* Footer carte */}
                                <div
                                    className="px-5 py-3 flex flex-wrap items-center gap-4 border-t"
                                    style={{ borderColor: col.border, backgroundColor: col.badge + "80" }}
                                >
                                    {/* Note finale */}
                                    {d.final_grade && (
                                        <div className="flex items-center gap-1.5">
                                            <Star className="h-3.5 w-3.5 shrink-0" style={{ color: col.text }} />
                                            <span className="text-xs font-bold" style={{ color: col.text }}>
                                                Note :&nbsp;
                                                <span className="font-black">{d.final_grade}</span>
                                            </span>
                                        </div>
                                    )}

                                    {/* Appréciation */}
                                    {d.final_appreciation && (
                                        <div className="flex items-center gap-1.5">
                                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: col.text }} />
                                            <span className="text-xs italic" style={{ color: col.text }}>
                                                {d.final_appreciation}
                                            </span>
                                        </div>
                                    )}

                                    {/* Date */}
                                    {date && (
                                        <div className="flex items-center gap-1.5 ml-auto">
                                            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                            <span className="text-xs text-gray-500">{date}</span>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* ── Message d'encouragement si en cours ── */}
            {certified.length === 0 && dossiers.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-white border border-gray-100 shadow-sm"
                >
                    <ShieldCheck className="h-5 w-5 text-blue-500 shrink-0" />
                    <p className="text-sm text-gray-500">
                        Votre dossier est en cours d&apos;examen. Continuez, vous êtes sur la bonne voie !
                    </p>
                </motion.div>
            )}
        </div>
    );
}
