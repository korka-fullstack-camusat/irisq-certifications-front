"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Loader2, Upload, X, File as FileIcon,
    AlertCircle, ChevronRight, ChevronLeft, User, Phone,
    Award, FileText, Shield, Wrench, Monitor, MapPin, GraduationCap
} from "lucide-react";
import Image from "next/image";
import { fetchForms, createForm, submitResponse, uploadFiles, fetchSessions, type Session } from "@/lib/api";

const CERTIFICATIONS = [
    "Junior Implementor ISO/IEC17025:2017",
    "Implementor ISO/IEC17025:2017",
    "Lead Implementor ISO/IEC17025:2017",
    "Junior Implementor ISO 9001:2015",
    "Implementor ISO 9001:2015",
    "Lead Implementor ISO 9001:2015",
    "Junior Implementor ISO 14001:2015",
    "Implementor ISO 14001:2015",
    "Lead Implementor ISO 14001:2015",
];

const FORM_TITLE = "Fiche de demande - IRISQ CERTIFICATION";

const STEPS = [
    { id: 1, label: "Identité & contact", icon: User },
    { id: 2, label: "Certification", icon: Award },
    { id: 3, label: "Examen", icon: Monitor },
    { id: 4, label: "Documents", icon: FileText },
    { id: 5, label: "Aménagement", icon: Wrench },
    { id: 6, label: "Déclaration", icon: Shield },
];

function inputClass() {
    return "w-full bg-[#f4f6f9] border border-[#e0e0e0] rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-[#2e7d32] transition-all";
}
function labelClass() {
    return "block text-xs font-bold uppercase tracking-widest mb-1.5";
}

