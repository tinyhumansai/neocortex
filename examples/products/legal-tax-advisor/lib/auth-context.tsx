"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { config, getBackendHeaders } from "./config";

const TOKEN_KEY = "lexai_token";
const BASE = config.BACKEND_URL || "";

interface User {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  onboardingCompleted?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  token: string | null;
  signOut: () => void;
  setToken: (token: string | null, initialUser?: User | null) => void;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);

  const setToken = useCallback((t: string | null, initialUser?: User | null) => {
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
      setTokenState(t);
      if (initialUser !== undefined) {
        setUser(initialUser);
        setLoading(false);
      }
    } else {
      localStorage.removeItem(TOKEN_KEY);
      setTokenState(null);
      setUser(null);
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
  }, [setToken]);

  const refetchUser = useCallback(async () => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;
    try {
      const res = await fetch(`${BASE}/api/auth/me`, {
        headers: { ...getBackendHeaders(), Authorization: `Bearer ${stored}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    setTokenState(stored);
    if (user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`${BASE}/api/auth/me`, {
      headers: { ...getBackendHeaders(), Authorization: `Bearer ${stored}` },
    })
      .then((res) => {
        if (res.ok) return res.json();
        setToken(null);
      })
      .then((data) => {
        if (data) setUser(data);
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [setToken, token, user]);

  return (
    <AuthContext.Provider value={{ user, loading, token, signOut, setToken, refetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
