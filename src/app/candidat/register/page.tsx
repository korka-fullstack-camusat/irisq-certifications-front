"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Loader2, UserPlus, User, ShieldCheck, Eye, EyeOff } from "lucide-react";

import {
    registerCandidateAccount,
    setCandidateAccountToken,
    getCandidateAccountToken,
} from "@/lib/api";

function inputClass() {
    return "w-full bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2e7d32] transition-all";
}
function labelClass() {
    return "block text-xs font-bold uppercase tracking-widest mb-1.5";
}

export default function CandidateRegisterPage() {
    const router = useRouter();
    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [dateNaissance, setDateNaissance] = useState("");
    const [lieuNaissance, setLieuNaissance] = useState("");
    const [nationalite, setNationalite] = useState("");
    const [telephone, setTelephone] = useState("");
    const [email, setEmail] = useState("");
    const [anneesExperience, setAnneesExperience] = useState("");
    const [adresse, setAdresse] = useState("");
    const [password, setPassword] = useState("");
    const [passwordConfirm, setPasswordConfirm] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (getCandidateAccountToken()) router.replace("/candidat");
    }, [router]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (password !== passwordConfirm) {
            setError("Les mots de passe ne correspondent pas.");
            return;
        }
        if (password.length < 6) {
            setError("Le mot de passe doit contenir au moins 6 caractères.");
            return;
        }

        try {
            setLoading(true);
            const { access_token } = await registerCandidateAccount({
                nom: nom.trim(),
                prenom: prenom.trim(),
                date_naissance: dateNaissance,
                lieu_naissance: lieuNaissance.trim() || undefined,
                nationalite: nationalite.trim() || undefined,
                telephone: telephone.trim(),
                email: email.trim(),
                annees_experience: anneesExperience.trim(),
                adresse: adresse.trim() || undefined,
                password,
                password_confirm: passwordConfirm,
            });
            setCandidateAccountToken(access_token);
            router.replace("/candidat");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Échec de l'inscription");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen py-10 px-4" style={{ backgroundColor: "#f4f6f9" }}>
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex flex-col items-center text-center gap-2">
                    <div className="w-24 h-24 flex items-center justify-center drop-shadow-xl">
                        <Image src="/logo.png" alt="IRISQ" width={96} height={96} className="object-contain" priority />
                    </div>
                    <span className="text-[11px] font-extrabold tracking-[0.22em] uppercase" style={{ color: "#1a237e" }}>
                        IRISQ-CERTIFICATIONS
                    </span>
                    <h1 className="text-xl font-extrabold tracking-tight mt-1" style={{ color: "#1a237e" }}>
                        Créer mon compte candidat
                    </h1>
                    <p className="text-sm text-gray-500 max-w-lg">
                        Créez votre compte pour accéder à votre espace personnel et postuler aux certifications IRISQ.
                    </p>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35 }}
                    className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                    style={{ borderColor: "#e8eaf6" }}
                >
                    <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "#1a237e" }}>
                        <User className="h-4 w-4 text-white/80" />
                        <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                            Étape 1 — Identité &amp; Contact
                        </h2>
                        <span className="ml-auto text-white/40 text-xs">1 / 1</span>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Nom <span className="text-[#c62828]">*</span></label>
                                <input type="text" value={nom} onChange={e => setNom(e.target.value)} required className={inputClass()} placeholder="Dupont" />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Prénom <span className="text-[#c62828]">*</span></label>
                                <input type="text" value={prenom} onChange={e => setPrenom(e.target.value)} required className={inputClass()} placeholder="Jean" />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Date de naissance <span className="text-[#c62828]">*</span></label>
                                <input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} required className={inputClass()} />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Lieu de naissance</label>
                                <input type="text" value={lieuNaissance} onChange={e => setLieuNaissance(e.target.value)} className={inputClass()} placeholder="Dakar" />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Nationalité</label>
                                <input type="text" value={nationalite} onChange={e => setNationalite(e.target.value)} className={inputClass()} placeholder="Sénégalaise" />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Téléphone <span className="text-[#c62828]">*</span></label>
                                <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} required className={inputClass()} placeholder="70 123 45 67" />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>E-mail <span className="text-[#c62828]">*</span></label>
                                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" className={inputClass()} placeholder="vous@exemple.com" />
                            </div>
                            <div>
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Années d&apos;expérience <span className="text-[#c62828]">*</span></label>
                                <input type="number" min="0" value={anneesExperience} onChange={e => setAnneesExperience(e.target.value)} required className={inputClass()} placeholder="ex: 3" />
                                <p className="text-[11px] text-gray-400 mt-1">Années de mise en œuvre de la norme demandée</p>
                            </div>
                            <div className="sm:col-span-2">
                                <label className={labelClass()} style={{ color: "#1a237e" }}>Adresse</label>
                                <textarea
                                    value={adresse}
                                    onChange={e => setAdresse(e.target.value)}
                                    className={inputClass() + " resize-none"}
                                    rows={2}
                                    placeholder="Rue, Ville, Pays"
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t" style={{ borderColor: "#e8eaf6" }}>
                            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                Sécurité du compte
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div>
                                    <label className={labelClass()} style={{ color: "#1a237e" }}>Mot de passe <span className="text-[#c62828]">*</span></label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                            minLength={6}
                                            autoComplete="new-password"
                                            className={inputClass()}
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(v => !v)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-gray-400 mt-1">6 caractères minimum</p>
                                </div>
                                <div>
                                    <label className={labelClass()} style={{ color: "#1a237e" }}>Confirmation du mot de passe <span className="text-[#c62828]">*</span></label>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={passwordConfirm}
                                        onChange={e => setPasswordConfirm(e.target.value)}
                                        required
                                        minLength={6}
                                        autoComplete="new-password"
                                        className={inputClass()}
                                        placeholder="••••••••"
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-4 pt-2">
                            <Link href="/candidat/login" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                                ← J&apos;ai déjà un compte
                            </Link>
                            <button
                                type="submit"
                                disabled={loading}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.28)" }}
                            >
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                {loading ? "Création…" : "Créer mon compte"}
                            </button>
                        </div>
                    </form>
                </motion.div>

                <div className="text-center">
                    <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
                        ← Retour à l&apos;accueil
                    </Link>
                </div>
            </div>
        </div>
    );
}
