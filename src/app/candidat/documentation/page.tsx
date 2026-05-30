"use client";

import { Library, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function DocumentationPage() {
    return (
        <div className="space-y-6">
            {/* En-tête */}
            <div className="flex items-center gap-3">
                <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: "#e8eaf6" }}
                >
                    <Library className="h-5 w-5" style={{ color: "#1a237e" }} />
                </div>
                <div>
                    <h1 className="text-xl font-extrabold" style={{ color: "#1a237e" }}>
                        Documentation
                    </h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        Ressources et guides candidats
                    </p>
                </div>
            </div>

            {/* Message indisponibilité */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="flex flex-col items-center justify-center text-center py-20 rounded-2xl"
                style={{
                    backgroundColor: "#ffffff",
                    border: "2px dashed #e8eaf6",
                }}
            >
                <div
                    className="h-20 w-20 rounded-full flex items-center justify-center mb-6"
                    style={{ backgroundColor: "#e8eaf6" }}
                >
                    <Clock className="h-9 w-9" style={{ color: "#1a237e" }} />
                </div>

                <h2 className="text-lg font-extrabold mb-2" style={{ color: "#1a237e" }}>
                    Section en cours de préparation
                </h2>
                <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
                    La documentation candidat sera disponible prochainement.
                    <br />
                    Vous y trouverez guides, ressources et supports utiles pour
                    votre parcours de certification.
                </p>

                <div
                    className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold"
                    style={{ backgroundColor: "#fff8e1", color: "#b45309", border: "1px solid #ffe082" }}
                >
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#b45309" }} />
                    Disponible dans les prochains jours
                </div>
            </motion.div>
        </div>
    );
}
