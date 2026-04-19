"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    candidateMe,
    candidateFetchDossiers,
    clearCandidateToken,
    getCandidateToken,
    type CandidateAccount,
    type CandidateDossier,
} from "./api";

interface CandidateCtx {
    account: CandidateAccount | null;
    dossiers: CandidateDossier[];
    loading: boolean;
    refresh: () => Promise<void>;
    refreshDossiers: () => Promise<void>;
    logout: () => void;
}

const Ctx = createContext<CandidateCtx | undefined>(undefined);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [account, setAccount] = useState<CandidateAccount | null>(null);
    const [dossiers, setDossiers] = useState<CandidateDossier[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshDossiers = useCallback(async () => {
        try {
            const data = await candidateFetchDossiers();
            setDossiers(data);
        } catch {
            setDossiers([]);
        }
    }, []);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await candidateMe();
            if (data.must_change_password) {
                router.replace("/candidat/change-password");
                return;
            }
            setAccount(data);
            await refreshDossiers();
        } catch {
            clearCandidateToken();
            router.replace("/candidat/login");
        } finally {
            setLoading(false);
        }
    }, [router, refreshDossiers]);

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
        <Ctx.Provider value={{ account, dossiers, loading, refresh, refreshDossiers, logout }}>
            {children}
        </Ctx.Provider>
    );
}

export function useCandidate() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useCandidate must be used inside CandidateProvider");
    return ctx;
}
