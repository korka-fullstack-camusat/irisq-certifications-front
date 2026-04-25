"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { API_URL } from "./api";

interface User {
    id: string;
    email: string;
    role: string;
    full_name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check if token exists in localStorage on initial load
        const storedToken = localStorage.getItem("auth_token");
        if (storedToken) {
            setToken(storedToken);
            fetchUserProfil(storedToken);
        } else {
            setIsLoading(false);
            checkProtectedRoutes(null, pathname);
        }
    }, []);

    const fetchUserProfil = async (authToken: string) => {
        try {
            const res = await fetch(`${API_URL}/me`, {
                headers: {
                    Authorization: `Bearer ${authToken}`
                }
            });
            if (res.ok) {
                const userData = await res.json();
                setUser(userData);
                checkProtectedRoutes(userData.role, pathname);
            } else {
                // Token is invalid or expired
                logout();
            }
        } catch (err) {
            console.error("Failed to fetch user profile", err);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    const checkProtectedRoutes = (role: string | null, currentPath: string) => {
        if (
            currentPath.startsWith("/examen/") ||
            currentPath.startsWith("/demande-certification") ||
            currentPath.startsWith("/candidat")
        ) {
            // Public / candidate routes
            return;
        }

        if (!role && currentPath !== "/login" && currentPath !== "/") {
            router.push("/login");
            return;
        }

        // Role-based redirection if trying to access unauthorized route
        if (role === "RH" && !currentPath.startsWith("/dashboard")) {
            router.push("/dashboard");
        } else if (role === "EVALUATEUR" && !currentPath.startsWith("/evaluateur")) {
            router.push("/evaluateur/dashboard");
        } else if (role === "CORRECTEUR" && !currentPath.startsWith("/correcteur")) {
            router.push("/correcteur");
        }
    };

    const login = (newToken: string, newUser: User) => {
        localStorage.setItem("auth_token", newToken);
        setToken(newToken);
        setUser(newUser);
        checkProtectedRoutes(newUser.role, pathname);
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        setToken(null);
        setUser(null);
        router.push("/login");
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
