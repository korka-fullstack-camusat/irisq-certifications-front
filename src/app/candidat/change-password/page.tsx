"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, KeyRound, ShieldCheck, Eye, EyeOff } from "lucide-react";

import {
    candidateChangePassword,
    setCandidateToken,
    getCandidateToken,
    clearCandidateToken,
} from "@/lib/api";

export default function CandidateChangePasswordPage() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNew, setShowNew] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!getCandidateToken()) router.replace("/candidat/login");
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (newPassword.length < 6) {
            setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Les deux mots de passe ne correspondent pas.");
            return;
        }

        try {
            setLoading(true);
            const { access_token } = await candidateChangePassword(currentPassword, newPassword);
            setCandidateToken(access_token);
            clearCandidateToken();
            router.replace("/candidat/login");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors du changement");
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
                            <p className="text-[10px] font-bold tracking-[0.2em] text-white/70 uppercase">
                                Première connexion
                            </p>
                            <h1 className="text-lg font-black text-white">Changer votre mot de passe</h1>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs leading-relaxed">
                            Pour sécuriser votre espace, merci de remplacer le mot de passe provisoire envoyé par email par un mot de passe personnel.
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <KeyRound className="h-3 w-3" /> Mot de passe provisoire
                            </label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="Reçu par email"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <KeyRound className="h-3 w-3" /> Nouveau mot de passe
                            </label>
                            <div className="relative">
                                <input
                                    type={showNew ? "text" : "password"}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    autoComplete="new-password"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-11 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Au moins 6 caractères"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNew(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 text-gray-400 hover:text-gray-600"
                                    tabIndex={-1}
                                >
                                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <KeyRound className="h-3 w-3" /> Confirmer le nouveau
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                autoComplete="new-password"
                                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="Ressaisir le mot de passe"
                            />
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                            style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            {loading ? "Mise à jour…" : "Valider et se reconnecter"}
                        </button>

                        <p className="text-[11px] text-gray-400 text-center">
                            Après validation, vous serez redirigé(e) vers l&apos;écran de connexion pour vous identifier avec votre nouveau mot de passe.
                        </p>
                    </form>
                </div>
            </motion.div>
        </div>
    );
}
