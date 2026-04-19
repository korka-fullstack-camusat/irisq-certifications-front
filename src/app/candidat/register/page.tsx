"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
    Loader2,
    UserPlus,
    Mail,
    KeyRound,
    User,
    Phone,
    Briefcase,
    Calendar,
    CheckCircle2,
} from "lucide-react";

import { candidateRegister, setCandidateToken, getCandidateToken } from "@/lib/api";

export default function CandidateRegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
        passwordConfirm: "",
        first_name: "",
        last_name: "",
        phone: "",
        profile: "",
        date_of_birth: "",
    });

    useEffect(() => {
        if (getCandidateToken()) router.replace("/candidat");
    }, [router]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (form.password !== form.passwordConfirm) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }
        if (form.password.length < 6) {
            setError("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        try {
            setLoading(true);
            await candidateRegister({
                email: form.email.trim(),
                password: form.password,
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                phone: form.phone.trim() || undefined,
                profile: form.profile.trim() || undefined,
                date_of_birth: form.date_of_birth || undefined,
            });
            setSuccess(true);
            setTimeout(() => router.replace("/candidat/login"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de la création du compte");
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#f4f6f9" }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-lg p-10 text-center max-w-sm w-full"
                    style={{ border: "2px solid #e8eaf6" }}
                >
                    <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
                    <h2 className="text-xl font-black" style={{ color: "#1a237e" }}>Compte créé !</h2>
                    <p className="text-sm text-gray-500 mt-2">Vous allez être redirigé(e) vers la connexion…</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ backgroundColor: "#f4f6f9" }}>
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-lg"
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
                            <h1 className="text-lg font-black text-white">Créer mon compte candidat</h1>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        <p className="text-sm text-gray-500">
                            Créez votre compte pour accéder aux certifications disponibles et suivre vos candidatures.
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <User className="h-3 w-3" /> Prénom *
                                </label>
                                <input
                                    type="text"
                                    name="first_name"
                                    value={form.first_name}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Amadou"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <User className="h-3 w-3" /> Nom *
                                </label>
                                <input
                                    type="text"
                                    name="last_name"
                                    value={form.last_name}
                                    onChange={handleChange}
                                    required
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Diallo"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" /> Adresse email *
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                autoComplete="email"
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="amadou.diallo@email.com"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                <Phone className="h-3 w-3" /> Téléphone
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                placeholder="+224 XXX XXX XXX"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <Briefcase className="h-3 w-3" /> Profil / Poste
                                </label>
                                <input
                                    type="text"
                                    name="profile"
                                    value={form.profile}
                                    onChange={handleChange}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                    placeholder="Exécutant Travaux"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                    <Calendar className="h-3 w-3" /> Date de naissance
                                </label>
                                <input
                                    type="date"
                                    name="date_of_birth"
                                    value={form.date_of_birth}
                                    onChange={handleChange}
                                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Sécurité</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                        <KeyRound className="h-3 w-3" /> Mot de passe *
                                    </label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={form.password}
                                        onChange={handleChange}
                                        required
                                        autoComplete="new-password"
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        placeholder="Minimum 6 caractères"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500 inline-flex items-center gap-1">
                                        <KeyRound className="h-3 w-3" /> Confirmer le mot de passe *
                                    </label>
                                    <input
                                        type="password"
                                        name="passwordConfirm"
                                        value={form.passwordConfirm}
                                        onChange={handleChange}
                                        required
                                        autoComplete="new-password"
                                        className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        placeholder="Répéter le mot de passe"
                                    />
                                </div>
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
                            style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.25)" }}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            {loading ? "Création du compte…" : "Créer mon compte"}
                        </button>
                    </form>

                    <div className="px-6 pb-6 text-center space-y-2">
                        <p className="text-sm text-gray-500">
                            Déjà un compte ?{" "}
                            <Link href="/candidat/login" className="font-bold text-indigo-600 hover:underline">
                                Se connecter
                            </Link>
                        </p>
                        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
                            ← Retour à l&apos;accueil
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
