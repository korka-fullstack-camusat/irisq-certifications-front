"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, KeyRound, ShieldCheck, Fingerprint, Eye, EyeOff, MonitorSmartphone } from "lucide-react";

import { candidateLogin, setCandidateToken, getCandidateToken } from "@/lib/api";

// Composant séparé pour useSearchParams (requis par Next.js pour le Suspense boundary)
function AutreAppareilBanner() {
    const searchParams = useSearchParams();
    if (searchParams.get("reason") !== "autre_appareil") return null;
    return (
        <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3 rounded-xl text-sm"
            style={{ backgroundColor: "#fff8e1", border: "1px solid #ffe082" }}
        >
            <MonitorSmartphone className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
            <p style={{ color: "#7c4d00" }}>
                <strong>Session fermée.</strong> Votre compte a été connecté sur un autre appareil.
                Reconnectez-vous pour reprendre.
            </p>
        </motion.div>
    );
}

export default function CandidateLoginPage() {
    const router = useRouter();

    const [publicId, setPublicId] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Déjà connecté → redirection complète pour forcer des données fraîches
        if (getCandidateToken()) window.location.href = "/candidat";
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        try {
            setLoading(true);
            const { access_token, must_change_password } = await candidateLogin(publicId.trim(), password);
            setCandidateToken(access_token);

            // Vider le sessionStorage (état examen, etc.) pour repartir sur une
            // base propre et voir les dernières mises à jour de la plateforme.
            if (typeof sessionStorage !== "undefined") sessionStorage.clear();

            // Navigation complète (pas router.replace) pour vider le cache Next.js
            // et garantir que toutes les données sont fraîches depuis le serveur.
            window.location.href = must_change_password
                ? "/candidat/change-password"
                : "/candidat";
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur de connexion");
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
                                IRISQ Certifications
                            </p>
                            <h1 className="text-lg font-black text-white">Espace candidat</h1>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <Suspense fallback={null}>
                            <AutreAppareilBanner />
                        </Suspense>

                        <p className="text-sm text-gray-600">
                            Connectez-vous avec votre <strong>ID Public</strong> et le <strong>mot de passe</strong> reçus par email lors de votre inscription.
                        </p>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <Fingerprint className="h-3 w-3" /> ID Public
                            </label>
                            <input
                                type="text"
                                value={publicId}
                                onChange={e => setPublicId(e.target.value)}
                                required
                                autoComplete="username"
                                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="IC26D01P-0001"
                            />
                        </div>

                        <div>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <KeyRound className="h-3 w-3" /> Mot de passe
                                </label>
                                <Link
                                    href="/candidat/forgot-password"
                                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    Mot de passe oublié ?
                                </Link>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                    className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 pr-11 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(v => !v)}
                                    tabIndex={-1}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 mt-1 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
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
                            {loading ? "Connexion…" : "Se connecter"}
                        </button>
                    </form>

                    <div className="px-6 pb-6 text-center">
                        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
                            ← Retour à l&apos;accueil
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
