"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
    fetchCandidateMe,
    clearCandidateAccountToken,
    getCandidateAccountToken,
    type CandidateAccount,
    type CandidateApplication,
} from "./api";

interface AccountCtx {
    account: CandidateAccount | null;
    applications: CandidateApplication[];
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => void;
}

const Ctx = createContext<AccountCtx | undefined>(undefined);

export function CandidateAccountProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [account, setAccount] = useState<CandidateAccount | null>(null);
    const [applications, setApplications] = useState<CandidateApplication[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchCandidateMe();
            setAccount(data.account);
            setApplications(data.applications || []);
        } catch {
            clearCandidateAccountToken();
            router.replace("/candidat/login");
        } finally {
            setLoading(false);
        }
    }, [router]);

    const logout = useCallback(() => {
        clearCandidateAccountToken();
        router.replace("/candidat/login");
    }, [router]);

    useEffect(() => {
        if (!getCandidateAccountToken()) {
            router.replace("/candidat/login");
            return;
        }
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    return (
        <Ctx.Provider value={{ account, applications, loading, refresh, logout }}>
            {children}
        </Ctx.Provider>
    );
}

export function useCandidateAccount() {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error("useCandidateAccount must be used inside CandidateAccountProvider");
    return ctx;
}
