"use client";

import { useEffect, useRef, useState } from "react";
import { X, Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { API_URL } from "@/lib/api";

interface FilePreviewModalProps {
    url: string | null;
    title?: string;
    /** Original filename or MIME hint — used for instant type detection. */
    hint?: string;
    onClose: () => void;
}

type Kind = "pdf" | "image" | "video" | "audio" | "text" | "office" | "unknown";

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveAbsoluteUrl(raw: string): string {
    if (!raw) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = API_URL.replace(/\/api\/?$/, "");
    return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function kindFromExt(name: string): Kind {
    // Strip query / hash before checking extension
    const clean = name.split("?")[0].split("#")[0].toLowerCase();
    if (/\.pdf$/i.test(clean))                               return "pdf";
    if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(clean)) return "image";
    if (/\.(mp4|webm|ogv|mov|m4v)$/i.test(clean))           return "video";
    if (/\.(mp3|wav|ogg|m4a|aac)$/i.test(clean))            return "audio";
    if (/\.(txt|md|csv|log|json|xml|ya?ml)$/i.test(clean))  return "text";
    if (/\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(clean))  return "office";
    return "unknown";
}

function kindFromMime(mime: string | null | undefined): Kind {
    if (!mime) return "unknown";
    const m = mime.toLowerCase().split(";")[0].trim();
    if (m === "application/pdf")    return "pdf";
    if (m.startsWith("image/"))     return "image";
    if (m.startsWith("video/"))     return "video";
    if (m.startsWith("audio/"))     return "audio";
    if (m.startsWith("text/") || m === "application/json" || m === "application/xml") return "text";
    if (m.includes("word") || m.includes("excel") || m.includes("powerpoint") ||
        m.includes("officedocument") || m.includes("opendocument")) return "office";
    return "unknown";
}

/**
 * Detect file type — zero network requests when possible.
 *
 * Priority:
 *  1. ?n=filename.pdf  query param embedded at upload time  → instant
 *  2. hint prop (caller knows the filename / MIME)          → instant
 *  3. URL extension                                         → instant
 *  4. lightweight HEAD probe (fallback for old URLs)        → 1 roundtrip
 */
function detectKindInstant(absoluteUrl: string, hint?: string): Kind {
    // 1. ?n= query param (new uploads)
    try {
        const n = new URL(absoluteUrl).searchParams.get("n");
        if (n) {
            const k = kindFromExt(n);
            if (k !== "unknown") return k;
        }
    } catch { /* ignore */ }

    // 2. hint prop
    if (hint) {
        const k = kindFromExt(hint) !== "unknown" ? kindFromExt(hint) : kindFromMime(hint);
        if (k !== "unknown") return k;
    }

    // 3. URL extension
    return kindFromExt(absoluteUrl);
}

function officeViewerUrl(url: string): string {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

function nameFromContentDisposition(header: string | null): string {
    if (!header) return "";
    const m = header.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
    return m ? decodeURIComponent(m[1].trim()) : "";
}

// ── Component ──────────────────────────────────────────────────────────────

export function FilePreviewModal({ url, title, hint, onClose }: FilePreviewModalProps) {
    const [kind, setKind]   = useState<Kind>("unknown");
    const [ready, setReady] = useState(false);
    const abortRef          = useRef<AbortController | null>(null);

    const absoluteUrl = url ? resolveAbsoluteUrl(url) : null;
    const displayTitle = title || (absoluteUrl ? absoluteUrl.split("/").pop()?.split("?")[0] || "Fichier" : "Fichier");

    // Keyboard close
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", h);
        return () => document.removeEventListener("keydown", h);
    }, [onClose]);

    useEffect(() => {
        if (!absoluteUrl) return;

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        // Reset
        setReady(false);
        setKind("unknown");

        // Try instant detection (no network)
        const instant = detectKindInstant(absoluteUrl, hint);
        if (instant !== "unknown") {
            setKind(instant);
            setReady(true);
            return;
        }

        // Fallback: lightweight HEAD probe for old URLs without ?n= param
        (async () => {
            try {
                const res = await fetch(absoluteUrl, {
                    method: "HEAD",
                    credentials: "omit",
                    signal: ac.signal,
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                // Content-Disposition: inline; filename="doc.pdf"
                const cdName = nameFromContentDisposition(res.headers.get("Content-Disposition"));
                let k: Kind = cdName ? kindFromExt(cdName) : "unknown";
                if (k === "unknown") k = kindFromMime(res.headers.get("Content-Type"));

                setKind(k);
            } catch (e) {
                if (e instanceof Error && e.name === "AbortError") return;
                setKind("unknown");
            } finally {
                setReady(true);
            }
        })();

        return () => ac.abort();
    }, [absoluteUrl, hint]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!url || !absoluteUrl) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-5 py-3 flex items-center gap-3 shrink-0" style={{ backgroundColor: "#1a237e" }}>
                    <FileText className="h-4 w-4 text-white/80 shrink-0" />
                    <span className="text-sm font-bold text-white truncate flex-1" title={displayTitle}>
                        {displayTitle}
                    </span>
                    <a href={absoluteUrl} download
                        className="text-white/80 hover:text-white inline-flex items-center gap-1 text-[11px] font-bold" title="Télécharger">
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Télécharger</span>
                    </a>
                    <a href={absoluteUrl} target="_blank" rel="noreferrer"
                        className="text-white/80 hover:text-white inline-flex items-center gap-1 text-[11px] font-bold ml-2" title="Ouvrir dans un onglet">
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Onglet</span>
                    </a>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors ml-2" aria-label="Fermer">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 bg-gray-50 relative">

                    {/* Spinner — uniquement pendant le HEAD probe (vieilles URLs sans ?n=) */}
                    {!ready && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                        </div>
                    )}

                    {/* PDF */}
                    {ready && kind === "pdf" && (
                        <object
                            data={`${absoluteUrl}#view=FitH&toolbar=1&navpanes=0`}
                            type="application/pdf"
                            className="w-full h-[80vh]"
                            aria-label={displayTitle}
                        >
                            <iframe src={absoluteUrl} title={displayTitle} className="w-full h-[80vh] border-0" />
                        </object>
                    )}

                    {/* Image */}
                    {ready && kind === "image" && (
                        <div className="flex items-center justify-center p-4 overflow-auto h-[80vh]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={absoluteUrl} alt={displayTitle}
                                className="max-w-full max-h-full object-contain rounded-lg shadow" loading="eager" />
                        </div>
                    )}

                    {/* Video */}
                    {ready && kind === "video" && (
                        <div className="flex items-center justify-center p-4 h-[80vh] bg-black">
                            <video src={absoluteUrl} controls autoPlay className="max-w-full max-h-full" />
                        </div>
                    )}

                    {/* Audio */}
                    {ready && kind === "audio" && (
                        <div className="flex items-center justify-center p-8 h-[80vh]">
                            <audio src={absoluteUrl} controls autoPlay className="w-full" />
                        </div>
                    )}

                    {/* Office */}
                    {ready && kind === "office" && (
                        <iframe src={officeViewerUrl(absoluteUrl)} title={displayTitle}
                            className="w-full h-[80vh] bg-white border-0" />
                    )}

                    {/* Fallback — jamais affiché pendant le chargement */}
                    {ready && kind === "unknown" && (
                        <div className="flex flex-col items-center justify-center h-[80vh] gap-5 p-6 text-center">
                            <div className="h-16 w-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#e8eaf6" }}>
                                <FileText className="h-8 w-8" style={{ color: "#1a237e" }} />
                            </div>
                            <div>
                                <p className="font-bold text-gray-700 mb-1">Aperçu non disponible</p>
                                <p className="text-sm text-gray-400">Téléchargez ou ouvrez le fichier dans un nouvel onglet.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <a href={absoluteUrl} download
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white"
                                    style={{ backgroundColor: "#1a237e" }}>
                                    <Download className="h-4 w-4" /> Télécharger
                                </a>
                                <a href={absoluteUrl} target="_blank" rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50">
                                    <ExternalLink className="h-4 w-4" /> Ouvrir dans un onglet
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
