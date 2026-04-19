"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileText, ArrowRight } from "lucide-react";

export default function CandidateDocumentsPage() {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm text-center max-w-md mx-auto"
        >
            <div className="h-14 w-14 rounded-2xl mx-auto flex items-center justify-center mb-4" style={{ backgroundColor: "#e8eaf6" }}>
                <FileText className="h-7 w-7" style={{ color: "#1a237e" }} />
            </div>
            <h1 className="text-lg font-black mb-1" style={{ color: "#1a237e" }}>
                Vos documents
            </h1>
            <p className="text-sm text-gray-500">
                Les demandes de renvoi de pièces apparaîtront ici. Consultez vos candidatures pour suivre leur évolution.
            </p>
            <Link
                href="/candidat/dossiers"
                className="mt-5 inline-flex items-center gap-2 text-sm font-bold px-5 py-2.5 rounded-xl text-white transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
            >
                Voir mes candidatures <ArrowRight className="h-4 w-4" />
            </Link>
        </motion.div>
    );
}
