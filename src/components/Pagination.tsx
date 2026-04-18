"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    total: number;
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    pageSizeOptions?: number[];
    onPageSizeChange?: (size: number) => void;
}

export function Pagination({
    total,
    page,
    pageSize,
    onPageChange,
    pageSizeOptions,
    onPageSizeChange,
}: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const from = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(total, safePage * pageSize);

    const pages = pageNumbers(safePage, totalPages);

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-xs">
            <p className="text-gray-500">
                {total === 0
                    ? "Aucun résultat"
                    : <>Affichage <span className="font-bold text-gray-700">{from}–{to}</span> sur <span className="font-bold text-gray-700">{total}</span></>}
            </p>

            <div className="flex items-center gap-2">
                {pageSizeOptions && onPageSizeChange && (
                    <label className="inline-flex items-center gap-2 text-gray-500">
                        <span className="uppercase tracking-widest font-bold text-[10px]">Par page</span>
                        <select
                            value={pageSize}
                            onChange={e => onPageSizeChange(Number(e.target.value))}
                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                        >
                            {pageSizeOptions.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                )}

                <div className="inline-flex items-center gap-1">
                    <button
                        disabled={safePage === 1}
                        onClick={() => onPageChange(safePage - 1)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                        aria-label="Page précédente"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>

                    {pages.map((p, idx) =>
                        p === "…" ? (
                            <span key={`e-${idx}`} className="px-2 text-gray-400">…</span>
                        ) : (
                            <button
                                key={p}
                                onClick={() => onPageChange(p)}
                                className="h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-colors"
                                style={{
                                    backgroundColor: p === safePage ? "#1a237e" : "transparent",
                                    color: p === safePage ? "#ffffff" : "#555",
                                    border: p === safePage ? "1px solid #1a237e" : "1px solid #e5e7eb",
                                }}
                            >
                                {p}
                            </button>
                        ),
                    )}

                    <button
                        disabled={safePage === totalPages}
                        onClick={() => onPageChange(safePage + 1)}
                        className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white"
                        aria-label="Page suivante"
                    >
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function pageNumbers(current: number, total: number): Array<number | "…"> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out: Array<number | "…"> = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    if (start > 2) out.push("…");
    for (let p = start; p <= end; p++) out.push(p);
    if (end < total - 1) out.push("…");
    out.push(total);
    return out;
}

export function usePaginatedSlice<T>(items: T[], page: number, pageSize: number): T[] {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
}
