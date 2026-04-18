"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Download, ExternalLink, FileText, Loader2, AlertTriangle } from "lucide-react";
import { API_URL } from "@/lib/api";

interface FilePreviewModalProps {
    url: string | null;
    title?: string;
    onClose: () => void;
}

type Kind = "pdf" | "image" | "video" | "audio" | "text" | "office" | "unknown";

function resolveAbsoluteUrl(raw: string): string {
    if (!raw) return raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    const base = API_URL.replace(/\/api\/?$/, "");
    return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function detectKind(url: string): Kind {
    try {
        const clean = url.split("?")[0].split("#")[0].toLowerCase();
        if (/\.pdf$/.test(clean)) return "pdf";
        if (/\.(png|jpe?g|gif|webp|svg|bmp|avif)$/.test(clean)) return "image";
        if (/\.(mp4|webm|ogv|mov|m4v)$/.test(clean)) return "video";
        if (/\.(mp3|wav|ogg|m4a|aac)$/.test(clean)) return "audio";
        if (/\.(txt|md|csv|log|json|xml|ya?ml)$/.test(clean)) return "text";
        if (/\.(docx?|xlsx?|pptx?|odt|ods|odp)$/.test(clean)) return "office";
    } catch {
        // fall through
    }
    return "unknown";
}

function kindFromMime(mime: string | null | undefined): Kind {
    if (!mime) return "unknown";
    const m = mime.toLowerCase().split(";")[0].trim();
    if (m === "application/pdf") return "pdf";
    if (m.startsWith("image/")) return "image";
    if (m.startsWith("video/")) return "video";
    if (m.startsWith("audio/")) return "audio";
    if (m.startsWith("text/") || m === "application/json" || m === "application/xml") return "text";
    if (
        m === "application/msword" ||
        m === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        m === "application/vnd.ms-excel" ||
        m === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        m === "application/vnd.ms-powerpoint" ||
        m === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) return "office";
    return "unknown";
}

function officeViewerUrl(url: string): string {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export function FilePreviewModal({ url, title, onClose }: FilePreviewModalProps) {
    const [textContent, setTextContent] = useState<string | null>(null);
    const [textLoading, setTextLoading] = useState(false);
    const [textError, setTextError] = useState<string | null>(null);

    const [blobUrl, setBlobUrl] = useState<string | null>(null);
    const [blobLoading, setBlobLoading] = useState(false);
    const [blobError, setBlobError] = useState<string | null>(null);
    const blobUrlRef = useRef<string | null>(null);

    const absoluteUrl = useMemo(() => (url ? resolveAbsoluteUrl(url) : null), [url]);
    const detectedKind = useMemo<Kind>(() => (absoluteUrl ? detectKind(absoluteUrl) : "unknown"), [absoluteUrl]);
    const [probedKind, setProbedKind] = useState<Kind | null>(null);
    const kind: Kind = detectedKind !== "unknown" ? detectedKind : (probedKind ?? "unknown");
    const displayTitle = title || (absoluteUrl ? absoluteUrl.split("/").pop()?.split("?")[0] || "Fichier" : "Fichier");

    useEffect(() => {
        setProbedKind(null);
        if (!absoluteUrl || detectedKind !== "unknown") return;
        let cancelled = false;

        (async () => {
            // Try a cheap HEAD first; fall back to a 1-byte Range GET if the
            // server rejects HEAD (e.g. returns 405 Method Not Allowed).
            let mime: string | null = null;
            try {
                const head = await fetch(absoluteUrl, { method: "HEAD", credentials: "include" });
                if (head.ok) mime = head.headers.get("Content-Type");
            } catch { /* ignore */ }

            if (!cancelled && !mime) {
                try {
                    const probe = await fetch(absoluteUrl, {
                        method: "GET",
                        credentials: "include",
                        headers: { Range: "bytes=0-0" },
                    });
                    if (probe.ok || probe.status === 206) {
                        mime = probe.headers.get("Content-Type");
                    }
                } catch { /* ignore */ }
            }

            if (cancelled) return;
            const k = kindFromMime(mime);
            if (k !== "unknown") setProbedKind(k);
        })();

        return () => { cancelled = true; };
    }, [absoluteUrl, detectedKind]);

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    useEffect(() => {
        if (!absoluteUrl || kind !== "text") {
            setTextContent(null);
            return;
        }
        setTextLoading(true);
        setTextError(null);
        fetch(absoluteUrl, { credentials: "include" })
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            })
            .then(t => setTextContent(t))
            .catch(e => setTextError(e instanceof Error ? e.message : "Erreur"))
            .finally(() => setTextLoading(false));
    }, [absoluteUrl, kind]);

    // Fetch PDFs as a blob so browsers render them inline even when the
    // server returns Content-Disposition: attachment.
    useEffect(() => {
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
        setBlobUrl(null);
        setBlobError(null);
        if (!absoluteUrl || kind !== "pdf") return;

        let cancelled = false;
        setBlobLoading(true);
        fetch(absoluteUrl, { credentials: "include" })
            .then(async r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                const raw = await r.blob();
                const typed = raw.type && raw.type !== "application/octet-stream"
                    ? raw
                    : new Blob([raw], { type: "application/pdf" });
                const bUrl = URL.createObjectURL(typed);
                if (cancelled) {
                    URL.revokeObjectURL(bUrl);
                    return;
                }
                blobUrlRef.current = bUrl;
                setBlobUrl(bUrl);
            })
            .catch(e => {
                if (!cancelled) setBlobError(e instanceof Error ? e.message : "Erreur");
            })
            .finally(() => {
                if (!cancelled) setBlobLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [absoluteUrl, kind]);

    useEffect(() => {
        return () => {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
                blobUrlRef.current = null;
            }
        };
    }, []);

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
                <div
                    className="px-5 py-3 flex items-center gap-3 shrink-0"
                    style={{ backgroundColor: "#1a237e" }}
                >
                    <FileText className="h-4 w-4 text-white/80 shrink-0" />
                    <span className="text-sm font-bold text-white truncate flex-1" title={displayTitle}>
                        {displayTitle}
                    </span>
                    <a
                        href={absoluteUrl}
                        download
                        className="text-white/80 hover:text-white inline-flex items-center gap-1 text-[11px] font-bold"
                        title="Télécharger"
                    >
                        <Download className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Télécharger</span>
                    </a>
                    <button
                        onClick={onClose}
                        className="text-white/70 hover:text-white transition-colors"
                        aria-label="Fermer"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 bg-gray-50">
                    {kind === "pdf" && (
                        <div className="w-full h-[80vh] bg-white relative">
                            {blobLoading && (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement du document…
                                </div>
                            )}
                            {!blobLoading && blobUrl && (
                                <object
                                    data={`${blobUrl}#view=FitH&toolbar=1&navpanes=0`}
                                    type="application/pdf"
                                    className="w-full h-full"
                                    aria-label={displayTitle}
                                >
                                    <iframe
                                        src={blobUrl}
                                        title={displayTitle}
                                        className="w-full h-full"
                                    />
                                </object>
                            )}
                            {!blobLoading && !blobUrl && blobError && (
                                <iframe
                                    src={absoluteUrl}
                                    title={displayTitle}
                                    className="w-full h-full"
                                />
                            )}
                        </div>
                    )}

                    {kind === "image" && (
                        <div className="flex items-center justify-center p-4 overflow-auto h-[80vh]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={absoluteUrl}
                                alt={displayTitle}
                                className="max-w-full max-h-full object-contain rounded-lg shadow"
                            />
                        </div>
                    )}

                    {kind === "video" && (
                        <div className="flex items-center justify-center p-4 h-[80vh] bg-black">
                            <video src={absoluteUrl} controls className="max-w-full max-h-full" />
                        </div>
                    )}

                    {kind === "audio" && (
                        <div className="flex items-center justify-center p-8">
                            <audio src={absoluteUrl} controls className="w-full" />
                        </div>
                    )}

                    {kind === "text" && (
                        <div className="p-4 h-[80vh] overflow-auto">
                            {textLoading ? (
                                <div className="flex items-center justify-center h-full text-gray-400 text-sm inline-flex gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
                                </div>
                            ) : textError ? (
                                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm inline-flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" /> Impossible d&apos;afficher le fichier : {textError}
                                </div>
                            ) : (
                                <pre className="text-xs text-gray-800 bg-white border border-gray-100 rounded-xl p-4 whitespace-pre-wrap break-words">
                                    {textContent}
                                </pre>
                            )}
                        </div>
                    )}

                    {kind === "office" && (
                        <iframe
                            src={officeViewerUrl(absoluteUrl)}
                            title={displayTitle}
                            className="w-full h-[80vh] bg-white"
                        />
                    )}

                    {kind === "unknown" && (
                        <div className="p-10 text-center">
                            <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
                            <p className="text-sm text-gray-500">
                                L&apos;aperçu n&apos;est pas disponible pour ce type de fichier.
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-2">
                                <a
                                    href={absoluteUrl}
                                    download
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white"
                                    style={{ backgroundColor: "#1a237e" }}
                                >
                                    <Download className="h-4 w-4" /> Télécharger
                                </a>
                                <a
                                    href={absoluteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50"
                                >
                                    <ExternalLink className="h-4 w-4" /> Ouvrir dans un nouvel onglet
                                </a>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
