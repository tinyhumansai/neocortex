"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar, CheckCircle } from "lucide-react";
import type { ITRPayload } from "@/lib/types/filing";

export default function FilingDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [filing, setFiling] = useState<{
    id: string;
    type: string;
    formType?: string;
    assessmentYear: string;
    status: string;
    payload: ITRPayload;
    referenceNumber?: string;
    submittedAt?: string;
    updatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getFiling(id)
      .then(setFiling)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !filing) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-destructive">{error ?? "Not found"}</p>
        <Link href="/filings">
          <Button>Back to filings</Button>
        </Link>
      </div>
    );
  }

  const payload = filing.payload ?? {};
  const income = payload.income ?? {};
  const deductions = payload.deductions ?? {};
  const grossIncome = (income.salary ?? 0) + (income.otherIncome ?? 0) + (income.interest ?? 0);
  const totalDeductions =
    (deductions.section80C ?? 0) +
    (deductions.section80D ?? 0) +
    (deductions.hra ?? 0) +
    (deductions.other ?? 0);
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  return (
    <div className="flex flex-1 flex-col overflow-auto p-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/filings"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to filings
        </Link>

        <div className="mb-6 flex items-start gap-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-500/20">
            <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {filing.formType ?? filing.type} — AY {filing.assessmentYear}
            </h1>
            <p className="mt-1 text-muted-foreground">Submitted</p>
            {filing.referenceNumber && (
              <p className="mt-2 text-sm font-medium">Ref: {filing.referenceNumber}</p>
            )}
            {filing.submittedAt && (
              <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                {new Date(filing.submittedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
          <h2 className="text-lg font-semibold tracking-tight">Summary</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd>{payload.personal?.fullName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">PAN</dt>
              <dd>{payload.personal?.pan ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gross income</dt>
              <dd>₹ {grossIncome.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Deductions</dt>
              <dd>₹ {totalDeductions.toLocaleString("en-IN")}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Taxable income</dt>
              <dd>₹ {taxableIncome.toLocaleString("en-IN")}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
