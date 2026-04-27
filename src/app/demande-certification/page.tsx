"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    CheckCircle2, Loader2, Upload, X, File as FileIcon,
    AlertCircle, ChevronRight, ChevronLeft, User, Phone,
    Award, FileText, Shield, Wrench, Monitor, MapPin, GraduationCap,
    Info
} from "lucide-react";
import Image from "next/image";
import { fetchForms, createForm, submitResponse, uploadFiles, fetchSessions, checkSessionEligibility, checkEmailEligibility, type Session } from "@/lib/api";

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
    "Junior Implementor ISO 45001:2018",
    "Implementor ISO 45001:2018",
    "Lead Implementor ISO 45001:2018",
];

// ── Filtering logic based on years of experience ────────────────────────────
// < 2 ans  → Junior only
// 2 – 5 ans → Implementor only
// > 5 ans  → all
function getEligibleCertifications(yearsStr: string): string[] {
    const n = Number(yearsStr);
    if (!Number.isFinite(n) || n < 0 || yearsStr.trim() === "") return CERTIFICATIONS;
    if (n < 2) return CERTIFICATIONS.filter(c => c.startsWith("Junior"));
    if (n < 5) return CERTIFICATIONS.filter(c => c.startsWith("Junior") || c.startsWith("Implementor"));
    return CERTIFICATIONS; // n >= 5
}

const FORM_TITLE = "Fiche de demande - IRISQ CERTIFICATION";

const STEPS = [
    { id: 1, label: "Identité & contact", icon: User },
    { id: 2, label: "Certification", icon: Award },
    { id: 3, label: "Examen", icon: Monitor },
    { id: 4, label: "Documents", icon: FileText },
    { id: 5, label: "Aménagement", icon: Wrench },
    { id: 6, label: "Déclaration", icon: Shield },
];

function inputClass(hasError = false) {
    return `w-full bg-[#f4f6f9] border rounded-xl px-4 py-3 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none transition-all ${hasError
        ? "border-[#c62828] focus:border-[#c62828] bg-red-50"
        : "border-[#e0e0e0] focus:border-[#2e7d32]"
        }`;
}
function labelClass() {
    return "block text-xs font-bold uppercase tracking-widest mb-1.5";
}

