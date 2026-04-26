"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Download } from "lucide-react";
import { API_URL } from "@/lib/api";

interface Annotation {
    label?: string;
    points_earned?: number;
    max_points?: number;
    x?: number;
    y?: number;
    page_index?: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    examDocument: string;           // URL or path to the PDF
    answerGrades?: Annotation[];    // correcteur (rouge)
    juryAnswerGrades?: Annotation[]; // jury (bleu)
    candidateName?: string;
}

interface RenderedPage { dataUrl: string; width: number; height: number; }

function resolveUrl(u: string) {
    if (!u) return "";
    if (u.startsWith("http")) return u;
    return `${API_URL.replace("/api", "")}${u}`;
}

export function AnnotatedCopyModal({
    open, onClose, examDocument, answerGrades = [], juryAnswerGrades = [], candidateName,
}: Props) {
    const [pdfjsReady, setPdfjsReady]         = useState(false);
    const [renderedPages, setRenderedPages]   = useState<RenderedPage[]>([]);
    const [isRendering, setIsRendering]       = useState(false);
    const [renderProgress, setRenderProgress] = useState(0);
    const [totalPages, setTotalPages]         = useState(0);
    const cancelRef = useRef(false);

    // Load PDF.js once
    useEffect(() => {
        if (typeof window === "undefined") return;
        if ((window as any).pdfjsLib) { setPdfjsReady(true); return; }
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        script.onload = () => {
            (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
            setPdfjsReady(true);
        };
        document.head.appendChild(script);
    }, []);

    // Render PDF when modal opens
    useEffect(() => {
        if (!open || !pdfjsReady || !examDocument) return;
        cancelRef.current = false;
        setRenderedPages([]);
        setRenderProgress(0);
        setTotalPages(0);
        setIsRendering(true);

        (async () => {
            try {
                const docUrl = resolveUrl(examDocument);
                const res = await fetch(docUrl, { credentials: "include" });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const blob = await res.blob();
                const ab   = await blob.arrayBuffer();
                const lib  = (window as any).pdfjsLib;
                const pdf  = await lib.getDocument({ data: ab }).promise;
                if (cancelRef.current) return;
                setTotalPages(pdf.numPages);
                for (let i = 1; i <= pdf.numPages; i++) {
                    if (cancelRef.current) break;
                    const page     = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.8 });
                    const canvas   = document.createElement("canvas");
                    canvas.width   = viewport.width;
                    canvas.height  = viewport.height;
                    const ctx = canvas.getContext("2d");
                    if (!ctx) continue;
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    if (cancelRef.current) break;
                    setRenderedPages(prev => [...prev, {
                        dataUrl: canvas.toDataURL("image/jpeg", 0.92),
                        width: viewport.width,
                        height: viewport.height,
                    }]);
                    setRenderProgress(i);
                }
            } catch (e) { console.error("PDF render error:", e); }
            finally { if (!cancelRef.current) setIsRendering(false); }
        })();

        return () => { cancelRef.current = true; };
    }, [open, pdfjsReady, examDocument]);

    // Lock body scroll when open
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    const docUrl = resolveUrl(examDocument);

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-50 flex flex-col">
                    {/* Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: 16 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="relative z-10 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden mx-auto my-4"
                        style={{ width: "min(95vw, 920px)", height: "calc(100vh - 2rem)" }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-5 py-3.5 flex items-center justify-between shrink-0"
                            style={{ backgroundColor: "#1a237e" }}>
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex items-center gap-4 text-xs font-bold">
                                    <span className="flex items-center gap-1.5 text-white/90">
                                        <span className="w-3 h-3 rounded-full border-2 inline-block shrink-0" style={{ borderColor: "#ef4444" }} />
                                        Correcteur
                                    </span>
                                    <span className="flex items-center gap-1.5 text-white/90">
                                        <span className="w-3 h-3 rounded-full border-2 inline-block shrink-0" style={{ borderColor: "#60a5fa" }} />
                                        Jury
                                    </span>
                                </div>
                                {candidateName && (
                                    <span className="text-white/50 text-xs truncate ml-2">— {candidateName}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a href={docUrl} target="_blank" rel="noreferrer" download
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition-colors">
                                    <Download className="h-3.5 w-3.5" /> Télécharger
                                </a>
                                <button onClick={onClose}
                                    className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* PDF viewer */}
                        <div className="flex-1 overflow-y-auto bg-gray-700">
                            {/* Progress bar */}
                            {isRendering && (
                                <div className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-sm px-5 py-2 flex items-center gap-3">
                                    <Loader2 className="h-4 w-4 animate-spin text-white shrink-0" />
                                    <span className="text-white text-xs font-medium">
                                        {totalPages > 0
                                            ? `Chargement… ${renderProgress}/${totalPages}`
                                            : "Chargement de la copie…"}
                                    </span>
                                    {totalPages > 0 && (
                                        <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                                            <div className="h-full bg-white rounded-full transition-all"
                                                style={{ width: `${(renderProgress / totalPages) * 100}%` }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="py-4 flex flex-col items-center gap-4">
                                {renderedPages.map((page, pageIdx) => (
                                    <div key={pageIdx} className="relative shadow-2xl select-none"
                                        style={{ width: "min(100%, 860px)" }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={page.dataUrl} alt={`Page ${pageIdx + 1}`}
                                            className="w-full block" draggable={false} />

                                        <div className="absolute inset-0 pointer-events-none">
                                            {/* Annotations correcteur (rouge) */}
                                            {answerGrades
                                                .filter(g => (g.page_index ?? 0) === pageIdx)
                                                .map((g, i) => (
                                                    <div key={`c-${i}`} className="absolute"
                                                        style={{ left: `${g.x ?? 10}%`, top: `${g.y ?? 10}%`, transform: "translate(-50%,-50%)", zIndex: 10 }}>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <div className="flex flex-col items-center justify-center rounded-full border-[3px]"
                                                                style={{ width: 40, height: 40, borderColor: "#c62828", backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 2px 8px rgba(198,40,40,0.4)" }}>
                                                                <span className="font-black leading-none" style={{ fontSize: 13, color: "#c62828" }}>{g.points_earned ?? "—"}</span>
                                                                <span className="font-bold leading-none" style={{ fontSize: 6, color: "#c62828", opacity: 0.7 }}>/{g.max_points}</span>
                                                            </div>
                                                            <span className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-white/95 shadow-sm" style={{ color: "#c62828" }}>
                                                                {g.label || `Q${i + 1}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}

                                            {/* Annotations jury (bleu) */}
                                            {juryAnswerGrades
                                                .filter(g => (g.page_index ?? 0) === pageIdx)
                                                .map((g, i) => (
                                                    <div key={`j-${i}`} className="absolute"
                                                        style={{ left: `${g.x ?? 10}%`, top: `${g.y ?? 10}%`, transform: "translate(-50%,-50%)", zIndex: 20 }}>
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <div className="flex flex-col items-center justify-center rounded-full border-[3px]"
                                                                style={{ width: 40, height: 40, borderColor: "#1565c0", backgroundColor: "rgba(255,255,255,0.96)", boxShadow: "0 2px 8px rgba(21,101,192,0.4)" }}>
                                                                <span className="font-black leading-none" style={{ fontSize: 13, color: "#1565c0" }}>{g.points_earned ?? "—"}</span>
                                                                <span className="font-bold leading-none" style={{ fontSize: 6, color: "#1565c0", opacity: 0.7 }}>/{g.max_points}</span>
                                                            </div>
                                                            <span className="text-[7px] font-black uppercase tracking-widest px-1 py-0.5 rounded bg-white/95 shadow-sm" style={{ color: "#1565c0" }}>
                                                                {g.label || `Q${i + 1}`}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>

                                        <div className="absolute bottom-2 right-3 text-[10px] font-bold text-gray-400 bg-white/80 px-2 py-0.5 rounded-full pointer-events-none">
                                            {pageIdx + 1} / {renderedPages.length}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
