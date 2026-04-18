"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

import { createSession } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function CreateSessionPage() {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [status, setStatus] = useState("active");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && (!user || user.role !== "RH")) {
            router.replace("/dashboard");
        }
    }, [isLoading, user, router]);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setSaving(true);
        try {
            const session = await createSession({
                name: name.trim(),
                description: description.trim() || undefined,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                status,
            });
            router.push(`/dashboard/sessions/${session._id}`);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Erreur");
        } finally {
            setSaving(false);
        }
    }

    if (isLoading || !user) return null;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Link
                href="/dashboard/sessions"
                className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                <ArrowLeft className="h-3 w-3" /> Retour aux sessions
            </Link>

            <div>
                <h1 className="text-2xl font-black" style={{ color: "#1a237e" }}>
                    Créer une session
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                    Une session regroupe toutes les candidatures d&apos;une période (ex : Session Avril 2026).
                </p>
            </div>

            <form
                onSubmit={submit}
                className="bg-white rounded-2xl p-6 space-y-5 border border-gray-100 shadow-sm"
            >
                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Nom de la session *
                    </label>
                    <input
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Ex : Session Avril 2026"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        rows={3}
                        placeholder="Contexte, objectifs, remarques…"
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            Date de début
                        </label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            Date de fin
                        </label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Statut
                    </label>
                    <select
                        value={status}
                        onChange={e => setStatus(e.target.value)}
                        className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                        <option value="active">Active</option>
                        <option value="closed">Fermée</option>
                    </select>
                </div>

                {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                        {error}
                    </div>
                )}

                <button
                    disabled={saving || !name.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.25)" }}
                >
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "Création…" : "Créer la session"}
                </button>
            </form>
        </div>
    );
}