export default function DemandeCertificationPage() {
    const router = useRouter();
    const [formId, setFormId] = useState<string | null>(null);
    const [isLoadingInit, setIsLoadingInit] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);
    const [step, setStep] = useState(1);

    const [nom, setNom] = useState("");
    const [prenom, setPrenom] = useState("");
    const [dateNaissance, setDateNaissance] = useState("");
    const [lieuNaissance, setLieuNaissance] = useState("");
    const [nationalite, setNationalite] = useState("");
    const [adresse, setAdresse] = useState("");
    const [telephone, setTelephone] = useState("");
    const [email, setEmail] = useState("");
    const [anneesExperience, setAnneesExperience] = useState("");
    const [certification, setCertification] = useState("");
    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionId, setSessionId] = useState<string>("");
    const [examMode, setExamMode] = useState<"online" | "onsite" | "">("");
    const [examType, setExamType] = useState<"direct" | "after_formation" | "">("");
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [pieceIdentite, setPieceIdentite] = useState<File | null>(null);
    const [justificatifExp, setJustificatifExp] = useState<File | null>(null);
    const [diplomes, setDiplomes] = useState<File | null>(null);
    const [attestationFormation, setAttestationFormation] = useState<File | null>(null);
    const [amenagement, setAmenagement] = useState<"Oui" | "Non" | "">("");
    const [amenagementDetails, setAmenagementDetails] = useState("");
    const [declarationActive, setDeclarationActive] = useState(false);

    // Custom validation error state
    const [validationError, setValidationError] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const sess = await fetchSessions();
                setSessions(sess.filter(s => s.status === "active"));
            } catch {
                // sessions are optional — ignore failures so the form stays usable
            }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const forms = await fetchForms();
                const existing = forms.find((f: any) => f.title === FORM_TITLE);
                if (existing) {
                    setFormId(existing._id);
                } else {
                    const newForm = await createForm({
                        title: FORM_TITLE,
                        description: "PGC-ENR-06-01",
                        category: "Certification",
                        status: "active",
                        fields: [
                            { id: "nom", type: "text", label: "Nom", required: true },
                            { id: "prenom", type: "text", label: "Prénom", required: true },
                            { id: "cert", type: "text", label: "Certification souhaitée", required: true },
                            { id: "docs", type: "file_upload", label: "Pièces justificatives", required: true },
                        ],
                    });
                    setFormId(newForm._id || newForm.id);
                }
            } catch {
                setIsError(true);
            } finally {
                setIsLoadingInit(false);
            }
        })();
    }, []);

    const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCvFile(e.target.files[0]);
        }
    };

    const removeCv = () => setCvFile(null);
    const removePieceIdentite = () => setPieceIdentite(null);
    const removeJustificatifExp = () => setJustificatifExp(null);
    const removeDiplomes = () => setDiplomes(null);
    const removeAttestation = () => setAttestationFormation(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log("Submit trigger:", { formId, cvFile: !!cvFile, certification, examMode, examType });
        if (!formId || !cvFile || !certification || !examMode || !examType) {
            console.error("Missing required data for submission.");
            setValidationError("Une erreur est survenue avec le formulaire. Veuillez rafraîchir la page.");
            return;
        }

        // Attestation de formation requise uniquement pour « examen direct ».
        if (examType === "direct" && !attestationFormation) {
            setValidationError("L'attestation de formation est obligatoire pour un examen direct.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload CV
            const cvFd = new FormData();
            cvFd.append("files", cvFile);
            const cvUpload = await uploadFiles(cvFd);
            const cvUrl = cvUpload.file_urls?.[0] || "";

            // Upload others
            let otherUrls: string[] = [];
            let pieceUrl = "";
            let justifxUrl = "";
            let diplomesUrl = "";
            let attestationUrl = "";

            if (pieceIdentite || justificatifExp || diplomes || attestationFormation) {
                const otherFd = new FormData();
                if (pieceIdentite) otherFd.append("files", pieceIdentite);
                if (justificatifExp) otherFd.append("files", justificatifExp);
                if (diplomes) otherFd.append("files", diplomes);
                if (attestationFormation) otherFd.append("files", attestationFormation);

                const otherUpload = await uploadFiles(otherFd);
                const urls = otherUpload.file_urls || [];

                // Maps urls back based on what was included (maintaining order)
                let urlIndex = 0;
                if (pieceIdentite) { pieceUrl = urls[urlIndex++]; otherUrls.push(pieceUrl); }
                if (justificatifExp) { justifxUrl = urls[urlIndex++]; otherUrls.push(justifxUrl); }
                if (diplomes) { diplomesUrl = urls[urlIndex++]; otherUrls.push(diplomesUrl); }
                if (attestationFormation) { attestationUrl = urls[urlIndex++]; otherUrls.push(attestationUrl); }
            }

            const allFileUrls = [cvUrl, ...otherUrls];

            const examModeLabel = examMode === "online" ? "En ligne" : "Présentiel";
            const examTypeLabel = examType === "direct" ? "Examen direct" : "Examen après formation IRISQ";

            await submitResponse(formId, {
                form_id: formId,
                session_id: sessionId || undefined,
                name: `${prenom} ${nom}`.trim(),
                email,
                profile: "Candidat à la Certification",
                exam_mode: examMode,
                exam_type: examType,
                answers: {
                    Nom: nom,
                    Prénom: prenom,
                    "Date de naissance": dateNaissance,
                    "Lieu de naissance": lieuNaissance,
                    Nationalité: nationalite,
                    Adresse: adresse,
                    Téléphone: telephone,
                    Email: email,
                    "Expérience (années)": anneesExperience,
                    "Certification souhaitée": certification,
                    "Mode d'examen": examModeLabel,
                    "Type d'examen": examTypeLabel,
                    "CV": [cvUrl],
                    "Pièce d'identité": pieceUrl ? [pieceUrl] : [],
                    "Justificatif d'expérience": justifxUrl ? [justifxUrl] : [],
                    "Diplômes": diplomesUrl ? [diplomesUrl] : [],
                    "Attestation de formation": attestationUrl ? [attestationUrl] : [],
                    "Autres documents": otherUrls,
                    "Pièces justificatives": allFileUrls,
                    "Aménagement spécifique": amenagement,
                    "Détails aménagement": amenagement === "Oui" ? amenagementDetails : "N/A",
                    "Déclaration acceptée": declarationActive,
                },
            });
            setIsSuccess(true);
            router.replace("/");
        } catch (error: any) {
            console.error("Submission error Details:", error);
            alert(`Une erreur est survenue lors de l'envoi : ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const validateStep = (s: number) => {
        if (s === 1) {
            const identityOk = nom.trim() !== "" && prenom.trim() !== "" && dateNaissance !== "";
            const contactOk = telephone.trim() !== "" && email.trim() !== "" && anneesExperience.trim() !== "";
            return identityOk && contactOk;
        }
        if (s === 2) return certification !== "" && (sessions.length === 0 || sessionId !== "");
        if (s === 3) return examMode !== "" && examType !== "";
        if (s === 4) {
            const baseOk = cvFile !== null && pieceIdentite !== null && justificatifExp !== null && diplomes !== null;
            // Attestation de formation obligatoire pour un examen direct.
            if (examType === "direct" && !attestationFormation) return false;
            return baseOk;
        }
        if (s === 5) {
            if (!amenagement) return false;
            if (amenagement === "Oui" && amenagementDetails.trim() === "") return false;
            return true;
        }
        if (s === 6) return declarationActive;
        return true;
    };

    const handleNext = () => {
        if (validateStep(step)) {
            setValidationError("");
            setStep(s => Math.min(STEPS.length, s + 1));
        } else {
            setValidationError("Veuillez remplir tous les champs obligatoires avant de continuer.");
        }
    };

    // ── Loading ──
    if (isLoadingInit) return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: "#f4f6f9" }}>
            <Loader2 className="h-8 w-8 animate-spin mb-4" style={{ color: "#2e7d32" }} />
            <p className="text-sm text-gray-400 font-medium">Initialisation du formulaire…</p>
        </div>
    );

    // ── Error ──
    if (isError) return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f4f6f9" }}>
            <div className="bg-white p-10 rounded-2xl border shadow-sm text-center max-w-md w-full" style={{ borderColor: "#fecaca" }}>
                <AlertCircle className="h-14 w-14 mx-auto mb-5" style={{ color: "#c62828" }} />
                <h1 className="text-xl font-extrabold mb-3" style={{ color: "#1a237e" }}>Service indisponible</h1>
                <p className="text-gray-400 text-sm mb-7">
                    Impossible de joindre le serveur. Veuillez patienter ou contacter l'administration.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-8 py-3 rounded-xl text-white font-bold text-sm transition hover:-translate-y-0.5"
                    style={{ backgroundColor: "#1a237e" }}
                >
                    Réessayer
                </button>
            </div>
        </div>
    );

    // ── Success ──
    if (isSuccess) return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f4f6f9" }}>
            <motion.div
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-10 rounded-2xl border shadow-sm text-center max-w-md w-full"
                style={{ borderColor: "#c8e6c9" }}
            >
                <div className="flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-16 w-16" style={{ color: "#2e7d32" }} />
                </div>
                <h1 className="text-2xl font-extrabold mb-3" style={{ color: "#1a237e" }}>Demande envoyée !</h1>
                <p className="text-gray-400 text-sm mb-8">
                    Votre demande de certification a été enregistrée. Notre équipe examinera vos pièces justificatives sous 48h.
                </p>
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex-1 h-px" style={{ backgroundColor: "#e0e0e0" }} />
                    <span className="w-2 h-2 rotate-45" style={{ backgroundColor: "#c62828", display: "inline-block" }} />
                    <div className="flex-1 h-px" style={{ backgroundColor: "#e0e0e0" }} />
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="text-sm font-bold hover:underline"
                    style={{ color: "#2e7d32" }}
                >
                    Soumettre une autre demande →
                </button>
            </motion.div>
        </div>
    );

    const progress = ((step - 1) / (STEPS.length - 1)) * 100;

    return (
        <div className="min-h-screen py-10 px-4 sm:px-6" style={{ backgroundColor: "#f4f6f9" }}>
            <div className="max-w-2xl mx-auto space-y-6">

                {/* ── En-tête ── */}
                <div className="flex flex-col items-center text-center gap-2">
                    {/* Logo grand */}
                    <div className="w-28 h-28 flex items-center justify-center drop-shadow-xl">
                        <Image
                            src="/logo.png"
                            alt="IRISQ"
                            width={112}
                            height={112}
                            className="object-contain w-full h-full"
                            priority
                        />
                    </div>
                    {/* Nom juste sous le logo */}
                    <span
                        className="text-[11px] font-extrabold tracking-[0.22em] uppercase"
                        style={{ color: "#1a237e" }}
                    >
                        IRISQ-CERTIFICATIONS
                    </span>
                    {/* Titre formulaire */}
                    <h1
                        className="text-xl font-extrabold tracking-tight mt-1"
                        style={{ color: "#1a237e" }}
                    >
                        Formulaire de demande de certification
                    </h1>
                </div>

                {/* ── Stepper ── */}
                <div className="bg-white rounded-2xl border shadow-sm p-5" style={{ borderColor: "#e8eaf6" }}>
                    {/* Barre de progression */}
                    <div className="relative h-1.5 rounded-full mb-5 overflow-hidden" style={{ backgroundColor: "#e8eaf6" }}>
                        <motion.div
                            className="absolute left-0 top-0 h-full rounded-full"
                            style={{ backgroundColor: "#2e7d32" }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.4 }}
                        />
                    </div>
                    {/* Icônes des étapes */}
                    <div className="flex items-center justify-between">
                        {STEPS.map((s) => {
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

                {/* ── Contenu étape ── */}
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
                            {/* Header étape */}
                            <div className="px-6 py-4 flex items-center gap-2" style={{ backgroundColor: "#1a237e" }}>
                                {(() => { const Icon = STEPS[step - 1].icon; return <Icon className="h-4 w-4 text-white/80" />; })()}
                                <h2 className="text-sm font-bold uppercase tracking-widest text-white">
                                    Étape {step} — {STEPS[step - 1].label}
                                </h2>
                                <span className="ml-auto text-white/40 text-xs">{step} / {STEPS.length}</span>
                            </div>

                            <div className="p-6 space-y-5">

                                {/* ÉTAPE 1 — Identité & Contact */}
                                {step === 1 && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Nom <span className="text-[#c62828]">*</span></label>
                                            <input type="text" value={nom} onChange={e => { setNom(e.target.value); setValidationError("") }} className={inputClass()} placeholder="Dupont" />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Prénom <span className="text-[#c62828]">*</span></label>
                                            <input type="text" value={prenom} onChange={e => { setPrenom(e.target.value); setValidationError("") }} className={inputClass()} placeholder="Jean" />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Date de naissance <span className="text-[#c62828]">*</span></label>
                                            <input type="date" value={dateNaissance} onChange={e => { setDateNaissance(e.target.value); setValidationError("") }} className={inputClass()} />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Lieu de naissance</label>
                                            <input type="text" value={lieuNaissance} onChange={e => setLieuNaissance(e.target.value)} className={inputClass()} placeholder="Dakar" />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Nationalité</label>
                                            <input type="text" value={nationalite} onChange={e => setNationalite(e.target.value)} className={inputClass()} placeholder="Sénégalaise" />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Téléphone <span className="text-[#c62828]">*</span></label>
                                            <input type="tel" value={telephone} onChange={e => { setTelephone(e.target.value); setValidationError("") }} className={inputClass()} placeholder="70 123 45 67" />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>E-mail <span className="text-[#c62828]">*</span></label>
                                            <input type="email" value={email} onChange={e => { setEmail(e.target.value); setValidationError("") }} className={inputClass()} placeholder="vous@exemple.com" />
                                        </div>
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Années d&apos;expérience <span className="text-[#c62828]">*</span></label>
                                            <input type="number" min="0" value={anneesExperience} onChange={e => { setAnneesExperience(e.target.value); setValidationError("") }} className={inputClass()} placeholder="ex: 3" />
                                            <p className="text-[11px] text-gray-400 mt-1">Années de mise en œuvre de la norme demandée</p>
                                        </div>
                                        <div className="sm:col-span-2">
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Adresse</label>
                                            <textarea
                                                value={adresse}
                                                onChange={e => setAdresse(e.target.value)}
                                                className={inputClass() + " resize-none"}
                                                rows={2}
                                                placeholder="Rue, Ville, Pays"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ÉTAPE 2 — Certification */}
                                {step === 2 && (
                                    <div className="space-y-5">
                                        {sessions.length > 0 && (
                                            <div>
                                                <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                    Session <span className="text-[#c62828]">*</span>
                                                </label>
                                                <p className="text-[11px] text-gray-400 mb-2">
                                                    Sélectionnez la session pour laquelle vous souhaitez postuler.
                                                </p>
                                                <select
                                                    value={sessionId}
                                                    onChange={e => { setSessionId(e.target.value); setValidationError(""); }}
                                                    className={inputClass()}
                                                >
                                                    <option value="">— Choisir une session —</option>
                                                    {sessions.map(s => (
                                                        <option key={s._id} value={s._id}>
                                                            {s.name}
                                                            {s.start_date ? ` — ${s.start_date}` : ""}
                                                            {s.end_date ? ` → ${s.end_date}` : ""}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                        <p className="text-xs text-gray-400 mb-4">Sélectionnez la certification que vous souhaitez obtenir.</p>
                                        {CERTIFICATIONS.map((cert) => {
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
                                                        onChange={() => { setCertification(cert); setValidationError("") }}
                                                        className="w-4 h-4 shrink-0"
                                                    />
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                        {selected && (
                                                            <span className="w-2 h-2 rotate-45 shrink-0" style={{ backgroundColor: "#c62828", display: "inline-block" }} />
                                                        )}
                                                        <span className="text-sm font-semibold" style={{ color: selected ? color : "#555" }}>
                                                            {cert}
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                        </div>
                                    </div>
                                )}

                                {/* ÉTAPE 3 — Choix de l'examen (mode + type) */}
                                {step === 3 && (
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#1a237e" }}>
                                                Mode d&apos;examen <span className="text-[#c62828]">*</span>
                                            </p>
                                            <p className="text-[11px] text-gray-400 mb-3">
                                                Choisissez le format de passage de votre examen. Le code dossier reflétera votre choix.
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
                                                            className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all"
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
                                                                onChange={() => { setExamMode(opt.value as "online" | "onsite"); setValidationError(""); }}
                                                                className="mt-1 w-4 h-4 shrink-0"
                                                            />
                                                            <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: opt.color }} />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold" style={{ color: selected ? opt.color : "#1a237e" }}>
                                                                    {opt.label}
                                                                </p>
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
                                            <p className="text-[11px] text-gray-400 mb-3">
                                                Passez directement l&apos;examen si vous êtes déjà formé(e), ou suivez la formation IRISQ au préalable.
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {[
                                                    { value: "direct", label: "Examen direct", hint: "Attestation de formation obligatoire sur la norme choisie.", icon: Award, color: "#b45309" },
                                                    { value: "after_formation", label: "Examen après formation IRISQ", hint: "IRISQ vous forme avant de passer l'examen.", icon: GraduationCap, color: "#2e7d32" },
                                                ].map(opt => {
                                                    const Icon = opt.icon;
                                                    const selected = examType === opt.value;
                                                    return (
                                                        <label
                                                            key={opt.value}
                                                            className="flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all"
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
                                                                onChange={() => { setExamType(opt.value as "direct" | "after_formation"); setValidationError(""); }}
                                                                className="mt-1 w-4 h-4 shrink-0"
                                                            />
                                                            <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: opt.color }} />
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-bold" style={{ color: selected ? opt.color : "#1a237e" }}>
                                                                    {opt.label}
                                                                </p>
                                                                <p className="text-[11px] text-gray-500 mt-0.5">{opt.hint}</p>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {examType && (
                                            <div
                                                className="p-3 rounded-xl border text-xs"
                                                style={{
                                                    backgroundColor: examType === "direct" ? "#fff8e1" : "#e8f5e9",
                                                    borderColor: examType === "direct" ? "#ffe0b2" : "#c8e6c9",
                                                    color: examType === "direct" ? "#b45309" : "#2e7d32",
                                                }}
                                            >
                                                {examType === "direct"
                                                    ? "À l'étape suivante, joignez impérativement votre attestation de formation sur la norme choisie."
                                                    : "À l'étape suivante, vous pourrez joindre une attestation de formation si vous en possédez déjà une (facultatif)."}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* ÉTAPE 4 — Documents */}
                                {step === 4 && (
                                    <div className="space-y-4">
                                        {/* Info box */}
                                        <div className="p-4 rounded-xl border space-y-1.5" style={{ backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}>
                                            <p className="font-bold text-xs uppercase tracking-widest mb-2" style={{ color: "#1a237e" }}>
                                                Documents requis :
                                            </p>
                                            {[
                                                "Pièce d'identité valide (CNI, passeport, permis)",
                                                "CV détaillé avec formations et expériences",
                                                "Justificatif d'accompagnement ou déploiement système de management (2 ans Implementor / 5 ans Lead)",
                                                "Justificatif d'expérience en laboratoire (ISO 17025)",
                                                "Copies diplômes / attestations de formation",
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <span className="mt-1.5 w-1.5 h-1.5 rotate-45 shrink-0" style={{ backgroundColor: "#c62828", display: "inline-block" }} />
                                                    <span className="text-xs text-gray-600">{item}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Zone de dépôt CV */}
                                        <div className="mb-6">
                                            <p className="text-sm font-bold text-[#1a237e] mb-2">1. Votre Curriculum Vitae (CV) <span className="text-[#c62828]">*</span></p>
                                            {!cvFile ? (
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                    <Upload className="h-8 w-8 mb-3 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-600">Déposez votre CV ici</span>
                                                    <span className="text-xs text-gray-400 mt-1">Format PDF, DOCX (Max 5MB)</span>
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { handleCvChange(e); setValidationError("") }} />
                                                </label>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                                                            <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{cvFile.name}</p>
                                                            <p className="text-[10px] text-gray-400">{(cvFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={removeCv} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><X className="h-4 w-4" style={{ color: "#c62828" }} /></button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Zone de dépôt Pièce Identité */}
                                        <div className="mb-6">
                                            <p className="text-sm font-bold text-[#1a237e] mb-2">2. Pièce d'identité valide (CNI, Passeport) <span className="text-[#c62828]">*</span></p>
                                            {!pieceIdentite ? (
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                    <Upload className="h-6 w-6 mb-2 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-600">Déposez votre Pièce d'identité</span>
                                                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files) setPieceIdentite(e.target.files[0]); setValidationError(""); }} />
                                                </label>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                                                            <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{pieceIdentite.name}</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={removePieceIdentite} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><X className="h-4 w-4" style={{ color: "#c62828" }} /></button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Zone de dépôt Justificatif Expérience */}
                                        <div className="mb-6">
                                            <p className="text-sm font-bold text-[#1a237e] mb-2">3. Justificatif d'expérience (Système Management / Labo) <span className="text-[#c62828]">*</span></p>
                                            {!justificatifExp ? (
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                    <Upload className="h-6 w-6 mb-2 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-600">Déposez votre Justificatif d'expérience</span>
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files) setJustificatifExp(e.target.files[0]); setValidationError(""); }} />
                                                </label>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                                                            <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{justificatifExp.name}</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={removeJustificatifExp} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><X className="h-4 w-4" style={{ color: "#c62828" }} /></button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Zone de dépôt Diplômes */}
                                        <div className="mb-6">
                                            <p className="text-sm font-bold text-[#1a237e] mb-2">4. Copies des diplômes / attestations <span className="text-[#c62828]">*</span></p>
                                            {!diplomes ? (
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                    <Upload className="h-6 w-6 mb-2 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-600">Déposez vos Diplômes</span>
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files) setDiplomes(e.target.files[0]); setValidationError(""); }} />
                                                </label>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                                                            <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{diplomes.name}</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={removeDiplomes} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><X className="h-4 w-4" style={{ color: "#c62828" }} /></button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Zone de dépôt Attestation de formation — conditionnelle au type d'examen */}
                                        <div className="mb-2">
                                            <p className="text-sm font-bold text-[#1a237e] mb-1 flex items-center gap-2">
                                                5. Attestation de formation sur la norme choisie
                                                {examType === "direct" ? (
                                                    <span className="text-[#c62828]">*</span>
                                                ) : (
                                                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>
                                                        Facultatif
                                                    </span>
                                                )}
                                            </p>
                                            <p className="text-[11px] text-gray-400 mb-2">
                                                {examType === "direct"
                                                    ? "Obligatoire pour un examen direct : attestation prouvant votre formation sur la norme sélectionnée."
                                                    : examType === "after_formation"
                                                        ? "Optionnel : si vous avez déjà suivi une formation, joignez votre attestation. Sinon, IRISQ vous formera."
                                                        : "Choisissez d'abord un type d'examen à l'étape précédente."}
                                            </p>
                                            {!attestationFormation ? (
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                    <Upload className="h-6 w-6 mb-2 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-600">Déposez votre Attestation de formation</span>
                                                    <span className="text-[10px] text-gray-400 mt-1">PDF, DOCX, JPG, PNG</span>
                                                    <input type="file" className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => { if (e.target.files) setAttestationFormation(e.target.files[0]); setValidationError(""); }} />
                                                </label>
                                            ) : (
                                                <div className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                                                            <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-bold text-gray-700 truncate">{attestationFormation.name}</p>
                                                        </div>
                                                    </div>
                                                    <button type="button" onClick={removeAttestation} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><X className="h-4 w-4" style={{ color: "#c62828" }} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* ÉTAPE 5 — Aménagement */}
                                {step === 5 && (
                                    <div className="space-y-5">
                                        <p className="text-sm text-gray-500 leading-relaxed">
                                            Avez-vous des besoins d'aménagement spécifique relatifs à l'accessibilité, l'éclairage, la température ou l'aération de la salle d'examen ?
                                        </p>
                                        <div className="flex gap-4">
                                            {(["Oui", "Non"] as const).map(val => (
                                                <label
                                                    key={val}
                                                    className="flex items-center gap-2.5 cursor-pointer px-5 py-3 rounded-xl border font-bold text-sm transition-all"
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
                                                        onChange={() => { setAmenagement(val); setValidationError("") }}
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
                                                    onChange={e => { setAmenagementDetails(e.target.value); setValidationError("") }}
                                                    className={inputClass() + " resize-none"}
                                                    rows={3}
                                                    placeholder="Décrivez vos besoins spécifiques…"
                                                />
                                            </motion.div>
                                        )}
                                    </div>
                                )}

                                {/* ÉTAPE 6 — Déclaration */}
                                {step === 6 && (
                                    <div className="space-y-5">
                                        <label
                                            className="flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-all"
                                            style={{
                                                borderColor: declarationActive ? "#2e7d32" : "#e0e0e0",
                                                backgroundColor: declarationActive ? "#e8f5e9" : "#f4f6f9",
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={declarationActive}
                                                onChange={e => { setDeclarationActive(e.target.checked); setValidationError("") }}
                                                className="w-5 h-5 mt-0.5 shrink-0"
                                            />
                                            <span className="text-sm text-gray-700 leading-relaxed">
                                                Je déclare que, à ma connaissance, toutes les informations fournies dans la présente demande ainsi que ses pièces jointes sont vraies, correctes, complètes et à jour. J'autorise par la présente IRISQ Certification à procéder à toutes les vérifications nécessaires.
                                            </span>
                                        </label>

                                        {/* Récapitulatif */}
                                        <div className="p-4 rounded-xl border space-y-2" style={{ backgroundColor: "#e8eaf6", borderColor: "#c5cae9" }}>
                                            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{ color: "#1a237e" }}>
                                                Récapitulatif
                                            </p>
                                            {[
                                                ["Nom complet", `${prenom} ${nom}`],
                                                ["Certification", certification || "Non sélectionnée"],
                                                ["Mode d'examen", examMode === "online" ? "En ligne" : examMode === "onsite" ? "Présentiel" : "Non choisi"],
                                                ["Type d'examen", examType === "direct" ? "Examen direct" : examType === "after_formation" ? "Après formation IRISQ" : "Non choisi"],
                                                ["Email", email],
                                                ["CV", cvFile ? "Uploadé" : "Manquant"],
                                                ["Pièce Identité", pieceIdentite ? "Uploadé" : "Manquant"],
                                                ["Justificatif Expérience", justificatifExp ? "Uploadé" : "Manquant"],
                                                ["Diplômes", diplomes ? "Uploadé" : "Manquant"],
                                                ["Attestation formation", attestationFormation ? "Uploadé" : (examType === "direct" ? "Manquant" : "Non fourni")],
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
                        {validationError && (
                            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-bold w-full text-center text-red-600 bg-red-50 py-2 rounded-lg">
                                {validationError}
                            </motion.div>
                        )}
                        <div className="flex items-center justify-between w-full">
                            <button
                                type="button"
                                onClick={() => { setStep(s => Math.max(1, s - 1)); setValidationError(""); }}
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
                                    disabled={isSubmitting || !declarationActive}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    style={{ backgroundColor: "#2e7d32", boxShadow: "0 6px 16px rgba(46,125,50,0.28)" }}
                                >
                                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {isSubmitting ? "Envoi…" : "Soumettre la demande"}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="flex flex-col items-center gap-1 mt-6">
                        <div className="flex items-center gap-3 w-40">
                            <div className="flex-1 h-px" style={{ backgroundColor: "#2e7d32" }} />
                            <span className="w-2 h-2 rotate-45 shrink-0" style={{ backgroundColor: "#c62828", display: "inline-block" }} />
                            <div className="flex-1 h-px" style={{ backgroundColor: "#2e7d32" }} />
                        </div>
                        <span className="text-[10px] font-extrabold tracking-[0.22em] uppercase" style={{ color: "#1a237e" }}>
                            IRISQ-CERTIFICATIONS
                        </span>
                        <p className="text-[10px] text-gray-400">
                            © {new Date().getFullYear()} — Tous droits réservés
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
}