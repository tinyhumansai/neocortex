"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { config, getBackendHeaders } from "@/lib/config";

const BASE = config.BACKEND_URL || "";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setToken } = useAuth();
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    const token = searchParams.get("token");
    const error = searchParams.get("error");

    if (error) {
      done.current = true;
      router.replace(`/login?error=${encodeURIComponent(error)}`);
      return;
    }

    if (!token) {
      done.current = true;
      router.replace("/login");
      return;
    }

    done.current = true;

    // Fetch /me once: decide redirect and pass user so target page doesn't show loading
    fetch(`${BASE}/api/auth/me`, {
      headers: { ...getBackendHeaders(), Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setToken(token, data ?? null);
        const next = data?.onboardingCompleted ? "/chat" : "/onboarding";
        router.replace(next);
      })
      .catch(() => {
        setToken(token);
        router.replace("/chat");
      });
  }, [searchParams, setToken, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
