"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";

import { candidateChangePassword, setCandidateToken } from "@/lib/api";

export default function CandidateChangePasswordPage() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (newPassword !== confirmPassword) {
            setError("Les nouveaux mots de passe ne correspondent pas.");
            return;
        }
        if (newPassword.length < 6) {
            setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        try {
            setLoading(true);
            const { access_token } = await candidateChangePassword(currentPassword, newPassword);
            setCandidateToken(access_token);
            setSuccess(true);
            setTimeout(() => router.replace("/candidat"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Échec du changement de mot de passe");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f4f6f9" }}>
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-md"
            >
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ border: "2px solid #e8eaf6" }}>
                    <div
                        className="px-6 py-5 flex items-center gap-3"
                        style={{ backgroundColor: "#1a237e", borderBottom: "3px solid #2e7d32" }}
                    >
                        <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                            <Image src="/logo.png" alt="IRISQ" width={32} height={32} className="object-contain" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">IRISQ Certifications</p>
                            <h1 className="text-lg font-black text-white">Changer le mot de passe</h1>
                        </div>
                    </div>

                    {success ? (
                        <div className="p-8 text-center">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: "#2e7d32" }} />
                            <p className="font-bold text-gray-800">Mot de passe mis à jour !</p>
                            <p className="text-sm text-gray-500 mt-1">Redirection…</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> Mot de passe actuel
                                </label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="••••••"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> Nouveau mot de passe (min 6 caractères)
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="••••••"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> Confirmer le nouveau mot de passe
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="••••••"
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                {loading ? "Modification…" : "Changer le mot de passe"}
                            </button>
                        </form>
                    )}

                    <div className="px-6 pb-6 text-center">
                        <Link href="/candidat" className="text-xs text-gray-400 hover:text-gray-600">
                            ← Retour au tableau de bord
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
