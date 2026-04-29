"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { LogIn, UserPlus, GraduationCap } from "lucide-react";

export default function Home() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="relative min-h-screen font-sans bg-[#f4f6f9] overflow-x-hidden">
      {/* HEADER — fixe, centré */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#f4f6f9]">
        <div className="flex flex-col items-center justify-center py-3 sm:py-4 px-4">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="IRISQ Logo"
                width={80}
                height={80}
                className="object-contain w-full h-full drop-shadow-md"
                priority
              />
            </div>
            <span
              className="text-[10px] sm:text-[12px] font-extrabold tracking-[0.25em] uppercase"
              style={{ color: "#1a237e" }}
            >
              IRISQ-CERTIFICATIONS
            </span>
          </motion.div>
        </div>
      </header>

      {/* HERO — centré */}
      <main className="flex min-h-screen items-center justify-center px-5 sm:px-10 lg:px-16 pt-40 pb-20">
        <div className="w-full max-w-3xl mx-auto text-center flex flex-col items-center gap-7">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 border"
            style={{ backgroundColor: "#e8f5e9", borderColor: "#2e7d32" }}
          >
            <span className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ backgroundColor: "#c62828" }} />
            <span className="text-xs sm:text-sm font-bold tracking-widest uppercase" style={{ color: "#2e7d32" }}>
              Plateforme de gestion des formations
            </span>
          </motion.div>

          {/* Titre */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-tight tracking-tight"
            style={{ color: "#1a237e" }}
          >
            Pilotez vos formations{" "}
            <span style={{ color: "#2e7d32" }}>
              du début jusqu&apos;au diplôme.
            </span>
          </motion.h1>

          {/* Sous-titre */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl text-gray-500"
          >
            Gérez vos apprenants, vos évaluations et vos certifications depuis une seule plateforme.{" "}
            <span className="font-semibold" style={{ color: "#1a237e" }}>
              Simple, puissant, conçu pour les organismes de formation ambitieux.
            </span>
          </motion.p>

          {/* Séparateur */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="flex items-center gap-3 w-48"
          >
            <div className="flex-1 h-px" style={{ backgroundColor: "#2e7d32" }} />
            <span className="w-3 h-3 rotate-45 flex-shrink-0" style={{ backgroundColor: "#c62828" }} />
            <div className="flex-1 h-px" style={{ backgroundColor: "#2e7d32" }} />
          </motion.div>

          {/* Boutons */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.32 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-2xl mt-2"
          >
            <Link
              href="/demande-certification"
              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              style={{
                backgroundColor: "#2e7d32",
                boxShadow: "0 8px 24px rgba(46, 125, 50, 0.3)",
              }}
            >
              <UserPlus className="h-5 w-5" />
              Candidater
            </Link>

            <Link
              href="/candidat/login"
              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold shadow-lg transition-all duration-200 hover:-translate-y-0.5 whitespace-nowrap"
              style={{
                backgroundColor: "#0e7490",
                color: "#ffffff",
                boxShadow: "0 6px 20px rgba(14,116,144,0.3)",
              }}
            >
              <GraduationCap className="h-5 w-5" />
              Espace candidat
            </Link>

            <Link
              href="/login"
              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-base font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
              style={{
                backgroundColor: "#1a237e",
                boxShadow: "0 8px 24px rgba(26, 35, 126, 0.3)",
              }}
            >
              <LogIn className="h-5 w-5" />
              Espace Gestionnaire
            </Link>
          </motion.div>
        </div>
      </main>

      {/* Modal accès restreint */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f5f5f5" }}>
                <GraduationCap className="h-8 w-8" style={{ color: "#9e9e9e" }} />
              </div>
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: "#1a237e" }}>
              Accès non disponible
            </h3>
            <p className="text-gray-500 text-sm">
              Vous n&apos;avez pas accès à cet espace.
            </p>
            <button
              onClick={() => setShowModal(false)}
              className="mt-6 px-8 py-2.5 rounded-xl text-white text-sm font-bold hover:-translate-y-0.5 transition-all duration-200"
              style={{ backgroundColor: "#1a237e" }}
            >
              Fermer
            </button>
          </motion.div>
        </div>
      )}

      {/* Bande verte en bas */}
      <div className="fixed bottom-0 left-0 right-0 h-1.5 z-50" style={{ backgroundColor: "#2e7d32" }} />
    </div>
  );
}
