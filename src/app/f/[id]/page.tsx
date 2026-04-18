"use client";

import { useState, useEffect, use } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Upload, X, File as FileIcon } from "lucide-react";
import { fetchFormById, submitResponse, uploadFiles } from "@/lib/api";

export default function PublicFormPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const [form, setForm] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Core response fields
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    // Dynamic answers object: fieldId -> value
    const [answers, setAnswers] = useState<Record<string, any>>({});

    // File state: fieldId -> File[]
    const [uploads, setUploads] = useState<Record<string, File[]>>({});

    useEffect(() => {
        const loadForm = async () => {
            try {
                const data = await fetchFormById(resolvedParams.id);
                setForm(data);
            } catch (error) {
                console.error("Failed to load form:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadForm();
    }, [resolvedParams.id]);

    const handleAnswerChange = (fieldId: string, value: any) => {
        setAnswers(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleFileChange = (fieldId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files);
            setUploads(prev => ({
                ...prev,
                [fieldId]: [...(prev[fieldId] || []), ...newFiles]
            }));
        }
    };

    const removeFile = (fieldId: string, indexToRemove: number) => {
        setUploads(prev => ({
            ...prev,
            [fieldId]: prev[fieldId].filter((_, index) => index !== indexToRemove)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // 1. Process File Uploads first if any exist
            const finalAnswers = { ...answers };

            for (const [fieldId, files] of Object.entries(uploads)) {
                if (files.length > 0) {
                    const formData = new FormData();
                    files.forEach(file => {
                        formData.append("files", file);
                    });

                    const uploadResult = await uploadFiles(formData);
                    // Store the arrays of file URLs in the answers object
                    finalAnswers[fieldId] = uploadResult.file_urls;
                }
            }

            // 2. Submit the complete response
            const responsePayload = {
                form_id: resolvedParams.id,
                name: name,
                email: email,
                profile: "Candidat", // Default profile for public forms
                answers: finalAnswers
            };

            await submitResponse(resolvedParams.id, responsePayload);
            setIsSuccess(true);
        } catch (error) {
            console.error("Failed to submit form:", error);
            alert("Une erreur est survenue lors de l'envoi. Veuillez réessayer.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-slate-500">Chargement du formulaire...</p>
            </div>
        );
    }

    if (!form && !isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
                    <X className="h-12 w-12 text-rose-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Formulaire introuvable</h1>
                    <p className="text-slate-500">Ce formulaire n'existe pas ou a été supprimé.</p>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full"
                >
                    <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-6" />
                    <h1 className="text-2xl font-bold font-heading text-slate-900 mb-2">Merci !</h1>
                    <p className="text-slate-600 mb-8">Votre réponse a bien été enregistrée.</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
            <div className="max-w-3xl mx-auto space-y-8">

                <div className="text-center mb-10">
                    <div className="h-12 flex items-center justify-center mb-6">
                        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-heading font-black text-xl shadow-lg relative overflow-hidden">
                            I.
                            <div className="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-4"></div>
                        </div>
                    </div>
                </div>

                {/* Form Header */}
                <div className="bg-white rounded-2xl shadow-sm border-t-4 border-t-primary border-x border-b border-slate-200 p-8 md:p-10">
                    <h1 className="text-3xl font-bold font-heading text-slate-900 mb-4">{form.title}</h1>
                    {form.description && (
                        <p className="text-slate-600 whitespace-pre-wrap">{form.description}</p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Standard Identity Fields */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10 space-y-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-900">
                                Nom complet <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all shadow-sm"
                                placeholder="Votre nom"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-900">
                                Adresse Email <span className="text-rose-500">*</span>
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all shadow-sm"
                                placeholder="vous@exemple.com"
                            />
                        </div>
                    </div>

                    {/* Dynamic Fields */}
                    {form.fields && form.fields.map((field: any) => (
                        <div key={field.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 md:p-10">
                            <label className="block text-base font-semibold text-slate-900 mb-1">
                                {field.label} {field.required && <span className="text-rose-500">*</span>}
                            </label>
                            {field.description && <p className="text-sm text-slate-500 mb-4">{field.description}</p>}

                            <div className="mt-4">
                                {field.type === 'textarea' ? (
                                    <textarea
                                        required={field.required}
                                        value={answers[field.id] || ""}
                                        onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all min-h-[120px] resize-y shadow-sm"
                                        placeholder="Votre réponse..."
                                    />
                                ) : field.type === 'file_upload' ? (
                                    <div className="space-y-4">
                                        <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer group">
                                            <Upload className="h-10 w-10 text-slate-400 group-hover:text-primary transition-colors mb-3" />
                                            <span className="text-sm font-medium text-slate-700">Cliquez pour ajouter des fichiers</span>
                                            <span className="text-xs text-slate-500 mt-1">PDF, JPG, PNG (Max. multiples)</span>
                                            <input
                                                type="file"
                                                className="hidden"
                                                multiple
                                                required={field.required && !(uploads[field.id]?.length > 0)}
                                                onChange={(e) => handleFileChange(field.id, e)}
                                            />
                                        </label>

                                        {/* Display selected files */}
                                        {uploads[field.id] && uploads[field.id].length > 0 && (
                                            <div className="space-y-2">
                                                {uploads[field.id].map((file, index) => (
                                                    <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                                        <div className="flex items-center gap-3 overflow-hidden">
                                                            <div className="p-2 bg-slate-100 rounded-md shrink-0">
                                                                <FileIcon className="h-4 w-4 text-slate-500" />
                                                            </div>
                                                            <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFile(field.id, index)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-md transition-colors shrink-0"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <input
                                        type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                                        required={field.required}
                                        value={answers[field.id] || ""}
                                        onChange={(e) => handleAnswerChange(field.id, e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white transition-all shadow-sm"
                                        placeholder="Votre réponse..."
                                    />
                                )}
                            </div>
                        </div>
                    ))}

                    <div className="flex justify-end pt-4">
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-8 py-4 rounded-xl text-base font-medium bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                            <span>{isSubmitting ? "Envoi en cours..." : "Envoyer ma demande"}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
