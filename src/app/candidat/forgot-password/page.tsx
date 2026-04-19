"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

import { candidateForgotPassword } from "@/lib/api";

export default function CandidateForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        try {
            setLoading(true);
            const { message } = await candidateForgotPassword(email.trim());
            setMessage(message);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur");
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
                            <h1 className="text-lg font-black text-white">Mot de passe oublié</h1>
                        </div>
                    </div>

                    {message ? (
                        <div className="p-8 text-center">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: "#2e7d32" }} />
                            <p className="text-sm text-gray-700">{message}</p>
                            <Link
                                href="/candidat/login"
                                className="mt-6 inline-block text-sm font-bold hover:underline"
                                style={{ color: "#1a237e" }}
                            >
                                Retour à la connexion
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Saisissez votre <strong>adresse email</strong>. Si un compte existe, vous recevrez un nouveau mot de passe provisoire.
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

                            {error && (
                                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50"
                                style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                                {loading ? "Envoi en cours…" : "Envoyer le mot de passe"}
                            </button>
                        </form>
                    )}

                    <div className="px-6 pb-6 text-center">
                        <Link href="/candidat/login" className="text-xs text-gray-400 hover:text-gray-600">
                            ← Retour à la connexion
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
