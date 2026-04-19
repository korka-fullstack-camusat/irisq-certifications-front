"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    GraduationCap,
    ArrowRight,
    Loader2,
    ShieldCheck,
    Users,
    AlertCircle,
} from "lucide-react";

import { fetchPublicCertifications, type PublicCertification } from "@/lib/api";
import { useCandidate } from "@/lib/candidate-context";

export default function CertificationsPage() {
    const { account } = useCandidate();
    const [certifications, setCertifications] = useState<PublicCertification[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchPublicCertifications()
            .then(setCertifications)
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    // IDs de certifications où le candidat a déjà postulé (status != rejected)
    const appliedFormIds = new Set(
        (account?.dossiers || [])
            .filter(d => d.status !== "rejected")
            .map(d => d.form_id)
            .filter(Boolean) as string[]
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>Certifications disponibles</h1>
                    <p className="text-sm text-gray-500 mt-1">Sélectionnez une certification pour candidater.</p>
                </div>
                <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: "#e8eaf6" }}
                >
                    <GraduationCap className="h-5 w-5" style={{ color: "#1a237e" }} />
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
            )}

            {error && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    {error}
                </div>
            )}

            {!loading && !error && certifications.length === 0 && (
                <div className="text-center py-16">
                    <ShieldCheck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Aucune certification disponible pour le moment.</p>
                    <p className="text-xs text-gray-400 mt-1">Revenez plus tard ou contactez l’administration.</p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                {certifications.map((cert, i) => {
                    const alreadyApplied = appliedFormIds.has(cert._id);
                    return (
                        <motion.div
                            key={cert._id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: i * 0.05 }}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                        >
                            <div className="p-5">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: "#e8eaf6" }}
                                    >
                                        <ShieldCheck className="h-5 w-5" style={{ color: "#1a237e" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h2 className="font-black text-gray-900 leading-tight">{cert.title}</h2>
                                        {cert.description && (
                                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cert.description}</p>
                                        )}
                                        {cert.responses_count !== undefined && (
                                            <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-gray-400">
                                                <Users className="h-3 w-3" />
                                                {cert.responses_count} candidature{cert.responses_count !== 1 ? "s" : ""}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4">
                                    {alreadyApplied ? (
                                        <div
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
                                            style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}
                                        >
                                            <ShieldCheck className="h-3.5 w-3.5" />
                                            Candidature en cours
                                        </div>
                                    ) : (
                                        <Link
                                            href={`/candidat/candidater/${cert._id}`}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:-translate-y-0.5"
                                            style={{
                                                backgroundColor: "#1a237e",
                                                boxShadow: "0 4px 12px rgba(26,35,126,0.2)",
                                            }}
                                        >
                                            Candidater <ArrowRight className="h-3.5 w-3.5" />
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
