"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { candidateMe, clearCandidateToken, getCandidateToken, type CandidateDossier } from "./api";

const SESSION_POLL_INTERVAL = 15_000; // 15 secondes

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
    /** True quand une autre session a invalidé celle-ci */
    sessionInvalidated: boolean;
    /** Confirme la déconnexion après affichage du message */
    confirmSessionLogout: () => void;
}

const Ctx = createContext<CandidateCtx | undefined>(undefined);

export function CandidateProvider({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [dossiers, setDossiers] = useState<CandidateDossier[]>([]);
    const [activeDossierId, setActiveDossierId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [examActive, setExamActive] = useState(false);
    const [sessionInvalidated, setSessionInvalidated] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        } catch (err: any) {
            if (err?.message === "SESSION_INVALIDEE") {
                // Ne pas déconnecter immédiatement — afficher le modal d'abord
                setSessionInvalidated(true);
            } else {
                clearCandidateToken();
                router.replace("/candidat/login");
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    const logout = useCallback(() => {
        clearCandidateToken();
        if (typeof sessionStorage !== "undefined") sessionStorage.clear();
        window.location.href = "/candidat/login";
    }, []);

    const confirmSessionLogout = useCallback(() => {
        clearCandidateToken();
        if (typeof sessionStorage !== "undefined") sessionStorage.clear();
        window.location.href = "/candidat/login?reason=autre_appareil";
    }, []);

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

    // Polling silencieux toutes les 15s :
    // - Détecte une session invalidée (autre appareil)
    // - Rafraîchit les données dossier (statut examen, corrections…)
    //   pour que le tableau de bord se mette à jour sans navigation.
    useEffect(() => {
        const checkSession = async () => {
            if (!getCandidateToken() || sessionInvalidated) return;
            try {
                const data = await candidateMe();
                // Mettre à jour le state avec les données fraîches
                const rawDossiers: CandidateDossier[] = (data as any).dossiers ?? [data];
                setDossiers(rawDossiers);
                setActiveDossierId(prev =>
                    rawDossiers.find(d => d._id === prev) ? prev : (rawDossiers[0]?._id ?? null)
                );
            } catch (err: any) {
                if (err?.message === "SESSION_INVALIDEE") {
                    setSessionInvalidated(true);
                }
                // Autres erreurs réseau → silencieux, on réessaiera au prochain tick
            }
        };

        pollRef.current = setInterval(checkSession, SESSION_POLL_INTERVAL);
        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    // On relance le polling si sessionInvalidated change (pour stopper proprement)
    }, [sessionInvalidated]);

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
            sessionInvalidated,
            confirmSessionLogout,
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
