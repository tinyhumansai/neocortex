"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, Shield, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    title: "Welcome to LexAI",
    description:
      "Your AI-powered Legal & Tax Assistant for India. Get accurate guidance on income tax, GST, and compliance—backed by CA study material and official sources.",
    icon: Shield,
  },
  {
    title: "Ask anything in Chat",
    description:
      "Use the Chat to ask tax questions, understand deductions (80C, 80D, HRA), or get help with contracts and compliance. Answers are grounded in ingested CA books and official content.",
    icon: MessageSquare,
  },
  {
    title: "File your taxes",
    description:
      "Go to Tax Filings to start your ITR. Complete the step-by-step form (personal details, income, deductions), review, and submit. Tailored for Indian individual taxpayers.",
    icon: FileText,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading: authLoading, refetchUser } = useAuth();
  const [step, setStep] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.onboardingCompleted) {
      router.replace("/chat");
    }
  }, [user, authLoading, router]);

  const handleGetStarted = async () => {
    setError(null);
    setCompleting(true);
    try {
      await api.completeOnboarding();
      await refetchUser();
      router.replace("/chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setCompleting(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const current = STEPS[step];
  const Icon = current?.icon ?? Shield;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-slate-200/80 bg-white/95 p-8 shadow-card-hover backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 sm:p-10">
          <div className="mb-8 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-4 ring-primary/5">
              <Icon className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-center text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            {current?.title}
          </h1>
          <p className="mt-4 text-center leading-relaxed text-slate-600 dark:text-slate-400">
            {current?.description}
          </p>

          <div className="mt-8 flex justify-center gap-2.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Step ${i + 1}`}
                className={cn(
                  "h-2.5 w-2.5 rounded-full transition-all duration-200",
                  i === step
                    ? "bg-primary scale-110 shadow-sm"
                    : i < step
                      ? "bg-primary/60"
                      : "bg-slate-200 dark:bg-slate-700"
                )}
                onClick={() => setStep(i)}
              />
            ))}
          </div>

          {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
            {!isLast ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                  className="rounded-xl"
                >
                  Back
                </Button>
                <Button onClick={() => setStep((s) => s + 1)} className="rounded-xl min-w-[120px]">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={handleGetStarted}
                disabled={completing}
                className="min-w-[200px] rounded-xl"
              >
                {completing ? (
                  "Setting up…"
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Get started
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">
          You can revisit Tax Filings anytime from the sidebar.
        </p>
      </div>
    </div>
  );
}
