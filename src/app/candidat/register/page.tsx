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
    Lock,
    User,
    Phone,
    Building2,
    Globe,
    ChevronRight,
    CheckCircle2,
} from "lucide-react";

import { candidateRegister, getCandidateToken } from "@/lib/api";

const PROFILES = [
    "Salarié(e)",
    "Indépendant(e) / Freelance",
    "Demandeur(se) d'emploi",
    "Employé(e) public",
    "Autre",
];

export default function CandidateRegisterPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [form, setForm] = useState({
        email: "",
        password: "",
        confirmPassword: "",
        first_name: "",
        last_name: "",
        phone: "",
        date_of_birth: "",
        address: "",
        profile: "",
        company: "",
        nationality: "",
    });

    useEffect(() => {
        if (getCandidateToken()) router.replace("/candidat");
    }, [router]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (form.password !== form.confirmPassword) {
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
                email: form.email,
                password: form.password,
                first_name: form.first_name,
                last_name: form.last_name,
                phone: form.phone || undefined,
                date_of_birth: form.date_of_birth || undefined,
                address: form.address || undefined,
                profile: form.profile || undefined,
                company: form.company || undefined,
                nationality: form.nationality || undefined,
            });
            setSuccess(true);
            setTimeout(() => router.replace("/candidat/login"), 2000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur lors de la création du compte");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ backgroundColor: "#f4f6f9" }}>
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="w-full max-w-2xl"
            >
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ border: "2px solid #e8eaf6" }}>
                    {/* Header */}
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
                            <h1 className="text-lg font-black text-white">Créer un compte</h1>
                        </div>
                    </div>

                    {success ? (
                        <div className="p-10 text-center">
                            <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: "#2e7d32" }} />
                            <h2 className="text-xl font-black" style={{ color: "#1a237e" }}>Compte créé avec succès !</h2>
                            <p className="text-sm text-gray-500 mt-2">Redirection vers la connexion…</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            <p className="text-sm text-gray-600">
                                Créez votre compte pour accéder aux certifications et suivre vos candidatures.
                            </p>

                            {/* Identité */}
                            <fieldset>
                                <legend className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                    Identité
                                </legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <User className="h-3 w-3" /> Prénom *
                                        </label>
                                        <input
                                            type="text" name="first_name" value={form.first_name}
                                            onChange={handleChange} required
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Jean"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <User className="h-3 w-3" /> Nom *
                                        </label>
                                        <input
                                            type="text" name="last_name" value={form.last_name}
                                            onChange={handleChange} required
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Dupont"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <Phone className="h-3 w-3" /> Téléphone
                                        </label>
                                        <input
                                            type="tel" name="phone" value={form.phone}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="+33 6 12 34 56 78"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                                            Date de naissance
                                        </label>
                                        <input
                                            type="date" name="date_of_birth" value={form.date_of_birth}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <Globe className="h-3 w-3" /> Nationalité
                                        </label>
                                        <input
                                            type="text" name="nationality" value={form.nationality}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Française"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                                            Profil
                                        </label>
                                        <select
                                            name="profile" value={form.profile}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                                        >
                                            <option value="">Sélectionner…</option>
                                            {PROFILES.map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <Building2 className="h-3 w-3" /> Entreprise / Organisme
                                        </label>
                                        <input
                                            type="text" name="company" value={form.company}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Nom de l'entreprise"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1 block">
                                            Adresse
                                        </label>
                                        <input
                                            type="text" name="address" value={form.address}
                                            onChange={handleChange}
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="Ville, Pays"
                                        />
                                    </div>
                                </div>
                            </fieldset>

                            {/* Accès */}
                            <fieldset>
                                <legend className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                    Accès au compte
                                </legend>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="sm:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <Mail className="h-3 w-3" /> Email *
                                        </label>
                                        <input
                                            type="email" name="email" value={form.email}
                                            onChange={handleChange} required
                                            autoComplete="email"
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="jean.dupont@email.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <Lock className="h-3 w-3" /> Mot de passe * (min 6 caractères)
                                        </label>
                                        <input
                                            type="password" name="password" value={form.password}
                                            onChange={handleChange} required
                                            autoComplete="new-password"
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="••••••"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1 mb-1">
                                            <Lock className="h-3 w-3" /> Confirmer le mot de passe *
                                        </label>
                                        <input
                                            type="password" name="confirmPassword" value={form.confirmPassword}
                                            onChange={handleChange} required
                                            autoComplete="new-password"
                                            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                                            placeholder="••••••"
                                        />
                                    </div>
                                </div>
                            </fieldset>

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
                                {loading ? "Création en cours…" : "Créer mon compte"}
                            </button>

                            <div className="flex items-center gap-3">
                                <div className="flex-1 h-px bg-gray-200" />
                                <ChevronRight className="h-3 w-3 text-gray-400" />
                                <div className="flex-1 h-px bg-gray-200" />
                            </div>

                            <p className="text-center text-sm text-gray-500">
                                Déjà un compte ?{" "}
                                <Link href="/candidat/login" className="font-bold hover:underline" style={{ color: "#1a237e" }}>
                                    Se connecter
                                </Link>
                            </p>
                        </form>
                    )}

                    <div className="px-6 pb-5 text-center">
                        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600">
                            ← Retour à l&apos;accueil
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
