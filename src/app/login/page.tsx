"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Mail, Lock, Loader2 } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const formData = new URLSearchParams();
            formData.append('username', email);
            formData.append('password', password);

            const res = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: formData
            });

            if (!res.ok) {
                throw new Error("Identifiants incorrects");
            }

            const data = await res.json();

            // Fetch user profile using token
            const profileRes = await fetch(`${API_URL}/me`, {
                headers: {
                    "Authorization": `Bearer ${data.access_token}`
                }
            });

            if (!profileRes.ok) {
                throw new Error("Impossible de récupérer le profil");
            }

            const userData = await profileRes.json();
            login(data.access_token, userData);
        } catch (err: any) {
            setError(err.message || "Erreur de connexion");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen flex items-center justify-center bg-[#f4f6f9] overflow-hidden font-sans p-4">

            {/* Décoration fond — formes subtiles aux couleurs du logo */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Grand cercle vert bas-gauche */}
                <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full opacity-10" style={{ backgroundColor: "#2e7d32" }} />
                {/* Cercle bleu marine haut-droite */}
                <div className="absolute -top-24 -right-24 w-[340px] h-[340px] rounded-full opacity-10" style={{ backgroundColor: "#1a237e" }} />
                {/* Losange rouge accent */}
                <div className="absolute top-1/2 left-8 w-6 h-6 rotate-45 opacity-20" style={{ backgroundColor: "#c62828" }} />
                <div className="absolute bottom-24 right-16 w-4 h-4 rotate-45 opacity-15" style={{ backgroundColor: "#c62828" }} />
                {/* Ligne décorative fine verte */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: "#2e7d32" }} />
            </div>

            {/* Lien retour */}
            <Link
                href="/"
                className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm font-medium transition-colors group"
                style={{ color: "#1a237e" }}
            >
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                <span>Retour à l'accueil</span>
            </Link>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="relative z-10 w-full max-w-md"
            >
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">

                    {/* Bandeau header coloré */}
                    <div className="px-8 pt-8 pb-6 text-center" style={{ background: "linear-gradient(135deg, #1a237e 0%, #283593 60%, #2e7d32 100%)" }}>
                        {/* Logo encerclé — style du logo IRISQ */}
                        <div className="flex justify-center mb-4">
                            <div className="w-20 h-20 rounded-full bg-white shadow-xl flex items-center justify-center p-1.5" style={{ border: "3px solid #2e7d32" }}>
                                <Image
                                    src="/logo.png"
                                    alt="IRISQ Logo"
                                    width={68}
                                    height={68}
                                    className="object-contain w-full h-full"
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="text-xl font-extrabold tracking-[0.18em] uppercase text-white">
                            IRISQ-CERTIFICATIONS
                        </h1>
                        <p className="text-white/60 text-xs mt-1 tracking-wider uppercase">
                            Institut des Risques &amp; de la Qualité
                        </p>
                    </div>

                    {/* Séparateur avec losange */}
                    <div className="flex items-center justify-center -mt-3 mb-1 z-10 relative">
                        <div className="h-6 w-6 rotate-45 bg-white shadow-md border" style={{ borderColor: "#2e7d32" }}>
                            <div className="w-full h-full flex items-center justify-center -rotate-45">
                                <div className="w-2 h-2 rotate-45" style={{ backgroundColor: "#c62828" }} />
                            </div>
                        </div>
                    </div>

                    {/* Formulaire */}
                    <div className="px-8 pt-4 pb-8">
                        <h2 className="text-lg font-bold text-center mb-1" style={{ color: "#1a237e" }}>
                            Connexion à votre espace
                        </h2>
                        <p className="text-gray-400 text-center text-xs mb-6">
                            Gérez vos formations, apprenants et certifications
                        </p>

                        {error && (
                            <div className="mb-5 p-3 rounded-xl bg-rose-50 text-rose-600 text-sm font-medium border border-rose-100 text-center">
                                {error}
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleLogin}>
                            {/* Email */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-widest ml-1" style={{ color: "#1a237e" }}>
                                    Adresse Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#2e7d32" }} />
                                    <input
                                        type="email"
                                        placeholder="vous@entreprise.com"
                                        className="w-full bg-[#f4f6f9] border rounded-xl px-10 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none transition-all"
                                        style={{ borderColor: "#e0e0e0" }}
                                        onFocus={e => e.target.style.borderColor = "#2e7d32"}
                                        onBlur={e => e.target.style.borderColor = "#e0e0e0"}
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Mot de passe */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between ml-1">
                                    <label className="text-xs font-bold uppercase tracking-widest" style={{ color: "#1a237e" }}>
                                        Mot de passe
                                    </label>
                                    <a href="#" className="text-xs font-medium hover:underline transition-colors" style={{ color: "#2e7d32" }}>
                                        Mot de passe oublié ?
                                    </a>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#2e7d32" }} />
                                    <input
                                        type="password"
                                        placeholder="••••••••"
                                        className="w-full bg-[#f4f6f9] border rounded-xl px-10 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none transition-all"
                                        style={{ borderColor: "#e0e0e0" }}
                                        onFocus={e => e.target.style.borderColor = "#2e7d32"}
                                        onBlur={e => e.target.style.borderColor = "#e0e0e0"}
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Bouton Se connecter */}
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex items-center justify-center gap-2 h-12 mt-2 rounded-xl text-white font-bold text-sm tracking-wide shadow-lg hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-70 disabled:hover:translate-y-0"
                                style={{
                                    backgroundColor: "#2e7d32",
                                    boxShadow: "0 8px 20px rgba(46,125,50,0.30)",
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Connexion en cours...</span>
                                    </>
                                ) : (
                                    <span>Se connecter</span>
                                )}
                            </button>
                        </form>

                        {/* Zone Informations de Test */}
                        <div className="mt-8 p-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
                            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "#2e7d32" }}></span>
                                Identifiants de test
                            </h3>

                            <div className="space-y-3">
                                {/* Admin */}
                                <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => { setEmail('admin@irisq.sn'); setPassword('password123'); }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-slate-700">1. Administrateur / RH (Accès global)</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium w-24">Email :</span>
                                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">admin@irisq.sn</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium w-24">Mot de passe :</span>
                                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">password123</code>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 mt-1">
                                            <span className="italic">Redirection vers <code className="px-1 bg-slate-100 rounded">/dashboard</code></span>
                                        </div>
                                    </div>
                                </div>

                                {/* Evaluateur */}
                                <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => { setEmail('evaluateur@irisq.sn'); setPassword('jury123'); }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-slate-700">2. Évaluateur / Jury (Validation des dossiers)</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium w-24">Email :</span>
                                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">evaluateur@irisq.sn</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium w-24">Mot de passe :</span>
                                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">jury123</code>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 mt-1">
                                            <span className="italic">Redirection vers <code className="px-1 bg-slate-100 rounded">/evaluateur</code></span>
                                        </div>
                                    </div>
                                </div>

                                {/* Correcteur */}
                                <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm cursor-pointer hover:border-green-300 transition-colors" onClick={() => { setEmail('correcteur@irisq.sn'); setPassword('exam123'); }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-bold text-slate-700">3. Correcteur (Notation des examens anonymes)</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium w-24">Email :</span>
                                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">correcteur@irisq.sn</code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium w-24">Mot de passe :</span>
                                            <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">exam123</code>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-500 mt-1">
                                            <span className="italic">Redirection vers <code className="px-1 bg-slate-100 rounded">/correcteur</code></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Footer strip vert */}
                    <div className="h-1.5 w-full" style={{ backgroundColor: "#2e7d32" }} />
                </div>

                <p className="text-center text-xs text-gray-400 mt-4">
                    © {new Date().getFullYear()} IRISQ — Institut des Risques &amp; de la Qualité
                </p>
            </motion.div>
        </div>
    );
}