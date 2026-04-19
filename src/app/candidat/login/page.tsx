"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, KeyRound, ShieldCheck, Mail } from "lucide-react";

import { candidateLogin, setCandidateToken, getCandidateToken } from "@/lib/api";

export default function CandidateLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (getCandidateToken()) router.replace("/candidat");
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        try {
            setLoading(true);
            const { access_token } = await candidateLogin(email.trim(), password);
            setCandidateToken(access_token);
            router.replace("/candidat");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur de connexion");
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
                                IRISQ Certifications
                            </p>
                            <h1 className="text-lg font-black text-white">Espace candidat</h1>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <p className="text-sm text-gray-600">
                            Connectez-vous avec votre <strong>email</strong> et votre <strong>mot de passe</strong>.
                        </p>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="jean.dupont@email.com"
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
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="••••••••"
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
                            {loading ? "Connexion…" : "Se connecter"}
                        </button>
                    </form>

                    <div className="px-6 pb-6 space-y-3 text-center">
                        <p className="text-sm text-gray-500">
                            Pas encore de compte ?{" "}
                            <Link href="/candidat/register" className="font-bold hover:underline" style={{ color: "#2e7d32" }}>
                                Créer un compte
                            </Link>
                        </p>
                        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 block">
                            ← Retour à l&apos;accueil
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
