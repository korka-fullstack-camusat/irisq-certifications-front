"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, KeyRound, Fingerprint, Mail, MailCheck, ArrowLeft } from "lucide-react";

import { candidateForgotPassword } from "@/lib/api";

export default function CandidateForgotPasswordPage() {
    const [publicId, setPublicId] = useState("");
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [confirmation, setConfirmation] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setConfirmation(null);
        try {
            setLoading(true);
            const { message } = await candidateForgotPassword(publicId.trim(), email.trim());
            setConfirmation(message);
            setPublicId("");
            setEmail("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de la demande");
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
                            <h1 className="text-lg font-black text-white">Mot de passe oublié</h1>
                        </div>
                    </div>

                    {confirmation ? (
                        <div className="p-6 space-y-4">
                            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm inline-flex items-start gap-2">
                                <MailCheck className="h-5 w-5 mt-0.5 shrink-0" />
                                <div>
                                    <p className="font-bold mb-1">Demande prise en compte</p>
                                    <p>{confirmation}</p>
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Vérifiez votre boîte mail (et vos spams). Dès que vous avez le nouveau mot de passe provisoire,
                                connectez-vous à votre espace candidat — vous serez invité(e) à le modifier immédiatement.
                            </p>
                            <div className="flex flex-col gap-2 pt-2">
                                <Link
                                    href="/candidat/login"
                                    className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                                >
                                    Retour à la connexion
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => setConfirmation(null)}
                                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-gray-500 hover:text-gray-700"
                                >
                                    Envoyer une nouvelle demande
                                </button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <p className="text-sm text-gray-600">
                                Saisissez votre <strong>ID Public</strong> et l&apos;<strong>email</strong> utilisé lors de votre inscription.
                                Un nouveau mot de passe provisoire vous sera envoyé par email.
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
                                    placeholder="IC24D01-0001"
                                />
                            </div>

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
                                    placeholder="vous@exemple.com"
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
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                                {loading ? "Envoi en cours…" : "Réinitialiser mon mot de passe"}
                            </button>
                        </form>
                    )}

                    <div className="px-6 pb-6 text-center">
                        <Link
                            href="/candidat/login"
                            className="text-xs text-gray-400 hover:text-gray-600 inline-flex items-center gap-1"
                        >
                            <ArrowLeft className="h-3 w-3" />
                            Retour à la connexion
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
