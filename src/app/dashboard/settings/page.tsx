"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Save, Bell, Shield, Key, User, Briefcase, ChevronRight } from "lucide-react";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("profile");

    const tabs = [
        { id: "profile", name: "Profil & Compte", icon: User },
        { id: "workspace", name: "Espace de travail", icon: Briefcase },
        { id: "notifications", name: "Notifications", icon: Bell },
        { id: "security", name: "Sécurité", icon: Shield },
    ];

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div>
                <h1 className="text-3xl font-bold text-slate-900 font-heading">Paramètres</h1>
                <p className="text-slate-500 mt-1">Gérez vos préférences de compte et d'espace de travail.</p>
            </div>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Settings Navigation */}
                <div className="w-full md:w-64 shrink-0">
                    <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-2 md:pb-0">
                        {tabs.map((tab) => {
                            const isActive = activeTab === tab.id;
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap text-left ${isActive
                                        ? "bg-white text-primary shadow-sm border border-slate-200"
                                        : "text-slate-500 hover:bg-white/50 hover:text-slate-900 border border-transparent"
                                        }`}
                                >
                                    <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-slate-400"}`} />
                                    <span className="flex-1">{tab.name}</span>
                                    {isActive && <ChevronRight className="h-4 w-4 hidden md:block opacity-50" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Settings Content */}
                <div className="flex-1 min-w-0">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="bg-white border border-slate-200 rounded-2xl p-6 md:p-8 shadow-sm"
                    >
                        {activeTab === "profile" && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 font-heading mb-1">Informations du compte</h2>
                                    <p className="text-sm text-slate-500 mb-6">Mettez à jour votre photo et vos informations personnelles.</p>
                                </div>

                                <div className="flex items-center gap-6 pb-6 border-b border-slate-100">
                                    <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-primary to-sky-400 flex items-center justify-center text-xl font-bold text-white shadow-md">
                                        JD
                                    </div>
                                    <div>
                                        <button className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                                            Changer la photo
                                        </button>
                                        <p className="text-xs text-slate-500 mt-2">JPG, GIF ou PNG. Max 2MB.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Nom complet</label>
                                        <input type="text" defaultValue="Jean Dupont" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Adresse email</label>
                                        <input type="email" defaultValue="jean.dupont@irisq.com" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                    </div>
                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-sm font-medium text-slate-700">Bio</label>
                                        <textarea defaultValue="Administrateur de la plateforme de formation Irisq." rows={3} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === "workspace" && (
                            <div className="space-y-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900 font-heading mb-1">Espace de travail</h2>
                                    <p className="text-sm text-slate-500 mb-6">Personnalisez votre plateforme Irisq.</p>
                                </div>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-slate-700">Nom de l'espace</label>
                                        <input type="text" defaultValue="Irisq Formation" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                                    </div>
                                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl mt-6 flex items-start gap-4">
                                        <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-100 mt-0.5">
                                            <Briefcase className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900">Plan Enterprise</h4>
                                            <p className="text-sm text-slate-500 mt-1">Vous bénéficiez de toutes les fonctionnalités de création et nombre illimité d'apprenants.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Other tabs omitted for brevity, adding a unified save button */}
                        {["notifications", "security"].includes(activeTab) && (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <div className="h-16 w-16 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mb-4 text-slate-400">
                                    <Shield className="h-8 w-8" />
                                </div>
                                <h3 className="text-lg font-semibold text-slate-900">Fonctionnalité en développement</h3>
                                <p className="text-sm text-slate-500 mt-2 max-w-sm">Les paramètres de {activeTab} seront bientôt disponibles dans la prochaine mise à jour.</p>
                            </div>
                        )}

                        <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
                            <button className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
                                <Save className="h-4 w-4" />
                                Enregistrer les modifications
                            </button>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
