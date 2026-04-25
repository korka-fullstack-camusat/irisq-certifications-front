"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { candidateMe, clearCandidateToken, getCandidateToken, type CandidateDossier } from "./api";

interface CandidateCtx {
    dossier: CandidateDossier | null;
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => void;
    setDossier: (d: CandidateDossier) => void;
    examActive: boolean;
    setExamActive: (v: boolean) => void;
}

const Ctx = createContext<CandidateCtx | undefined>(undefined);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [dossier, setDossier] = useState<CandidateDossier | null>(null);
    const [loading, setLoading] = useState(true);
    const [examActive, setExamActive] = useState(false);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await candidateMe();
            if (data.must_change_password) {
                router.replace("/candidat/change-password");
                return;
            }
            setDossier(data);
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

    useEffect(() => {
        if (!getCandidateToken()) {
            router.replace("/candidat/login");
            return;
        }
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return (
        <Ctx.Provider value={{ dossier, loading, refresh, logout, setDossier, examActive, setExamActive }}>
            {children}
        </Ctx.Provider>
    );
}

export function useCandidate() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useCandidate must be used inside CandidateProvider");
    return ctx;
}