// ─────────────────────────────────────────────────────────
// VALIDATEURS — un validateur par champ, renvoie "" si OK
// ou un message d'erreur en français sinon.
// ─────────────────────────────────────────────────────────
const NAME_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-']+$/;
const CITY_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ\s\-',.]+$/;
const PHONE_REGEX = /^[\d\s\+\-\(\)\.]+$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const validators = {
    nom: (v: string): string => {
        if (!v.trim()) return "Le nom est obligatoire.";
        if (!NAME_REGEX.test(v)) return "Le nom ne doit contenir que des lettres (pas de chiffres).";
        if (v.trim().length < 2) return "Le nom doit contenir au moins 2 caractères.";
        if (v.trim().length > 50) return "Le nom est trop long (50 caractères maximum).";
        return "";
    },
    prenom: (v: string): string => {
        if (!v.trim()) return "Le prénom est obligatoire.";
        if (!NAME_REGEX.test(v)) return "Le prénom ne doit contenir que des lettres (pas de chiffres).";
        if (v.trim().length < 2) return "Le prénom doit contenir au moins 2 caractères.";
        if (v.trim().length > 50) return "Le prénom est trop long (50 caractères maximum).";
        return "";
    },
    dateNaissance: (v: string): string => {
        if (!v) return "La date de naissance est obligatoire.";
        const d = new Date(v);
        if (isNaN(d.getTime())) return "Date invalide.";
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (d > today) return "La date de naissance ne peut pas être dans le futur.";
        const age = today.getFullYear() - d.getFullYear() -
            (today < new Date(today.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
        if (age < 16) return "Vous devez avoir au moins 16 ans.";
        if (age > 100) return "Veuillez saisir une date de naissance valide.";
        return "";
    },
    lieuNaissance: (v: string): string => {
        if (!v.trim()) return ""; // champ optionnel
        if (!CITY_REGEX.test(v)) return "Le lieu ne doit contenir que des lettres.";
        if (v.trim().length > 80) return "Lieu trop long (80 caractères maximum).";
        return "";
    },
    nationalite: (v: string): string => {
        if (!v.trim()) return "La nationalité est obligatoire.";
        if (!NAME_REGEX.test(v)) return "La nationalité ne doit contenir que des lettres.";
        if (v.trim().length > 50) return "Trop long (50 caractères maximum).";
        return "";
    },
    telephone: (v: string): string => {
        if (!v.trim()) return "Le téléphone est obligatoire.";
        if (!PHONE_REGEX.test(v)) return "Le téléphone ne doit contenir que des chiffres, +, -, espaces ou parenthèses.";
        const digits = v.replace(/\D/g, "");
        if (digits.length < 7) return "Numéro de téléphone trop court (min. 7 chiffres).";
        if (digits.length > 15) return "Numéro de téléphone trop long (max. 15 chiffres).";
        return "";
    },
    email: (v: string): string => {
        if (!v.trim()) return "L'email est obligatoire.";
        if (!EMAIL_REGEX.test(v.trim())) return "Format d'email invalide (ex : prenom.nom@domaine.com).";
        if (v.length > 120) return "Email trop long.";
        return "";
    },
    anneesExperience: (v: string): string => {
        if (!v.toString().trim()) return "Les années d'expérience sont obligatoires.";
        const n = Number(v);
        if (!Number.isFinite(n)) return "Veuillez saisir un nombre valide.";
        if (!Number.isInteger(n)) return "Veuillez saisir un nombre entier.";
        if (n < 0) return "La valeur ne peut pas être négative.";
        if (n > 70) return "Valeur trop élevée (max. 70).";
        return "";
    },
    adresse: (v: string): string => {
        if (!v.trim()) return ""; // champ optionnel
        if (v.trim().length > 200) return "Adresse trop longue (200 caractères maximum).";
        return "";
    },
    amenagementDetails: (v: string): string => {
        if (!v.trim()) return "Veuillez décrire vos besoins d'aménagement.";
        if (v.trim().length < 10) return "Merci de préciser davantage (au moins 10 caractères).";
        return "";
    },
} as const;

type FieldName = keyof typeof validators;

// Petit composant pour afficher le message d'erreur sous le label.
function FieldError({ message }: { message?: string }) {
    if (!message) return null;
    return (
        <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[#c62828] mb-1.5"
        >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {message}
        </motion.p>
    );
}

const FORM_ID_CACHE_KEY = "irisq_form_id";

export default function DemandeCertificationPage() {
    const router = useRouter();
    const [formId, setFormId] = useState<string | null>(() => {
        if (typeof window !== "undefined") return localStorage.getItem(FORM_ID_CACHE_KEY);
        return null;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isError, setIsError] = useState(false);

    const [sessionBlock, setSessionBlock] = useState<{ code: "ALREADY_APPLIED" | "APPLICATION_REJECTED"; message: string } | null>(null);
    // Informational warning: already has a candidature for a DIFFERENT certification
    const [existingAppWarning, setExistingAppWarning] = useState<{ certs: string[]; message: string } | null>(null);

    const [isLoadingSessions, setIsLoadingSessions] = useState(true);
    // Spinner while the email eligibility check is in-flight
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    // Modal "critères d'expérience"
    const [showExperienceModal, setShowExperienceModal] = useState(false);
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
    // Multi-select : jusqu'à 2 certifications par session
    const [certifications, setCertifications] = useState<string[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [sessionId, setSessionId] = useState<string>("");
    const [examMode, setExamMode] = useState<"online" | "onsite" | "">("");
    const [examType, setExamType] = useState<"direct" | "after_formation" | "">("");
    const [cvFile, setCvFile] = useState<File | null>(null);
    const [pieceIdentite, setPieceIdentite] = useState<File | null>(null);
    const [justificatifExp, setJustificatifExp] = useState<File[]>([]);
    const [diplomes, setDiplomes] = useState<File[]>([]);
    const [attestationFormation, setAttestationFormation] = useState<File | null>(null);
    const [amenagement, setAmenagement] = useState<"Oui" | "Non" | "">("");
    const [amenagementDetails, setAmenagementDetails] = useState("");
    const [declarationActive, setDeclarationActive] = useState(false);

    // Erreur globale (bannière)
    const [validationError, setValidationError] = useState("");
    // Erreurs par champ — affichées juste au-dessus de l'input concerné
    const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

    // Helper : met à jour un champ et relance sa validation
    const handleField = <K extends FieldName>(
        name: K,
        value: string,
        setter: (v: string) => void
    ) => {
        setter(value);
        const err = validators[name](value);
        setFieldErrors(prev => ({ ...prev, [name]: err }));
        setValidationError("");
    };

    // Fired on email field blur — checks across all active sessions.
    // Hard block on APPLICATION_REJECTED; informational warning when already applied to a different cert.
    const handleEmailBlur = async (value: string) => {
        handleField("email", value, setEmail);
        if (validators.email(value)) return;
        setIsCheckingEmail(true);
        setExistingAppWarning(null);
        try {
            // At step 1 certification is not yet chosen — pass first selected if any
            const result = await checkEmailEligibility(value, certifications[0] ?? null);
            if (!result.eligible && result.code === "APPLICATION_REJECTED") {
                setSessionBlock({ code: "APPLICATION_REJECTED", message: result.message || "" });
            } else if (!result.eligible && result.code === "ALREADY_APPLIED") {
                setSessionBlock({ code: "ALREADY_APPLIED", message: result.message || "" });
            } else if (result.code === "HAS_OTHER_APPLICATION" || result.code === "HAS_EXISTING_APPLICATION") {
                setExistingAppWarning({
                    certs: result.existing_certifications || [],
                    message: result.message || "",
                });
            }
        } catch {
            // Network failure is non-blocking — backend guards at submit
        } finally {
            setIsCheckingEmail(false);
        }
    };

    // When years change, remove any selected certification that falls outside the new eligible list
    const handleAnneesChange = (value: string) => {
        handleField("anneesExperience", value, setAnneesExperience);
        const eligible = getEligibleCertifications(value);
        setCertifications(prev => prev.filter(c => eligible.includes(c)));
    };

    const toggleCertification = (cert: string, eligible: string[]) => {
        if (!eligible.includes(cert)) return;
        setCertifications(prev => {
            if (prev.includes(cert)) return prev.filter(c => c !== cert);
            if (prev.length >= 2) return prev; // max 2
            return [...prev, cert];
        });
        setValidationError("");
    };

    // Validation complète d'une étape : renseigne fieldErrors pour tous les
    // champs concernés et renvoie true si tous sont OK.
    const validateStepFields = (s: number): boolean => {
        const newErrors: Partial<Record<FieldName, string>> = { ...fieldErrors };
        let ok = true;

        const check = (name: FieldName, value: string) => {
            const err = validators[name](value);
            newErrors[name] = err;
            if (err) ok = false;
        };

        if (s === 1) {
            check("nom", nom);
            check("prenom", prenom);
            check("dateNaissance", dateNaissance);
            check("lieuNaissance", lieuNaissance);
            check("nationalite", nationalite);
            check("telephone", telephone);
            check("email", email);
            check("adresse", adresse);
        }

        if (s === 5 && amenagement === "Oui") {
            check("amenagementDetails", amenagementDetails);
        }

        setFieldErrors(newErrors);
        return ok;
    };

    useEffect(() => {
        const sessionsPromise = fetchSessions()
            .then(sess => setSessions(sess.filter((s: any) => s.status === "active")))
            .catch(() => {})
            .finally(() => setIsLoadingSessions(false));

        const cachedId = typeof window !== "undefined" ? localStorage.getItem(FORM_ID_CACHE_KEY) : null;

        const formsPromise = cachedId ? Promise.resolve() : (async () => {
            try {
                const forms = await fetchForms();
                const existing = forms.find((f: any) => f.title === FORM_TITLE);
                let id: string;
                if (existing) {
                    id = existing._id;
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
                    id = newForm._id || newForm.id;
                }
                localStorage.setItem(FORM_ID_CACHE_KEY, id);
                setFormId(id);
            } catch {
                setIsError(true);
            }
        })();

        Promise.all([sessionsPromise, formsPromise]);
    }, []);

    const handleCvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setCvFile(e.target.files[0]);
        }
    };

    const removeCv = () => setCvFile(null);
    const removePieceIdentite = () => setPieceIdentite(null);
    const removeJustificatifExp = (index: number) => setJustificatifExp(prev => prev.filter((_, i) => i !== index));
    const addJustificatifsExp = (files: FileList) => {
        const arr = Array.from(files); // converti immédiatement avant tout effacement du input
        setJustificatifExp(prev => [...prev, ...arr]);
        setValidationError("");
    };
    const removeDiplome = (index: number) => setDiplomes(prev => prev.filter((_, i) => i !== index));
    const addDiplomes = (files: FileList) => {
        const arr = Array.from(files); // converti immédiatement avant tout effacement du input
        setDiplomes(prev => [...prev, ...arr]);
        setValidationError("");
    };
    const removeAttestation = () => setAttestationFormation(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Revalide toutes les étapes contenant des champs texte avant l'envoi
        const step1Ok = validateStepFields(1);
        const step5Ok = validateStepFields(5);
        if (!step1Ok) {
            setValidationError("Certains champs d'identité sont invalides. Retournez à l'étape 1 pour les corriger.");
            setStep(1);
            return;
        }
        if (!step5Ok) {
            setValidationError("Veuillez préciser vos besoins d'aménagement.");
            setStep(5);
            return;
        }

        console.log("Submit trigger:", { formId, cvFile: !!cvFile, certifications, examMode, examType });
        if (!formId || !cvFile || certifications.length === 0 || !examMode || !examType) {
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
            // Pre-check eligibility for each selected certification before file uploads
            if (sessionId && email) {
                for (const cert of certifications) {
                    const eligibility = await checkSessionEligibility(sessionId, email, cert);
                    if (!eligibility.eligible && eligibility.code) {
                        setSessionBlock({ code: eligibility.code as "ALREADY_APPLIED" | "APPLICATION_REJECTED", message: eligibility.message || "" });
                        setIsSubmitting(false);
                        return;
                    }
                }
            }

            // Upload all files ONCE — shared across all candidatures
            const cvFd = new FormData();
            cvFd.append("files", cvFile);
            const cvUpload = await uploadFiles(cvFd);
            const cvUrl = cvUpload.file_urls?.[0] || "";

            let otherUrls: string[] = [];
            let pieceUrl = "";
            let justifxUrls: string[] = [];
            let diplomesUrls: string[] = [];
            let attestationUrl = "";

            if (pieceIdentite || justificatifExp.length > 0 || diplomes.length > 0 || attestationFormation) {
                const otherFd = new FormData();
                if (pieceIdentite) otherFd.append("files", pieceIdentite);
                justificatifExp.forEach(f => otherFd.append("files", f));
                diplomes.forEach(f => otherFd.append("files", f));
                if (attestationFormation) otherFd.append("files", attestationFormation);

                const otherUpload = await uploadFiles(otherFd);
                const urls = otherUpload.file_urls || [];

                let urlIndex = 0;
                if (pieceIdentite) { pieceUrl = urls[urlIndex++]; otherUrls.push(pieceUrl); }
                if (justificatifExp.length > 0) {
                    justifxUrls = urls.slice(urlIndex, urlIndex + justificatifExp.length);
                    urlIndex += justificatifExp.length;
                    otherUrls.push(...justifxUrls);
                }
                if (diplomes.length > 0) {
                    diplomesUrls = urls.slice(urlIndex, urlIndex + diplomes.length);
                    urlIndex += diplomes.length;
                    otherUrls.push(...diplomesUrls);
                }
                if (attestationFormation) { attestationUrl = urls[urlIndex++]; otherUrls.push(attestationUrl); }
            }

            const allFileUrls = [cvUrl, ...otherUrls];
            const examModeLabel = examMode === "online" ? "En ligne" : "Présentiel";
            const examTypeLabel = examType === "direct" ? "Examen direct" : "Examen après formation IRISQ";

            // Submit one dossier per selected certification (same files, different cert name)
            // The first submission generates the public_id; subsequent ones reuse it so
            // the candidate has a single matricule for all their certifications in this session.
            let sharedPublicId: string | undefined;
            for (const cert of certifications) {
                const result = await submitResponse(formId, {
                    form_id: formId,
                    session_id: sessionId || undefined,
                    name: `${prenom} ${nom}`.trim(),
                    email,
                    profile: "Candidat à la Certification",
                    exam_mode: examMode,
                    exam_type: examType,
                    public_id: sharedPublicId,
                    answers: {
                        Nom: nom,
                        Prénom: prenom,
                        "Date de naissance": dateNaissance,
                        "Lieu de naissance": lieuNaissance,
                        Nationalité: nationalite,
                        Adresse: adresse,
                        Téléphone: telephone,
                        Email: email,
                        "Années d'expérience sur la norme": anneesExperience,
                        "Certification souhaitée": cert,
                        "Mode d'examen": examModeLabel,
                        "Type d'examen": examTypeLabel,
                        "CV": [cvUrl],
                        "Pièce d'identité": pieceUrl ? [pieceUrl] : [],
                        "Justificatif d'expérience": justifxUrls,
                        "Diplômes": diplomesUrls,
                        "Attestation de formation": attestationUrl ? [attestationUrl] : [],
                        "Autres documents": otherUrls,
                        "Pièces justificatives": allFileUrls,
                        "Aménagement spécifique": amenagement,
                        "Détails aménagement": amenagement === "Oui" ? amenagementDetails : "N/A",
                        "Déclaration acceptée": declarationActive,
                    },
                });
                if (!sharedPublicId && result?.public_id) {
                    sharedPublicId = result.public_id;
                }
            }

            setIsSuccess(true);
            router.replace("/");
        } catch (error: any) {
            console.error("Submission error Details:", error);
            if (error.code === "ALREADY_APPLIED" || error.code === "APPLICATION_REJECTED") {
                setSessionBlock({ code: error.code, message: error.message });
            } else {
                const msg: string = error?.message || "";
                // Message convivial selon le type d'erreur
                if (msg.toLowerCase().includes("type de fichier")) {
                    setValidationError(msg);
                } else if (msg.toLowerCase().includes("volumineux") || msg.toLowerCase().includes("trop grand")) {
                    setValidationError(msg);
                } else if (msg.toLowerCase().includes("erreur serveur") || msg.toLowerCase().includes("500") || msg.toLowerCase().includes("failed")) {
                    setValidationError("Une erreur de connexion est survenue lors de l'envoi des fichiers. Votre connexion a été relancée automatiquement — veuillez réessayer.");
                } else {
                    setValidationError(`Une erreur est survenue lors de l'envoi : ${msg}`);
                }
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const validateStep = (s: number) => {
        if (s === 1) {
            return validateStepFields(1);
        }
        if (s === 2) return !validators.anneesExperience(anneesExperience) && certifications.length > 0 && (sessions.length === 0 || sessionId !== "");
        if (s === 3) return examMode !== "" && examType !== "";
        if (s === 4) {
            const isJunior = certifications.every(c => c.startsWith("Junior"));
            const justifOk = isJunior || justificatifExp.length > 0;
            const baseOk = cvFile !== null && pieceIdentite !== null && justifOk && diplomes.length > 0;
            // Attestation de formation obligatoire pour un examen direct.
            if (examType === "direct" && !attestationFormation) return false;
            return baseOk;
        }
        if (s === 5) {
            if (!amenagement) return false;
            if (amenagement === "Oui") {
                return validateStepFields(5);
            }
            return true;
        }
        if (s === 6) return declarationActive;
        return true;
    };

    const handleStepClick = (targetStep: number) => {
        if (targetStep === step) return;
        if (targetStep < step) {
            // Going back is always free
            setStep(targetStep);
            setValidationError("");
            return;
        }
        // Going forward: validate every step between current and target
        for (let s = step; s < targetStep; s++) {
            if (!validateStep(s)) {
                setValidationError("Veuillez compléter toutes les informations requises avant de passer à cette étape.");
                return;
            }
        }
        setValidationError("");
        setStep(targetStep);
    };

    const handleNext = async () => {
        if (!validateStep(step)) {
            setValidationError("Veuillez corriger les erreurs ci-dessus avant de continuer.");
            return;
        }
        // Pre-check eligibility at step 2 for each selected certification
        if (step === 2 && sessionId && email && certifications.length > 0) {
            try {
                for (const cert of certifications) {
                    const result = await checkSessionEligibility(sessionId, email, cert);
                    if (!result.eligible && result.code) {
                        setSessionBlock({ code: result.code as "ALREADY_APPLIED" | "APPLICATION_REJECTED", message: result.message || "" });
                        return;
                    }
                }
            } catch {
                // eligibility check failure is non-blocking — backend will catch it at submit
            }
        }
        setValidationError("");
        setStep(s => Math.min(STEPS.length, s + 1));
    };

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

    // ── Session block (already applied / rejected) ──
    if (sessionBlock) {
        const isRejected = sessionBlock.code === "APPLICATION_REJECTED";
        return (
            <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#f4f6f9" }}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                    style={{ border: `2px solid ${isRejected ? "#fecaca" : "#c5cae9"}` }}
                >
                    {/* Header */}
                    <div
                        className="px-6 py-4 flex items-center gap-3"
                        style={{ backgroundColor: isRejected ? "#c62828" : "#1a237e" }}
                    >
                        <AlertCircle className="h-5 w-5 text-white/80 shrink-0" />
                        <span className="text-sm font-bold uppercase tracking-widest text-white">
                            {isRejected ? "Candidature rejetée" : "Déjà postulé"}
                        </span>
                    </div>

                    {/* Séparateur losange */}
                    <div className="flex items-center gap-3 px-6 pt-5">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span
                            className="w-2 h-2 rotate-45 inline-block"
                            style={{ backgroundColor: isRejected ? "#c62828" : "#1a237e" }}
                        />
                        <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    {/* Body */}
                    <div className="px-6 py-6 text-center">
                        <div
                            className="h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-5"
                            style={{ backgroundColor: isRejected ? "#fce4ec" : "#e8eaf6" }}
                        >
                            <AlertCircle
                                className="h-8 w-8"
                                style={{ color: isRejected ? "#c62828" : "#1a237e" }}
                            />
                        </div>

                        <p
                            className="text-base font-bold mb-3 leading-snug"
                            style={{ color: isRejected ? "#c62828" : "#1a237e" }}
                        >
                            {isRejected
                                ? "Candidature non éligible"
                                : "Candidature déjà enregistrée"}
                        </p>

                        <p className="text-sm text-gray-500 leading-relaxed mb-6">
                            {sessionBlock.message}
                        </p>

                        {/* Séparateur */}
                        <div className="flex items-center gap-3 mb-6">
                            <div className="flex-1 h-px bg-gray-100" />
                            <span className="w-2 h-2 rotate-45 inline-block" style={{ backgroundColor: "#c62828" }} />
                            <div className="flex-1 h-px bg-gray-100" />
                        </div>

                        <button
                            onClick={() => window.location.replace("/")}
                            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5"
                            style={{
                                backgroundColor: isRejected ? "#c62828" : "#1a237e",
                                boxShadow: `0 6px 16px ${isRejected ? "rgba(198,40,40,0.25)" : "rgba(26,35,126,0.25)"}`,
                            }}
                        >
                            Retour à l&apos;accueil
                        </button>
                    </div>
                </motion.div>
            </div>
        );
    }

    const progress = ((step - 1) / (STEPS.length - 1)) * 100;

    // Date max (aujourd'hui) pour le champ date de naissance
    const todayIso = new Date().toISOString().split("T")[0];

    return (
        <>
        <div className="min-h-screen py-10 px-4 sm:px-6" style={{ backgroundColor: "#f4f6f9" }}>
            <div className="max-w-2xl mx-auto space-y-6">

                {/* ── Bandeau info : candidature existante sur autre certification ── */}
                {existingAppWarning && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-start gap-3 rounded-xl px-4 py-3 border"
                        style={{ backgroundColor: "#fff8e1", borderColor: "#f59e0b" }}
                    >
                        <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#b45309" }} />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "#b45309" }}>
                                Candidature en cours détectée
                            </p>
                            <p className="text-sm text-amber-800 mt-0.5">{existingAppWarning.message}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setExistingAppWarning(null)}
                            className="text-amber-400 hover:text-amber-600 transition-colors shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}

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
                    {/* Icônes des étapes — cliquables */}
                    <div className="flex items-center justify-between">
                        {STEPS.map((s) => {
                            const Icon = s.icon;
                            const done = step > s.id;
                            const active = step === s.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => handleStepClick(s.id)}
                                    className="flex flex-col items-center gap-1 group focus:outline-none"
                                    title={`Aller à l'étape ${s.id} — ${s.label}`}
                                >
                                    <div
                                        className="w-8 h-8 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
                                        style={{
                                            backgroundColor: done ? "#2e7d32" : active ? "#1a237e" : "#f4f6f9",
                                            color: done || active ? "#fff" : "#9ca3af",
                                            border: active ? "2px solid #1a237e" : done ? "2px solid #2e7d32" : "2px solid #e0e0e0",
                                        }}
                                    >
                                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                                    </div>
                                    <span
                                        className="text-[9px] font-bold uppercase tracking-wider hidden sm:block transition-colors"
                                        style={{ color: active ? "#1a237e" : done ? "#2e7d32" : "#9ca3af" }}
                                    >
                                        {s.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ── Contenu étape ── */}
                <form onSubmit={handleSubmit} noValidate>
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
                                        {/* NOM */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Nom <span className="text-[#c62828]">*</span>
                                            </label>
                                            <FieldError message={fieldErrors.nom} />
                                            <input
                                                type="text"
                                                value={nom}
                                                onChange={e => handleField("nom", e.target.value, setNom)}
                                                onBlur={e => handleField("nom", e.target.value, setNom)}
                                                className={inputClass(!!fieldErrors.nom)}
                                                placeholder="Entrez votre nom"
                                                maxLength={50}
                                            />
                                        </div>

                                        {/* PRÉNOM */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Prénom <span className="text-[#c62828]">*</span>
                                            </label>
                                            <FieldError message={fieldErrors.prenom} />
                                            <input
                                                type="text"
                                                value={prenom}
                                                onChange={e => handleField("prenom", e.target.value, setPrenom)}
                                                onBlur={e => handleField("prenom", e.target.value, setPrenom)}
                                                className={inputClass(!!fieldErrors.prenom)}
                                                placeholder="Entrez votre prénom"
                                                maxLength={50}
                                            />
                                        </div>

                                        {/* DATE DE NAISSANCE */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Date de naissance <span className="text-[#c62828]">*</span>
                                            </label>
                                            <FieldError message={fieldErrors.dateNaissance} />
                                            <input
                                                type="date"
                                                value={dateNaissance}
                                                max={todayIso}
                                                onChange={e => handleField("dateNaissance", e.target.value, setDateNaissance)}
                                                onBlur={e => handleField("dateNaissance", e.target.value, setDateNaissance)}
                                                className={inputClass(!!fieldErrors.dateNaissance)}
                                            />
                                        </div>

                                        {/* LIEU DE NAISSANCE */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Lieu de naissance</label>
                                            <FieldError message={fieldErrors.lieuNaissance} />
                                            <input
                                                type="text"
                                                value={lieuNaissance}
                                                onChange={e => handleField("lieuNaissance", e.target.value, setLieuNaissance)}
                                                onBlur={e => handleField("lieuNaissance", e.target.value, setLieuNaissance)}
                                                className={inputClass(!!fieldErrors.lieuNaissance)}
                                                placeholder="Entrez votre lieu de naissance"
                                                maxLength={80}
                                            />
                                        </div>

                                        {/* NATIONALITÉ */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Nationalité <span className="text-[#c62828]">*</span>
                                            </label>
                                            <FieldError message={fieldErrors.nationalite} />
                                            <input
                                                type="text"
                                                value={nationalite}
                                                onChange={e => handleField("nationalite", e.target.value, setNationalite)}
                                                onBlur={e => handleField("nationalite", e.target.value, setNationalite)}
                                                className={inputClass(!!fieldErrors.nationalite)}
                                                placeholder="Entrez votre nationalité"
                                                maxLength={50}
                                            />
                                        </div>

                                        {/* TÉLÉPHONE */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Téléphone <span className="text-[#c62828]">*</span>
                                            </label>
                                            <FieldError message={fieldErrors.telephone} />
                                            <input
                                                type="tel"
                                                inputMode="tel"
                                                value={telephone}
                                                onChange={e => handleField("telephone", e.target.value, setTelephone)}
                                                onBlur={e => handleField("telephone", e.target.value, setTelephone)}
                                                className={inputClass(!!fieldErrors.telephone)}
                                                placeholder="Entrez votre numéro de téléphone"
                                                maxLength={25}
                                            />
                                        </div>

                                        {/* EMAIL */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                E-mail <span className="text-[#c62828]">*</span>
                                            </label>
                                            <FieldError message={fieldErrors.email} />
                                            <div className="relative">
                                                <input
                                                    type="email"
                                                    value={email}
                                                    onChange={e => handleField("email", e.target.value, setEmail)}
                                                    onBlur={e => handleEmailBlur(e.target.value)}
                                                    className={inputClass(!!fieldErrors.email)}
                                                    placeholder="Entrez votre adresse e-mail"
                                                    maxLength={120}
                                                />
                                                {isCheckingEmail && (
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                                                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* ADRESSE */}
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>Adresse</label>
                                            <FieldError message={fieldErrors.adresse} />
                                            <input
                                                type="text"
                                                value={adresse}
                                                onChange={e => handleField("adresse", e.target.value, setAdresse)}
                                                onBlur={e => handleField("adresse", e.target.value, setAdresse)}
                                                className={inputClass(!!fieldErrors.adresse)}
                                                placeholder="Entrez votre adresse"
                                                maxLength={200}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* ÉTAPE 2 — Expérience + Certification */}
                                {step === 2 && (() => {
                                    const eligible = getEligibleCertifications(anneesExperience);
                                    const yearsNum = Number(anneesExperience);
                                    const hasYears = anneesExperience.trim() !== "" && Number.isFinite(yearsNum) && yearsNum >= 0;
                                    return (
                                        <div className="space-y-6">

                                            {/* ── Session — toujours visible ── */}
                                            <div>
                                                <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                    Session <span className="text-[#c62828]">*</span>
                                                </label>
                                                <p className="text-[11px] text-gray-400 mb-2">
                                                    Sélectionnez la session pour laquelle vous souhaitez postuler.
                                                </p>
                                                {isLoadingSessions ? (
                                                    <div className={inputClass() + " flex items-center gap-2 text-gray-400"}>
                                                        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                                                        <span className="text-sm">Chargement des sessions…</span>
                                                    </div>
                                                ) : sessions.length === 0 ? (
                                                    <div
                                                        className="w-full rounded-xl px-4 py-3 text-sm border flex items-center gap-2"
                                                        style={{ backgroundColor: "#fff8e1", borderColor: "#ffe0b2", color: "#b45309" }}
                                                    >
                                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                                        Aucune session active disponible pour le moment.
                                                    </div>
                                                ) : (
                                                    <select
                                                        value={sessionId}
                                                        onChange={e => { setSessionId(e.target.value); setValidationError(""); }}
                                                        className={inputClass(!sessionId && sessions.length > 0 ? false : false)}
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
                                                )}
                                            </div>

                                            {/* ── Années d'expérience sur la norme ── */}
                                            <div>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                        Années d&apos;expérience sur la norme <span className="text-[#c62828]">*</span>
                                                    </label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowExperienceModal(true)}
                                                        title="Voir les critères d'éligibilité"
                                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors hover:bg-gray-50"
                                                        style={{ color: "#555", borderColor: "#e0e0e0" }}
                                                    >
                                                        <Info className="h-3.5 w-3.5 text-gray-400" />
                                                        Critères
                                                    </button>
                                                </div>
                                                <FieldError message={fieldErrors.anneesExperience} />
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="70"
                                                    step="1"
                                                    value={anneesExperience}
                                                    onChange={e => handleAnneesChange(e.target.value)}
                                                    onBlur={e => handleAnneesChange(e.target.value)}
                                                    className={inputClass(!!fieldErrors.anneesExperience)}
                                                    placeholder="Entrez le nombre d'années"
                                                />
                                            </div>

                                            {/* ── Certification filtrée ── */}
                                            <div>
                                                <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                    Certification souhaitée <span className="text-[#c62828]">*</span>
                                                </label>
                                                <p className="text-xs text-gray-400 mb-3">
                                                    {hasYears
                                                        ? "Certifications disponibles selon votre expérience :"
                                                        : "Saisissez d'abord vos années d'expérience pour voir les certifications disponibles."}
                                                </p>
                                                {/* Counter badge */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-xs text-gray-400">
                                                        Vous pouvez sélectionner jusqu&apos;à <strong>2 formations</strong>.
                                                    </span>
                                                    <span
                                                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                                                        style={{
                                                            backgroundColor: certifications.length === 2 ? "#c62828" : "#1a237e",
                                                            color: "#fff",
                                                        }}
                                                    >
                                                        {certifications.length}/2 sélectionnée{certifications.length > 1 ? "s" : ""}
                                                    </span>
                                                </div>
                                                <AnimatePresence mode="wait">
                                                    <motion.div
                                                        key={eligible.join(",")}
                                                        initial={{ opacity: 0, y: 6 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="space-y-2"
                                                    >
                                                        {(hasYears ? eligible : CERTIFICATIONS).map((cert) => {
                                                            const selected = certifications.includes(cert);
                                                            const maxReached = certifications.length >= 2 && !selected;
                                                            const color = cert.includes("17025") ? "#1a237e" : cert.includes("9001") ? "#2e7d32" : cert.includes("45001") ? "#7b1fa2" : "#b45309";
                                                            const isDisabled = (hasYears && !eligible.includes(cert)) || maxReached;
                                                            return (
                                                                <label
                                                                    key={cert}
                                                                    className={`flex items-center gap-4 p-3.5 rounded-xl border transition-all ${isDisabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                                                                    style={{
                                                                        borderColor: selected ? color : "#e0e0e0",
                                                                        backgroundColor: selected ? `${color}10` : "#f4f6f9",
                                                                    }}
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        value={cert}
                                                                        checked={selected}
                                                                        disabled={isDisabled}
                                                                        onChange={() => { if (!isDisabled) { toggleCertification(cert, eligible); setValidationError(""); } }}
                                                                        className="w-4 h-4 shrink-0 accent-[#1a237e]"
                                                                    />
                                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                        {selected && (
                                                                            <span className="w-2 h-2 rotate-45 shrink-0" style={{ backgroundColor: "#c62828", display: "inline-block" }} />
                                                                        )}
                                                                        <span className="text-sm font-semibold" style={{ color: selected ? color : isDisabled ? "#bbb" : "#555" }}>
                                                                            {cert}
                                                                        </span>
                                                                    </div>
                                                                    {selected && (
                                                                        <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}20`, color }}>
                                                                            Sélectionnée
                                                                        </span>
                                                                    )}
                                                                </label>
                                                            );
                                                        })}
                                                    </motion.div>
                                                </AnimatePresence>
                                                {certifications.length === 2 && (
                                                    <motion.p
                                                        initial={{ opacity: 0, y: -4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="mt-2 text-xs font-medium text-[#c62828]"
                                                    >
                                                        Maximum atteint. Désélectionnez une formation pour en choisir une autre.
                                                    </motion.p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

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

                                        {/* Zone de dépôt Justificatif Expérience — masqué pour les Junior */}
                                        {!certifications.every(c => c.startsWith("Junior")) && (
                                            <div className="mb-6">
                                                <p className="text-sm font-bold text-[#1a237e] mb-2">
                                                    3. Justificatif d&apos;expérience (Système Management / Labo) <span className="text-[#c62828]">*</span>
                                                    <span className="ml-2 text-[10px] font-semibold text-gray-400 normal-case tracking-normal">
                                                        (plusieurs fichiers acceptés)
                                                    </span>
                                                </p>
                                                {justificatifExp.length === 0 ? (
                                                    /* Drop zone — aucun fichier sélectionné */
                                                    <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                        <Upload className="h-7 w-7 mb-2 text-gray-400" />
                                                        <span className="text-sm font-bold text-gray-600">Déposez votre Justificatif d&apos;expérience</span>
                                                        <span className="text-[10px] text-gray-400 mt-1">PDF, DOCX, JPG, PNG</span>
                                                        <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                            onChange={e => { if (e.target.files && e.target.files.length > 0) addJustificatifsExp(e.target.files); e.target.value = ""; }} />
                                                    </label>
                                                ) : (
                                                    /* Fichiers sélectionnés : liste + bouton compact */
                                                    <div className="space-y-2">
                                                        {justificatifExp.map((f, i) => (
                                                            <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                                <div className="flex items-center gap-3 overflow-hidden">
                                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                                                        <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <p className="text-xs font-bold text-gray-700 truncate">{f.name}</p>
                                                                        <p className="text-[10px] text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                    </div>
                                                                </div>
                                                                <button type="button" onClick={() => removeJustificatifExp(i)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                                                                    <X className="h-4 w-4" style={{ color: "#c62828" }} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        {/* Bouton compact pour ajouter d'autres */}
                                                        <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                            <Upload className="h-4 w-4 text-gray-400 shrink-0" />
                                                            <span className="text-xs font-bold text-gray-500">Ajouter d&apos;autres fichiers</span>
                                                            <span className="ml-auto text-[10px] text-gray-400">PDF, DOCX, JPG, PNG</span>
                                                            <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                                onChange={e => { if (e.target.files && e.target.files.length > 0) addJustificatifsExp(e.target.files); e.target.value = ""; }} />
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Zone de dépôt Diplômes — plusieurs fichiers */}
                                        <div className="mb-6">
                                            <p className="text-sm font-bold text-[#1a237e] mb-2">
                                                4. Copies des diplômes / attestations <span className="text-[#c62828]">*</span>
                                                <span className="ml-2 text-[10px] font-semibold text-gray-400 normal-case tracking-normal">
                                                    (plusieurs fichiers acceptés)
                                                </span>
                                            </p>
                                            {diplomes.length === 0 ? (
                                                /* Drop zone — aucun fichier sélectionné */
                                                <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                    <Upload className="h-7 w-7 mb-2 text-gray-400" />
                                                    <span className="text-sm font-bold text-gray-600">Déposez vos Diplômes ici</span>
                                                    <span className="text-[10px] text-gray-400 mt-1">PDF, DOCX, JPG, PNG</span>
                                                    <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                        onChange={e => { if (e.target.files && e.target.files.length > 0) addDiplomes(e.target.files); e.target.value = ""; }} />
                                                </label>
                                            ) : (
                                                /* Fichiers sélectionnés : liste + bouton compact */
                                                <div className="space-y-2">
                                                    {diplomes.map((f, i) => (
                                                        <div key={i} className="flex items-center justify-between p-3 bg-white border rounded-xl shadow-sm" style={{ borderColor: "#e0e0e0" }}>
                                                            <div className="flex items-center gap-3 overflow-hidden">
                                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "#e8eaf6" }}>
                                                                    <FileIcon className="h-4 w-4" style={{ color: "#1a237e" }} />
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-xs font-bold text-gray-700 truncate">{f.name}</p>
                                                                    <p className="text-[10px] text-gray-400">{(f.size / 1024 / 1024).toFixed(2)} MB</p>
                                                                </div>
                                                            </div>
                                                            <button type="button" onClick={() => removeDiplome(i)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors shrink-0">
                                                                <X className="h-4 w-4" style={{ color: "#c62828" }} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {/* Bouton compact pour ajouter d'autres */}
                                                    <label className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors hover:border-[#2e7d32]" style={{ borderColor: "#c5cae9", backgroundColor: "#f4f6f9" }}>
                                                        <Upload className="h-4 w-4 text-gray-400 shrink-0" />
                                                        <span className="text-xs font-bold text-gray-500">Ajouter d&apos;autres fichiers</span>
                                                        <span className="ml-auto text-[10px] text-gray-400">PDF, DOCX, JPG, PNG</span>
                                                        <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                            onChange={e => { if (e.target.files && e.target.files.length > 0) addDiplomes(e.target.files); e.target.value = ""; }} />
                                                    </label>
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
                                        <div>
                                            <label className={labelClass()} style={{ color: "#1a237e" }}>
                                                Aménagement spécifique <span className="text-[#c62828]">*</span>
                                            </label>
                                            <p className="text-sm text-gray-500 leading-relaxed mt-1">
                                                Avez-vous des besoins d&apos;aménagement spécifique relatifs à l&apos;accessibilité, l&apos;éclairage, la température ou l&apos;aération de la salle d&apos;examen ?
                                            </p>
                                        </div>
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
                                                <FieldError message={fieldErrors.amenagementDetails} />
                                                <textarea
                                                    value={amenagementDetails}
                                                    onChange={e => handleField("amenagementDetails", e.target.value, setAmenagementDetails)}
                                                    onBlur={e => handleField("amenagementDetails", e.target.value, setAmenagementDetails)}
                                                    className={inputClass(!!fieldErrors.amenagementDetails) + " resize-none"}
                                                    rows={3}
                                                    placeholder="Entrez vos besoins spécifiques"
                                                />
                                            </motion.div>
                                        )}
                                    </div>
                                )}

                                {/* ÉTAPE 6 — Déclaration */}
                                {step === 6 && (
                                    <div className="space-y-5">
                                        <label className={labelClass()} style={{ color: "#1a237e" }}>
                                            Déclaration sur l&apos;honneur <span className="text-[#c62828]">*</span>
                                        </label>
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
                                                ["Certification", certifications.length > 0 ? certifications.join(" + ") : "Non sélectionnée"],
                                                ["Mode d'examen", examMode === "online" ? "En ligne" : examMode === "onsite" ? "Présentiel" : "Non choisi"],
                                                ["Type d'examen", examType === "direct" ? "Examen direct" : examType === "after_formation" ? "Après formation IRISQ" : "Non choisi"],
                                                ["Email", email],
                                                ["CV", cvFile ? "Uploadé" : "Manquant"],
                                                ["Pièce Identité", pieceIdentite ? "Uploadé" : "Manquant"],
                                                ...(!certifications.every(c => c.startsWith("Junior")) ? [["Justificatif Expérience", justificatifExp.length > 0 ? `${justificatifExp.length} fichier(s) uploadé(s)` : "Manquant"]] : []),
                                                ["Diplômes", diplomes.length > 0 ? `${diplomes.length} fichier(s) uploadé(s)` : "Manquant"],
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
                                    disabled={isCheckingEmail}
                                    className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                    style={{ backgroundColor: "#1a237e", boxShadow: "0 6px 16px rgba(26,35,126,0.22)" }}
                                >
                                    {isCheckingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    Suivant
                                    {!isCheckingEmail && <ChevronRight className="h-4 w-4" />}
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

        {/* ── Modal — Critères d'expérience ────────────────────────────── */}
        <AnimatePresence>
            {showExperienceModal && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
                    onClick={() => setShowExperienceModal(false)}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 12 }}
                        transition={{ duration: 0.2 }}
                        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "#e8eaf6" }}>
                            <h2 className="text-sm font-bold" style={{ color: "#1a237e" }}>
                                Critères d&apos;éligibilité
                            </h2>
                            <button type="button" onClick={() => setShowExperienceModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>

                        {/* Rows */}
                        <div className="px-5 py-4 space-y-3">
                            {[
                                { range: "< 2 ans",   level: "Junior Implementor",          color: "#b45309" },
                                { range: "2 – 4 ans", level: "Junior + Implementor",         color: "#2e7d32" },
                                { range: "≥ 5 ans",   level: "Toutes les certifications",    color: "#1a237e" },
                            ].map(row => (
                                <div key={row.range} className="flex items-center gap-3">
                                    <span
                                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0"
                                        style={{ backgroundColor: `${row.color}15`, color: row.color }}
                                    >
                                        {row.range}
                                    </span>
                                    <span className="text-sm text-gray-600">{row.level}</span>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-5 pb-4">
                            <button
                                type="button"
                                onClick={() => setShowExperienceModal(false)}
                                className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
                                style={{ backgroundColor: "#1a237e" }}
                            >
                                Fermer
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}