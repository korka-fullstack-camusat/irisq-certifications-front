"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
    ArrowRight, Award, CheckCircle2, Info, Loader2,
    Mail, ShieldCheck, User,
} from "lucide-react";

import { useCandidate } from "@/lib/candidate-context";

// ── Certifications disponibles (même liste que le form public) ────────────────
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
    "Junior Implementor ISO 45001:2018",
    "Implementor ISO 45001:2018",
    "Lead Implementor ISO 45001:2018",
];

export default function NouvelleDemandePage() {
    const { dossier, dossiers, loading } = useCandidate();

    if (loading || !dossier) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
            </div>
        );
    }

    const email        = dossier.email  || "";
    const displayName  = dossier.name   || "Candidat";
    const existingCerts = dossiers
        .map(d => d.answers?.["Certification souhaitée"])
        .filter(Boolean) as string[];

    // Certifications non encore demandées
    const available = CERTIFICATIONS.filter(c => !existingCerts.includes(c));

    return (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* ── En-tête ── */}
            <header>
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-gray-400">Espace candidat</p>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Nouvelle demande</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Candidatez à une nouvelle certification IRISQ en conservant vos identifiants actuels.
                </p>
            </header>

            {/* ── Compte actuel ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                    <User className="h-5 w-5" style={{ color: "#1a237e" }} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-sm">{displayName}</p>
                    {email && (
                        <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                            <Mail className="h-3 w-3 shrink-0" />{email}
                        </p>
                    )}
                </div>
                <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                    Compte actif
                </span>
            </div>

            {/* ── Instructions ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100" style={{ backgroundColor: "#f8f9ff" }}>
                    <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                        Comment faire une nouvelle demande&nbsp;?
                    </h2>
                </div>
                <div className="p-5 space-y-4">
                    <ol className="space-y-3">
                        {[
                            { step: "1", text: "Cliquez sur le bouton ci-dessous pour accéder au formulaire de demande." },
                            { step: "2", text: `Utilisez la même adresse email : ${email || "votre email actuel"}.` },
                            { step: "3", text: "Sélectionnez la nouvelle certification souhaitée et complétez le formulaire." },
                            { step: "4", text: "Vos identifiants de connexion (ID et mot de passe) resteront les mêmes." },
                        ].map(({ step, text }) => (
                            <li key={step} className="flex items-start gap-3">
                                <div className="h-6 w-6 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0 mt-0.5" style={{ backgroundColor: "#1a237e" }}>
                                    {step}
                                </div>
                                <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
                            </li>
                        ))}
                    </ol>

                    {/* Note importante */}
                    <div className="flex items-start gap-3 p-3 rounded-xl" style={{ backgroundColor: "#e8eaf6", border: "1px solid #c5cae9" }}>
                        <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#1a237e" }} />
                        <p className="text-xs leading-relaxed" style={{ color: "#1a237e" }}>
                            <strong>Conseil&nbsp;:</strong> Pour que votre nouvelle demande soit liée à ce compte,
                            utilisez <strong>exactement la même adresse email</strong> que celle de ce compte lors de la soumission.
                        </p>
                    </div>

                    {/* CTA */}
                    <a
                        href="/demande-certification"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                        style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                    >
                        <Award className="h-4 w-4" />
                        Accéder au formulaire de demande
                        <ArrowRight className="h-4 w-4" />
                    </a>
                </div>
            </div>

            {/* ── Certifications disponibles ── */}
            {available.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between" style={{ backgroundColor: "#f8f9ff" }}>
                        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                            Certifications disponibles
                        </h2>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: "#1a237e" }}>
                            {available.length}
                        </span>
                    </div>
                    <ul className="divide-y divide-gray-50">
                        {available.map(cert => (
                            <li key={cert} className="px-5 py-3 flex items-center gap-3">
                                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "#2e7d32" }} />
                                <span className="text-sm text-gray-700 font-medium flex-1">{cert}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* ── Certifications déjà demandées ── */}
            {existingCerts.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100" style={{ backgroundColor: "#f8f9ff" }}>
                        <h2 className="text-sm font-black uppercase tracking-widest" style={{ color: "#1a237e" }}>
                            Vos certifications actuelles
                        </h2>
                    </div>
                    <ul className="divide-y divide-gray-50">
                        {existingCerts.map(cert => (
                            <li key={cert} className="px-5 py-3 flex items-center gap-3">
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                                <span className="text-sm text-gray-700 font-medium flex-1">{cert}</span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">En cours</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </motion.div>
    );
}
