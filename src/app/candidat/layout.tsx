"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, X, MonitorSmartphone, Home, Award, FileText, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { CandidateProvider, useCandidate } from "@/lib/candidate-context";

const AUTH_PATHS = new Set([
    "/candidat/login",
    "/candidat/register",
    "/candidat/change-password",
    "/candidat/forgot-password",
]);

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    if (AUTH_PATHS.has(pathname)) {
        return <>{children}</>;
    }

    return (
        <CandidateProvider>
            <Shell>{children}</Shell>
        </CandidateProvider>
    );
}

// ── Navigation items ──────────────────────────────────────────────────────
const NAV_ITEMS = [
    { href: "/candidat",               label: "Accueil",        icon: Home   },
    { href: "/candidat/certifications",label: "Certifications", icon: Award  },
    { href: "/candidat/documents",     label: "Documents",      icon: FileText },
    { href: "/candidat/examen",        label: "Examen",         icon: BookOpen },
];

function Shell({ children }: { children: React.ReactNode }) {
    const { dossier, logout, examActive, sessionInvalidated, confirmSessionLogout } = useCandidate();
    const pathname = usePathname();
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const initials    = (dossier?.name || dossier?.public_id || "??").substring(0, 2).toUpperCase();
    const displayName = dossier?.name || dossier?.public_id || "Candidat";

    // Nav active : match exact pour "/" et prefix pour les autres
    const isActive = (href: string) =>
        href === "/candidat" ? pathname === "/candidat" : pathname.startsWith(href);

    return (
        <div className={`flex min-h-screen font-sans${examActive ? " overflow-hidden" : ""}`} style={{ backgroundColor: "#f4f6f9" }}>

            {/* ── Modal déconnexion ── */}
            <AnimatePresence>
                {showLogoutModal && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowLogoutModal(false)}
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.92, y: 16 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 16 }}
                            transition={{ duration: 0.22 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                        >
                            <div
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto"
                                style={{ border: "2px solid #e8eaf6" }}
                            >
                                <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "#1a237e" }}>
                                    <div className="flex items-center gap-2">
                                        <LogOut className="h-4 w-4 text-white/80" />
                                        <span className="text-sm font-bold uppercase tracking-widest text-white">Déconnexion</span>
                                    </div>
                                    <button onClick={() => setShowLogoutModal(false)} className="text-white/60 hover:text-white transition-colors">
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="px-6 py-6 text-center">
                                    <div
                                        className="h-14 w-14 rounded-full flex items-center justify-center text-sm font-black text-white mx-auto mb-4"
                                        style={{ backgroundColor: "#2e7d32" }}
                                    >
                                        {initials}
                                    </div>
                                    <p className="font-bold text-gray-800 mb-1">{displayName}</p>
                                    <p className="text-gray-400 text-sm mb-6">Voulez-vous vraiment vous déconnecter ?</p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowLogoutModal(false)}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold border hover:bg-gray-50 transition-colors"
                                            style={{ borderColor: "#e0e0e0", color: "#555" }}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={() => { setShowLogoutModal(false); logout(); }}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                            style={{ backgroundColor: "#c62828", boxShadow: "0 6px 16px rgba(198,40,40,0.25)" }}
                                        >
                                            Se déconnecter
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* ── Modal session invalidée ── */}
            {sessionInvalidated && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.92, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ duration: 0.22 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none"
                    >
                        <div
                            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden pointer-events-auto"
                            style={{ border: "2px solid #ffe082" }}
                        >
                            <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "#b45309" }}>
                                <MonitorSmartphone className="h-4 w-4 text-white/80" />
                                <span className="text-sm font-bold uppercase tracking-widest text-white">Session expirée</span>
                            </div>
                            <div className="px-6 py-6 text-center">
                                <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#fff8e1" }}>
                                    <MonitorSmartphone className="h-7 w-7" style={{ color: "#b45309" }} />
                                </div>
                                <p className="font-bold text-gray-800 mb-2">Compte connecté ailleurs</p>
                                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                                    Votre compte a été connecté sur un <strong>autre appareil</strong>.
                                    Pour des raisons de sécurité, une seule session active est autorisée.
                                </p>
                                <button
                                    onClick={confirmSessionLogout}
                                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                    style={{ backgroundColor: "#b45309", boxShadow: "0 6px 16px rgba(180,83,9,0.25)" }}
                                >
                                    Compris, me reconnecter
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}

            {/* ── Barre du haut ── */}
            <div
                className={`fixed top-0 left-0 right-0 h-16 z-40 flex items-center justify-between px-6 shadow-sm transition-transform duration-300 ${examActive ? "-translate-y-full pointer-events-none" : "translate-y-0"}`}
                style={{ backgroundColor: "#ffffff", borderBottom: "3px solid #2e7d32" }}
            >
                {/* Logo */}
                <Link href="/candidat" className="flex items-center gap-3 group">
                    <div className="w-9 h-9 flex items-center justify-center drop-shadow-sm group-hover:scale-105 transition-transform">
                        <Image src="/logo.png" alt="IRISQ" width={36} height={36} className="object-contain w-full h-full" priority />
                    </div>
                    <span className="text-xs font-extrabold tracking-[0.18em] uppercase hidden sm:block" style={{ color: "#1a237e" }}>
                        Espace candidat
                    </span>
                </Link>

                {/* Avatar + déconnexion */}
                <button
                    onClick={() => setShowLogoutModal(true)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors group hover:bg-gray-50"
                    title="Se déconnecter"
                >
                    <div
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        {initials}
                    </div>
                    <span className="text-sm font-semibold text-gray-700 hidden sm:block">{displayName}</span>
                    <LogOut className="h-4 w-4 text-gray-400 group-hover:text-red-500 transition-colors" />
                </button>
            </div>

            {/* ── Contenu ──
                Pendant l'examen (examActive=true) la page examen se monte en
                fixed inset-0 z-[200] par-dessus tout — le contenu normal reste
                monté mais invisible pour ne pas interférer.
            ── */}
            <main className="flex-1 pt-16 pb-20">
                <div className={`w-full max-w-2xl mx-auto px-4 py-10 transition-opacity duration-300 ${examActive ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
                    {children}
                </div>
            </main>

            {/* ── Barre de navigation bas ── */}
            <nav
                className={`fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t transition-transform duration-300 ${examActive ? "translate-y-full pointer-events-none" : "translate-y-0"}`}
                style={{ backgroundColor: "#ffffff", borderColor: "#e0e0e0", height: "64px" }}
            >
                {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
                    const active = isActive(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors group"
                        >
                            <div
                                className="h-8 w-8 flex items-center justify-center rounded-xl transition-colors"
                                style={{ backgroundColor: active ? "#e8eaf6" : "transparent" }}
                            >
                                <Icon
                                    className="h-4.5 w-4.5 transition-colors"
                                    style={{ color: active ? "#1a237e" : "#9e9e9e" }}
                                    size={18}
                                />
                            </div>
                            <span
                                className="text-[10px] font-bold uppercase tracking-wide transition-colors"
                                style={{ color: active ? "#1a237e" : "#9e9e9e" }}
                            >
                                {label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
