"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { candidateMe, clearCandidateToken, getCandidateToken, type CandidateDossier } from "./api";

interface CandidateCtx {
    /** Active dossier (selected by the candidate, or first by default) */
    dossier: CandidateDossier | null;
    /** All dossiers linked to this account */
    dossiers: CandidateDossier[];
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => void;
    setDossier: (d: CandidateDossier) => void;
    /** Select which dossier is active by its _id */
    setActiveDossierId: (id: string) => void;
    examActive: boolean;
    setExamActive: (v: boolean) => void;
}

const Ctx = createContext<CandidateCtx | undefined>(undefined);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [dossiers, setDossiers] = useState<CandidateDossier[]>([]);
    const [activeDossierId, setActiveDossierId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [examActive, setExamActive] = useState(false);

    const activeDossier = dossiers.find(d => d._id === activeDossierId) ?? dossiers[0] ?? null;

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await candidateMe();
            if ((data as any).must_change_password) {
                router.replace("/candidat/change-password");
                return;
            }
            // /me returns account + dossiers array
            const rawDossiers: CandidateDossier[] = (data as any).dossiers ?? [data];
            setDossiers(rawDossiers);
            // Keep active selection if still valid, else default to first
            setActiveDossierId(prev =>
                rawDossiers.find(d => d._id === prev) ? prev : (rawDossiers[0]?._id ?? null)
            );
        } catch {
            clearCandidateToken();
            router.replace("/candidat/login");
        } finally {
            setLoading(false);
        }
    }, [router]);

    const logout = useCallback(() => {
        clearCandidateToken();
        router.replace("/candidat/login");
    }, [router]);

    const setDossier = useCallback((d: CandidateDossier) => {
        setDossiers(prev => {
            const idx = prev.findIndex(x => x._id === d._id);
            if (idx === -1) return [d, ...prev];
            const next = [...prev];
            next[idx] = d;
            return next;
        });
    }, []);

    useEffect(() => {
        if (!getCandidateToken()) {
            router.replace("/candidat/login");
            return;
        }
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return (
        <Ctx.Provider value={{
            dossier: activeDossier,
            dossiers,
            loading,
            refresh,
            logout,
            setDossier,
            setActiveDossierId,
            examActive,
            setExamActive,
        }}>
            {children}
        </Ctx.Provider>
    );
}

export function useCandidate() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useCandidate must be used inside CandidateProvider");
    return ctx;
}
