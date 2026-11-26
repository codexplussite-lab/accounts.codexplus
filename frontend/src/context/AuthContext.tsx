"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  apiClient,
  setAuthToken,
  getAuthToken,
  setActiveCompanyId,
  getActiveCompanyId,
  clearSession,
  refreshAccessToken,
  registerAuthFailedListener
} from "@/lib/api";

export type AuthStatus = "INITIALIZING" | "AUTHENTICATED" | "UNAUTHENTICATED";

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Company {
  id: string;
  name: string;
  currency: string;
  role: string;
}

interface AuthContextType {
  status: AuthStatus;
  user: User | null;
  companies: Company[];
  activeCompany: Company | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
    currency?: string;
    ntn?: string;
    address?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  switchCompany: (companyId: string) => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [status, setStatus] = useState<AuthStatus>("INITIALIZING");
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompany, setActiveCompanyState] = useState<Company | null>(null);

  const isAuthRoute = pathname === "/login" || pathname === "/register";

  const initAuth = useCallback(async () => {
    setStatus("INITIALIZING");

    let token = getAuthToken();

    // If no token in memory/storage, attempt cookie-based silent refresh
    if (!token) {
      token = await refreshAccessToken();
    }

    if (!token) {
      setStatus("UNAUTHENTICATED");
      setUser(null);
      setCompanies([]);
      setActiveCompanyState(null);
      return;
    }

    try {
      const meRes = await apiClient<{
        id: string;
        email: string;
        name: string;
        companies: Company[];
      }>("/auth/me");

      const userData: User = {
        id: meRes.data.id,
        email: meRes.data.email,
        name: meRes.data.name
      };
      const userCompanies: Company[] = meRes.data.companies || [];

      setUser(userData);
      setCompanies(userCompanies);

      const savedCompanyId = getActiveCompanyId();
      const matchedCompany =
        userCompanies.find((c) => c.id === savedCompanyId) || userCompanies[0] || null;

      if (matchedCompany) {
        setActiveCompanyState(matchedCompany);
        setActiveCompanyId(matchedCompany.id);
      }

      setStatus("AUTHENTICATED");
    } catch {
      clearSession();
      setStatus("UNAUTHENTICATED");
      setUser(null);
      setCompanies([]);
      setActiveCompanyState(null);
    }
  }, []);

  useEffect(() => {
    registerAuthFailedListener(() => {
      setStatus("UNAUTHENTICATED");
      setUser(null);
      setCompanies([]);
      setActiveCompanyState(null);
    });

    initAuth();
  }, [initAuth]);

  // Route protection: redirect unauthenticated users to /login
  useEffect(() => {
    if (status === "UNAUTHENTICATED" && !isAuthRoute) {
      router.replace("/login");
    } else if (status === "AUTHENTICATED" && isAuthRoute) {
      router.replace("/");
    }
  }, [status, isAuthRoute, router]);

  const login = async (credentials: { email: string; password: string }) => {
    const res = await apiClient<{
      user: User;
      companies: Company[];
      accessToken: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials)
    });

    setAuthToken(res.data.accessToken);
    setUser(res.data.user);
    setCompanies(res.data.companies || []);

    const firstCompany = res.data.companies?.[0] || null;
    if (firstCompany) {
      setActiveCompanyState(firstCompany);
      setActiveCompanyId(firstCompany.id);
    }

    setStatus("AUTHENTICATED");
    router.replace("/");
  };

  const registerUser = async (data: {
    name: string;
    email: string;
    password: string;
    companyName: string;
    currency?: string;
    ntn?: string;
    address?: string;
  }) => {
    const res = await apiClient<{
      user: User;
      company: Company;
      accessToken: string;
    }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data)
    });

    setAuthToken(res.data.accessToken);
    setUser(res.data.user);
    const comps = [res.data.company];
    setCompanies(comps);
    setActiveCompanyState(res.data.company);
    setActiveCompanyId(res.data.company.id);

    setStatus("AUTHENTICATED");
    router.replace("/");
  };

  const logout = async () => {
    try {
      await apiClient("/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      clearSession();
      setStatus("UNAUTHENTICATED");
      setUser(null);
      setCompanies([]);
      setActiveCompanyState(null);
      router.replace("/login");
    }
  };

  const switchCompany = (companyId: string) => {
    const selected = companies.find((c) => c.id === companyId);
    if (selected) {
      setActiveCompanyState(selected);
      setActiveCompanyId(selected.id);
      window.location.reload(); // Refresh ledger caches for company
    }
  };

  const refreshSession = async (): Promise<boolean> => {
    const token = await refreshAccessToken();
    if (token) {
      await initAuth();
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        status,
        user,
        companies,
        activeCompany,
        login,
        register: registerUser,
        logout,
        switchCompany,
        refreshSession
      }}
    >
      {status === "INITIALIZING" && !isAuthRoute ? (
        <div className="min-h-screen bg-canvas flex flex-col items-center justify-center space-y-4">
          <div className="w-10 h-10 rounded bg-ink-primary flex items-center justify-center text-white font-mono font-bold text-sm shadow-subtle animate-pulse">
            ERP
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-ink-secondary">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Verifying enterprise session...</span>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
