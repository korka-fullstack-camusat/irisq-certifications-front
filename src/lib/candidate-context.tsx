"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { candidateMe, clearCandidateToken, getCandidateToken, type CandidateAccount } from "./api";

interface CandidateCtx {
    account: CandidateAccount | null;
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => void;
    setAccount: (a: CandidateAccount) => void;
}

const Ctx = createContext<CandidateCtx | undefined>(undefined);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [account, setAccount] = useState<CandidateAccount | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await candidateMe();
            setAccount(data);
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
        <Ctx.Provider value={{ account, loading, refresh, logout, setAccount }}>
            {children}
        </Ctx.Provider>
    );
}

export function useCandidate() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useCandidate must be used inside CandidateProvider");
    return ctx;
}
