"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    FolderOpen,
    Upload,
    LogOut,
    X,
    BookOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { CandidateProvider, useCandidate } from "@/lib/candidate-context";

const AUTH_PATHS = new Set([
    "/candidat/login",
    "/candidat/register",
    "/candidat/change-password",
    "/candidat/forgot-password",
]);

const navItems = [
    { name: "Tableau de bord", href: "/candidat", icon: LayoutDashboard },
    { name: "Mon Examen", href: "/candidat/examen", icon: BookOpen },
    { name: "Mes dossiers", href: "/candidat/dossiers", icon: FolderOpen },
    { name: "Mes corrections", href: "/candidat/documents", icon: Upload },
];

export default function CandidateLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    // Public auth pages don't use the shell.
    if (AUTH_PATHS.has(pathname)) {
        return <>{children}</>;
    }

    return (
        <CandidateProvider>
            <Shell>{children}</Shell>
        </CandidateProvider>
    );
}

function Shell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { dossier, logout, examActive } = useCandidate();
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    const initials = (dossier?.name || dossier?.public_id || "??").substring(0, 2).toUpperCase();
    const displayName = dossier?.name || dossier?.public_id || "Candidat";

    const handleLogout = () => {
        setShowLogoutModal(false);
        logout();
    };

    return (
        <div className={`flex min-h-screen font-sans${examActive ? " overflow-hidden" : ""}`} style={{ backgroundColor: "#f4f6f9" }}>
            <AnimatePresence>
                {showLogoutModal && (
                    <>
                        <motion.div
                            key="overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
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
                                        <span className="text-sm font-bold uppercase tracking-widest text-white">
                                            Déconnexion
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setShowLogoutModal(false)}
                                        className="text-white/60 hover:text-white transition-colors"
                                    >
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
                                    <p className="text-gray-400 text-sm mb-6">
                                        Voulez-vous vraiment vous déconnecter ?
                                    </p>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="flex-1 h-px bg-gray-100" />
                                        <span className="w-2 h-2 rotate-45" style={{ backgroundColor: "#c62828", display: "inline-block" }} />
                                        <div className="flex-1 h-px bg-gray-100" />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => setShowLogoutModal(false)}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold border transition-colors hover:bg-gray-50"
                                            style={{ borderColor: "#e0e0e0", color: "#555" }}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            onClick={handleLogout}
                                            className="flex-1 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                            style={{
                                                backgroundColor: "#c62828",
                                                boxShadow: "0 6px 16px rgba(198,40,40,0.25)",
                                            }}
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

            {/* Sidebar desktop — masquée pendant l'examen */}
            <aside
                className={`fixed top-0 left-0 h-screen w-64 hidden md:flex flex-col z-20 shadow-lg transition-transform duration-300 ${examActive ? "-translate-x-full pointer-events-none" : "translate-x-0"}`}
                style={{ backgroundColor: "#ffffff", borderRight: "2px solid #e8eaf6" }}
            >
                <div
                    className="flex flex-col items-center justify-center gap-2 py-6 px-4 shrink-0"
                    style={{ borderBottom: "3px solid #2e7d32" }}
                >
                    <Link href="/candidat" className="flex flex-col items-center gap-2 group">
                        <div className="w-20 h-20 flex items-center justify-center drop-shadow-md group-hover:scale-105 transition-transform">
                            <Image
                                src="/logo.png"
                                alt="IRISQ Logo"
                                width={80}
                                height={80}
                                className="object-contain w-full h-full"
                                priority
                            />
                        </div>
                        <span className="text-[10px] font-extrabold tracking-[0.2em] uppercase" style={{ color: "#1a237e" }}>
                            Espace candidat
                        </span>
                    </Link>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 px-3 mb-3">
                        Navigation
                    </p>
                    <nav className="space-y-1">
                        {navItems.map((item) => {
                            const isActive = item.href === "/candidat"
                                ? pathname === item.href
                                : pathname.startsWith(item.href);
                            const Icon = item.icon;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className="relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all"
                                    style={{
                                        color: isActive ? "#ffffff" : "#555",
                                        backgroundColor: isActive ? "#1a237e" : "transparent",
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "#e8eaf6";
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                                    }}
                                >
                                    {isActive && (
                                        <motion.span
                                            layoutId="candidat-active-diamond"
                                            className="absolute -left-1 w-2.5 h-2.5 rotate-45"
                                            style={{ backgroundColor: "#c62828" }}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            transition={{ duration: 0.2 }}
                                        />
                                    )}
                                    <Icon
                                        className="h-5 w-5 shrink-0"
                                        style={{ color: isActive ? "#ffffff" : "#2e7d32" }}
                                    />
                                    {item.name}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="p-4 shrink-0" style={{ borderTop: "2px solid #e8eaf6" }}>
                    <button
                        onClick={() => setShowLogoutModal(true)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.backgroundColor = "#f4f6f9"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"}
                        title="Cliquer pour se déconnecter"
                    >
                        <div
                            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                            style={{ backgroundColor: "#2e7d32" }}
                        >
                            {initials}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className="text-sm font-bold text-gray-800 truncate">{displayName}</span>
                            <span className="text-xs text-gray-400 font-mono truncate">{dossier?.public_id || "—"}</span>
                        </div>
                        <LogOut className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "#c62828" }} />
                    </button>
                </div>
            </aside>

            <main className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${examActive ? "md:pl-0" : "md:pl-64"}`}>
                <header
                    className={`fixed top-0 left-0 right-0 h-16 flex items-center justify-between px-4 md:hidden z-40 shadow-sm transition-transform duration-300 ${examActive ? "-translate-y-full pointer-events-none" : "translate-y-0"}`}
                    style={{ backgroundColor: "#ffffff", borderBottom: "3px solid #2e7d32" }}
                >
                    <Link href="/candidat" className="flex items-center gap-2">
                        <Image src="/logo.png" alt="IRISQ" width={36} height={36} className="object-contain" />
                        <span className="text-xs font-extrabold tracking-widest uppercase" style={{ color: "#1a237e" }}>
                            IRISQ
                        </span>
                    </Link>
                    <button
                        onClick={() => setShowLogoutModal(true)}
                        className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-black text-white"
                        style={{ backgroundColor: "#2e7d32" }}
                    >
                        {initials}
                    </button>
                </header>

                <div className="flex-1 w-full pt-20 md:pt-8 p-4 md:p-8">
                    <div className="max-w-6xl mx-auto pb-20">
                        {children}
                    </div>
                </div>
            </main>

            {/* Nav mobile — masquée pendant l'examen */}
            <nav
                className={`md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-4 pb-safe transition-transform duration-300 ${examActive ? "translate-y-full pointer-events-none" : "translate-y-0"}`}
                style={{ backgroundColor: "#ffffff", borderTop: "2px solid #e8eaf6" }}
            >
                {navItems.map((item) => {
                    const isActive = item.href === "/candidat"
                        ? pathname === item.href
                        : pathname.startsWith(item.href);
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="flex flex-col items-center gap-1 p-3 transition-colors relative"
                            style={{ color: isActive ? "#1a237e" : "#9ca3af" }}
                        >
                            {isActive && (
                                <motion.div
                                    layoutId="candidat-mobile-nav"
                                    className="absolute -top-[2px] left-1/2 -translate-x-1/2 w-6 h-1 rounded-b-full"
                                    style={{ backgroundColor: "#2e7d32" }}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                />
                            )}
                            <Icon className="h-5 w-5" />
                            <span className="text-[10px] font-bold text-center">{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
