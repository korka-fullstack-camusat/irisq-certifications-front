"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Award, CheckCircle2, ChevronLeft, ChevronRight, File as FileIcon,
    GraduationCap, Loader2, MapPin, Monitor, Shield, Upload, Wrench, X,
    ClipboardCheck,
} from "lucide-react";

import {
    applyForCertification,
    fetchCandidateCertifications,
    uploadFiles,
    type PublicCertificationsPayload,
} from "@/lib/api";
import { useCandidateAccount } from "@/lib/account-context";

const STEPS = [
    { id: 1, label: "Certification", icon: Award },
    { id: 2, label: "Examen", icon: Monitor },
    { id: 3, label: "Documents", icon: FileIcon },
    { id: 4, label: "Aménagement", icon: Wrench },
    { id: 5, label: "Déclaration", icon: Shield },
];

function inputClass() {
    return "w-full bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2e7d32] transition-all";
}
function labelClass() {
    return "block text-xs font-bold uppercase tracking-widest mb-1.5";
}

export default function CandidateApplyPage() {
    const router = useRouter();
    const { account, refresh, loading: accountLoading } = useCandidateAccount();

    const [step, setStep] = useState(1);
    const [data, setData] = useState<PublicCertificationsPayload | null>(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [sessionId, setSessionId] = useState("");
    const [certification, setCertification] = useState("");
    const [examMode, setExamMode] = useState<"online" | "onsite" | "">("");
    const [examType, setExamType] = useState<"direct" | "after_formation" | "">("");

    const [cvFile, setCvFile] = useState<File | null>(null);
    const [pieceIdentite, setPieceIdentite] = useState<File | null>(null);
    const [justificatifExp, setJustificatifExp] = useState<File | null>(null);
    const [diplomes, setDiplomes] = useState<File | null>(null);
    const [attestation, setAttestation] = useState<File | null>(null);

    const [amenagement, setAmenagement] = useState<"Oui" | "Non" | "">("");
    const [amenagementDetails, setAmenagementDetails] = useState("");
    const [declarationActive, setDeclarationActive] = useState(false);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successCode, setSuccessCode] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const d = await fetchCandidateCertifications();
                setData(d);
            } catch (e) {
                setError(e instanceof Error ? e.message : "Impossible de charger les certifications");
            } finally {
                setDataLoading(false);
            }
        })();
    }, []);

    function validateStep(s: number): boolean {
        if (s === 1) return certification !== "" && (!data?.sessions.length || sessionId !== "");
        if (s === 2) return examMode !== "" && examType !== "";
        if (s === 3) {
            const base = !!cvFile && !!pieceIdentite && !!justificatifExp && !!diplomes;
            if (examType === "direct" && !attestation) return false;
            return base;
        }
        if (s === 4) {
            if (!amenagement) return false;
            if (amenagement === "Oui" && amenagementDetails.trim() === "") return false;
            return true;
        }
        if (s === 5) return declarationActive;
        return true;
    }

    function handleNext() {
        if (validateStep(step)) {
            setError(null);
            setStep(s => Math.min(STEPS.length, s + 1));
        } else {
            setError("Veuillez remplir tous les champs obligatoires avant de continuer.");
        }
    }

    async function uploadOne(f: File | null): Promise<string | undefined> {
        if (!f) return undefined;
        const fd = new FormData();
        fd.append("files", f);
        const res = await uploadFiles(fd);
        return res.file_urls?.[0];
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!validateStep(5)) return;
        if (!examMode || !examType) return;

        setSubmitting(true);
        setError(null);
        try {
            const [cv_url, piece_identite_url, justificatif_experience_url, diplomes_url, attestation_formation_url] =
                await Promise.all([
                    uploadOne(cvFile),
                    uploadOne(pieceIdentite),
                    uploadOne(justificatifExp),
                    uploadOne(diplomes),
                    uploadOne(attestation),
                ]);

            const result = await applyForCertification({
                session_id: sessionId || undefined,
                certification,
                exam_mode: examMode,
                exam_type: examType,
                cv_url,
                piece_identite_url,
                justificatif_experience_url,
                diplomes_url,
                attestation_formation_url,
                amenagement: amenagement || "Non",
                amenagement_details: amenagement === "Oui" ? amenagementDetails : "N/A",
                declaration_accepted: declarationActive,
            });
            setSuccessCode(result.public_id || null);
            await refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Échec de la candidature");
        } finally {
            setSubmitting(false);
        }
    }

    if (accountLoading || dataLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!account) return null;

    if (successCode !== null) {
        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-10 rounded-2xl border shadow-sm text-center max-w-md w-full mx-auto"
                style={{ borderColor: "#c8e6c9" }}
            >
                <div className="flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-16 w-16" style={{ color: "#2e7d32" }} />
                </div>
                <h1 className="text-2xl font-extrabold mb-3" style={{ color: "#1a237e" }}>Candidature enregistrée !</h1>
                <p className="text-gray-500 text-sm mb-5">
                    Votre dossier a été enregistré. Voici votre code de codification :
                </p>
                {successCode && (
                    <p className="font-mono font-black text-lg mb-6 px-4 py-3 rounded-xl bg-indigo-50 text-indigo-800 inline-block">
                        {successCode}
                    </p>
                )}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => router.push("/candidat")}
                        className="px-6 py-3 rounded-xl text-white font-bold text-sm"
                        style={{ backgroundColor: "#1a237e" }}
                    >
                        Retour au tableau de bord
                    </button>
                </div>
            </motion.div>
        );
    }

    const progress = ((step - 1) / (STEPS.length - 1)) * 100;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-black" style={{ color: "#1a237e" }}>
                        Postuler à une certification
                    </h1>
                    <p className="text-sm text-gray-500">
                        Votre code de codification sera généré une fois votre candidature soumise.
                    </p>
                </div>
                <Link href="/candidat" className="text-xs font-bold text-gray-400 hover:text-gray-600 hidden sm:inline-flex items-center gap-1">
                    ← Retour
                </Link>
            </div>

            <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: "#e8eaf6" }}>
                <div className="relative h-1.5 rounded-full mb-5 overflow-hidden" style={{ backgroundColor: "#e8eaf6" }}>
                    <motion.div
                        className="absolute left-0 top-0 h-full rounded-full"
                        style={{ backgroundColor: "#2e7d32" }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4 }}
                    />
                </div>
                <div className="flex items-center justify-between">
                    {STEPS.map(s => {
                        const Icon = s.icon;
                        const done = step > s.id;
                        const active = step === s.id;
                        return (
                            <div key={s.id} className="flex flex-col items-center gap-1">
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                                    style={{
                                        backgroundColor: done ? "#2e7d32" : active ? "#1a237e" : "#f4f6f9",
                                        color: done || active ? "#fff" : "#9ca3af",
                                        border: active ? "2px solid #1a237e" : done ? "2px solid #2e7d32" : "2px solid #e0e0e0",
                                    }}
                                >
                                    {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                                </div>
                                <span
                                    className="text-[9px] font-bold uppercase tracking-wider hidden sm:block"
                                    style={{ color: active ? "#1a237e" : done ? "#2e7d32" : "#9ca3af" }}
                                >
                                    {s.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -24 }}
                        transition={{ duration: 0.28 }}
                        className="bg-white rounded-2xl border shadow-sm overflow-hidden"
                        style={{ borderColor: "#e8eaf6" }}
                    >
                        <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "#1a237e" }}>
                            {(() => {
                                const Icon = STEPS[step - 1].icon;
                                return <Icon className="h-4 w-4 text-white/80" />;
                            })()}
                            <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                                Étape {step} — {STEPS[step - 1].label}
                            </h2>
                            <span className="ml-auto text-white/40 text-xs">{step} / {STEPS.length}</span>
                        </div>

                        <div className="p-6 space-y-5">
                            {step === 1 && (
                                <div className="space-y-5">
                                    {data?.sessions.length ? (
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Session <span className="text-[#c62828]">*</span>
                                            </label>
                                            <select
                                                value={sessionId}
                                                onChange={e => setSessionId(e.target.value)}
                                                className={inputClass()}
                                            >
                                                <option value="">— Choisir une session —</option>
                                                {data.sessions.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.name}
                                                        {s.start_date ? ` — ${s.start_date}` : ""}
                                                        {s.end_date ? ` → ${s.end_date}` : ""}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : null}
                                    <div className="space-y-2">
                                        <p className="text-xs text-gray-400 mb-4">
                                            Sélectionnez la certification que vous souhaitez obtenir.
                                        </p>
                                        {(data?.certifications || []).map(cert => {
                                            const selected = certification === cert;
                                            const color = cert.includes("17025") ? "#1a237e" : cert.includes("9001") ? "#2e7d32" : "#b45309";
                                            return (
                                                <label
                                                    key={cert}
                                                    className="flex items-center gap-4 p-3.5 rounded-xl border cursor-pointer transition-all"
                                                    style={{
                                                        borderColor: selected ? color : "#e0e0e0",
                                                        backgroundColor: selected ? `${color}10` : "#f4f6f9",
                                                    }}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="certification"
                                                        value={cert}
                                                        checked={selected}
                                                        onChange={() => setCertification(cert)}
                                                        className="w-4 h-4 shrink-0"
                                                    />
                                                    <span className="text-sm font-semibold" style={{ color: selected ? color : "#555" }}>
                                                        {cert}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {step === 2 && (
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#1a237e" }}>
                                            Mode d&apos;examen <span className="text-[#c62828]">*</span>
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[
                                                { value: "online", label: "En ligne", hint: "Examen à distance, surveillé en visio.", icon: Monitor, color: "#1a237e" },
                                                { value: "onsite", label: "Présentiel", hint: "Examen dans un centre IRISQ.", icon: MapPin, color: "#2e7d32" },
                                            ].map(opt => {
                                                const Icon = opt.icon;
                                                const selected = examMode === opt.value;
                                                return (
                                                    <label
                                                        key={opt.value}
                                                        className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer"
                                                        style={{
                                                            borderColor: selected ? opt.color : "#e0e0e0",
                                                            backgroundColor: selected ? `${opt.color}10` : "#f4f6f9",
                                                        }}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="exam-mode"
                                                            value={opt.value}
                                                            checked={selected}
                                                            onChange={() => setExamMode(opt.value as "online" | "onsite")}
                                                            className="mt-1 w-4 h-4 shrink-0"
                                                        />
                                                        <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: opt.color }} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold" style={{ color: selected ? opt.color : "#1a237e" }}>{opt.label}</p>
                                                            <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#1a237e" }}>
                                            Type d&apos;examen <span className="text-[#c62828]">*</span>
                                        </p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {[
                                                { value: "direct", label: "Examen direct", hint: "Attestation de formation obligatoire.", icon: Award, color: "#b45309" },
                                                { value: "after_formation", label: "Examen après formation IRISQ", hint: "IRISQ vous forme avant l'examen.", icon: GraduationCap, color: "#2e7d32" },
                                            ].map(opt => {
                                                const Icon = opt.icon;
                                                const selected = examType === opt.value;
                                                return (
                                                    <label
                                                        key={opt.value}
                                                        className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer"
                                                        style={{
                                                            borderColor: selected ? opt.color : "#e0e0e0",
                                                            backgroundColor: selected ? `${opt.color}10` : "#f4f6f9",
                                                        }}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="exam-type"
                                                            value={opt.value}
                                                            checked={selected}
                                                            onChange={() => setExamType(opt.value as "direct" | "after_formation")}
                                                            className="mt-1 w-4 h-4 shrink-0"
                                                        />
                                                        <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: opt.color }} />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-bold" style={{ color: selected ? opt.color : "#1a237e" }}>{opt.label}</p>
                                                            <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4">
                                    <DocUpload label="1. CV" required file={cvFile} setFile={setCvFile} accept=".pdf,.doc,.docx" />
                                    <DocUpload label="2. Pièce d'identité" required file={pieceIdentite} setFile={setPieceIdentite} accept=".pdf,.jpg,.jpeg,.png" />
                                    <DocUpload label="3. Justificatif d'expérience" required file={justificatifExp} setFile={setJustificatifExp} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                                    <DocUpload label="4. Diplômes / attestations" required file={diplomes} setFile={setDiplomes} accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" />
                                    <DocUpload
                                        label="5. Attestation de formation"
                                        required={examType === "direct"}
                                        optional={examType !== "direct"}
                                        file={attestation}
                                        setFile={setAttestation}
                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    />
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-5">
                                    <p className="text-sm text-gray-500 leading-relaxed">
                                        Avez-vous des besoins d&apos;aménagement spécifique (accessibilité, éclairage, aération) ?
                                    </p>
                                    <div className="flex gap-4">
                                        {(["Oui", "Non"] as const).map(val => (
                                            <label
                                                key={val}
                                                className="flex items-center gap-2.5 cursor-pointer px-5 py-3 rounded-xl border font-bold text-sm"
                                                style={{
                                                    borderColor: amenagement === val ? "#1a237e" : "#e0e0e0",
                                                    backgroundColor: amenagement === val ? "#e8eaf6" : "#f4f6f9",
                                                    color: amenagement === val ? "#1a237e" : "#555",
                                                }}
                                            >
                                                <input
                                                    type="radio"
                                                    value={val}
                                                    checked={amenagement === val}
                                                    onChange={() => setAmenagement(val)}
                                                    className="w-4 h-4"
                                                />
                                                {val}
                                            </label>
                                        ))}
                                    </div>
                                    {amenagement === "Oui" && (
                                        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Précisez vos besoins <span className="text-[#c62828]">*</span>
                                            </label>
                                            <textarea
                                                value={amenagementDetails}
                                                onChange={e => setAmenagementDetails(e.target.value)}
                                                className={inputClass() + " resize-none"}
                                                rows={3}
                                            />
                                        </motion.div>
                                    )}
                                </div>
                            )}

                            {step === 5 && (
                                <div className="space-y-5">
                                    <label
                                        className="flex items-start gap-4 p-4 rounded-xl border cursor-pointer"
                                        style={{
                                            borderColor: declarationActive ? "#2e7d32" : "#e0e0e0",
                                            backgroundColor: declarationActive ? "#e8f5e9" : "#f4f6f9",
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={declarationActive}
                                            onChange={e => setDeclarationActive(e.target.checked)}
                                            className="w-5 h-5 mt-0.5 shrink-0"
                                        />
                                        <span className="text-sm text-gray-700 leading-relaxed">
                                            Je déclare que toutes les informations fournies sont vraies, correctes, complètes et à jour.
                                            J&apos;autorise IRISQ Certification à procéder à toutes les vérifications nécessaires.
                                        </span>
                                    </label>

                                    <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}>
                                        <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                            Récapitulatif
                                        </p>
                                        {[
                                            ["Candidat", `${account.prenom} ${account.nom}`],
                                            ["Email", account.email],
                                            ["Certification", certification || "—"],
                                            ["Mode d'examen", examMode === "online" ? "En ligne" : examMode === "onsite" ? "Présentiel" : "—"],
                                            ["Type d'examen", examType === "direct" ? "Direct" : examType === "after_formation" ? "Après formation" : "—"],
                                        ].map(([k, v]) => (
                                            <div key={k} className="flex justify-between text-xs">
                                                <span className="text-gray-400 font-semibold">{k}</span>
                                                <span className="font-bold text-gray-700 max-w-[60%] text-right truncate">{v}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="flex flex-col items-center w-full max-w-sm mx-auto gap-4 mt-8 pb-4">
                    {error && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold w-full text-center text-red-600 bg-red-50 py-2 rounded-lg">
                            {error}
                        </motion.div>
                    )}
                    <div className="flex items-center justify-between w-full">
                        <button
                            type="button"
                            onClick={() => { setStep(s => Math.max(1, s - 1)); setError(null); }}
                            disabled={step === 1}
                            className="flex items-center gap-2 px-5 py-3 rounded-xl border text-sm font-bold transition-all disabled:opacity-30"
                            style={{ borderColor: "#e0e0e0", color: "#555" }}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Précédent
                        </button>

                        <span className="text-xs text-gray-400 font-semibold">{step} / {STEPS.length}</span>

                        {step < STEPS.length ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                                style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
                            >
                                Suivant
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={submitting || !declarationActive}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.28)" }}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                                {submitting ? "Envoi…" : "Soumettre ma candidature"}
                            </button>
                        )}
                    </div>
                </div>
            </form>
        </div>
    );
}

function DocUpload({
    label, required, optional, file, setFile, accept,
}: {
    label: string;
    required?: boolean;
    optional?: boolean;
    file: File | null;
    setFile: (f: File | null) => void;
    accept: string;
}) {
    return (
        <div>
            <p className="text-sm font-bold text-[#1a237e] mb-2 flex items-center gap-2">
                {label}
                {required && <span className="text-[#c62828]">*</span>}
                {optional && (
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                        Facultatif
                    </span>
                )}
            </p>
            {!file ? (
                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                    <Upload className="h-6 w-6 mb-2 text-gray-400" />
                    <span className="text-sm font-bold text-gray-600">Déposer le fichier</span>
                    <input
                        type="file"
                        className="hidden"
                        accept={accept}
                        onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                    />
                </label>
            ) : (
                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                            <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-700 truncate">{file.name}</p>
                            <p className="text-[10px] text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                    </div>
                    <button type="button" onClick={() => setFile(null)} className="p-1.5 rounded-lg hover:bg-red-50">
                        <X className="h-4 w-4" style={{ color: "#c62828" }} />
                    </button>
                </div>
            )}
        </div>
    );
}
