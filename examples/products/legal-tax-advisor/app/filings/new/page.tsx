"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

const ASSESSMENT_YEARS = ["2025-26", "2024-25", "2023-24"];

export default function NewFilingPage() {
  const router = useRouter();
  const [assessmentYear, setAssessmentYear] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessmentYear) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.createFiling({
        type: "ITR",
        assessmentYear,
        formType: "ITR-1",
      });
      router.push(`/filings/${res.id}/edit`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create filing");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/filings"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to filings
        </Link>

        <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-card">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">Start new filing</h1>
            <p className="mt-1.5 text-muted-foreground leading-relaxed">
              Choose the assessment year for your Income Tax Return (ITR-1).
            </p>
          </div>

          <form onSubmit={handleStart} className="space-y-6">
            {error && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="year">Assessment year</Label>
              <select
                id="year"
                value={assessmentYear}
                onChange={(e) => setAssessmentYear(e.target.value)}
                required
                disabled={submitting}
                className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select year</option>
                {ASSESSMENT_YEARS.map((y) => (
                  <option key={y} value={y}>
                    AY {y}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                e.g. AY 2025-26 is for income earned in FY 2024-25.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={!assessmentYear || submitting} className="rounded-xl">
                {submitting ? "Creating…" : "Continue to form"}
              </Button>
              <Link href="/filings">
                <Button type="button" variant="outline" className="rounded-xl">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
