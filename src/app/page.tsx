"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { LogIn, UserPlus, GraduationCap } from "lucide-react";

export default function Home() {
  return (
    <div className="relative min-h-screen font-sans bg-[#f4f6f9] overflow-x-hidden">
      {/* HEADER */}
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

      <main className="flex min-h-screen items-center justify-center px-5 sm:px-10 lg:px-16 pt-40 pb-20">
        <div className="w-full max-w-3xl mx-auto text-center flex flex-col items-center gap-7">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2 border"
            style={{ backgroundColor: "#e8f5e9", borderColor: "#2e7d32" }}
          >
            <span className="w-2.5 h-2.5 rotate-45 flex-shrink-0" style={{ backgroundColor: "#c62828" }} />
            <span className="text-xs sm:text-sm font-bold tracking-widest uppercase" style={{ color: "#2e7d32" }}>
              Plateforme de gestion des certifications
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="text-3xl sm:text-5xl lg:text-[3.5rem] font-extrabold leading-tight tracking-tight"
            style={{ color: "#1a237e" }}
          >
            Pilotez vos certifications{" "}
            <span style={{ color: "#2e7d32" }}>
              du début jusqu&apos;au diplôme.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.2 }}
            className="text-base sm:text-lg lg:text-xl leading-relaxed max-w-2xl text-gray-500"
          >
            Créez votre compte candidat, accédez aux formations disponibles et candidatez en quelques étapes.{" "}
            <span className="font-semibold" style={{ color: "#1a237e" }}>
              Vos informations sont enregistrées pour toutes vos futures candidatures.
            </span>
          </motion.p>

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

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.32 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full mt-2"
          >
            <Link
              href="/candidat/register"
              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
              style={{
                backgroundColor: "#2e7d32",
                boxShadow: "0 8px 24px rgba(46, 125, 50, 0.3)",
              }}
            >
              <UserPlus className="h-5 w-5 flex-shrink-0" />
              Créer mon compte
            </Link>

            <Link
              href="/candidat/login"
              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-bold shadow-lg hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
              style={{
                backgroundColor: "#ffffff",
                color: "#1a237e",
                border: "2px solid #1a237e",
                boxShadow: "0 8px 24px rgba(26, 35, 126, 0.12)",
              }}
            >
              <GraduationCap className="h-5 w-5 flex-shrink-0" />
              Espace Candidat
            </Link>

            <Link
              href="/login"
              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-base font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all duration-200 whitespace-nowrap"
              style={{
                backgroundColor: "#1a237e",
                boxShadow: "0 8px 24px rgba(26, 35, 126, 0.3)",
              }}
            >
              <LogIn className="h-5 w-5 flex-shrink-0" />
              Espace Gestionnaire
            </Link>
          </motion.div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 h-1.5 z-50" style={{ backgroundColor: "#2e7d32" }} />
    </div>
  );
}
