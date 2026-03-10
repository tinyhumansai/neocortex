"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ITRPayload } from "@/lib/types/filing";
import { ArrowLeft, ArrowRight, User, Coins, FileCheck, Send } from "lucide-react";

const STEPS = [
  { id: 1, title: "Personal details", icon: User },
  { id: 2, title: "Income & deductions", icon: Coins },
  { id: 3, title: "Tax summary", icon: FileCheck },
  { id: 4, title: "Review & submit", icon: Send },
];

const defaultPayload: ITRPayload = {
  personal: {},
  income: {},
  deductions: {},
};

export default function EditFilingPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [filing, setFiling] = useState<{
    id: string;
    assessmentYear: string;
    formType?: string;
    status: string;
    payload: ITRPayload;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState<ITRPayload>(defaultPayload);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getFiling(id);
      setFiling(data);
      setPayload(
        data.payload && typeof data.payload === "object"
          ? { ...defaultPayload, ...data.payload }
          : defaultPayload
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const savePayload = async (next: number) => {
    setSaving(true);
    setError(null);
    try {
      await api.updateFiling(id, payload as Record<string, unknown>);
      setStep(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.updateFiling(id, payload as Record<string, unknown>);
      await api.submitFiling(id);
      router.push("/filings");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
      setSubmitting(false);
    }
  };

  if (loading || !filing) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        {error ? (
          <div className="text-destructive">{error}</div>
        ) : (
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        )}
      </div>
    );
  }

  if (filing.status !== "draft") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-muted-foreground">This filing has already been submitted.</p>
        <Link href="/filings">
          <Button>Back to filings</Button>
        </Link>
      </div>
    );
  }

  const updatePersonal = (key: keyof NonNullable<ITRPayload["personal"]>, value: string) => {
    setPayload((p) => ({
      ...p,
      personal: { ...p.personal, [key]: value },
    }));
  };

  const updateIncome = (key: keyof NonNullable<ITRPayload["income"]>, value: number) => {
    setPayload((p) => ({
      ...p,
      income: { ...p.income, [key]: value ?? 0 },
    }));
  };

  const updateDeductions = (key: keyof NonNullable<ITRPayload["deductions"]>, value: number) => {
    setPayload((p) => ({
      ...p,
      deductions: { ...p.deductions, [key]: value ?? 0 },
    }));
  };

  const income = payload.income ?? {};
  const deductions = payload.deductions ?? {};
  const grossIncome = (income.salary ?? 0) + (income.otherIncome ?? 0) + (income.interest ?? 0);
  const totalDeductions =
    (deductions.section80C ?? 0) +
    (deductions.section80D ?? 0) +
    (deductions.hra ?? 0) +
    (deductions.other ?? 0);
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);
  const taxSlab =
    taxableIncome <= 7_00_000
      ? 0
      : taxableIncome <= 10_00_000
        ? 0.05
        : taxableIncome <= 12_50_000
          ? 0.1
          : taxableIncome <= 15_00_000
            ? 0.15
            : 0.2;
  const taxAmount = Math.round(taxableIncome * taxSlab);

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/filings"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to filings
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">
            {filing.formType ?? "ITR-1"} — AY {filing.assessmentYear}
          </h1>
          <p className="mt-1.5 text-muted-foreground leading-relaxed">
            Complete the form and submit.
          </p>
        </div>

        <div className="mb-8 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => step > s.id && setStep(s.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
                  step === s.id
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : step > s.id
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-muted/50 text-muted-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {s.title}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">Personal details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                  id="fullName"
                  value={payload.personal?.fullName ?? ""}
                  onChange={(e) => updatePersonal("fullName", e.target.value)}
                  placeholder="As per PAN"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pan">PAN</Label>
                <Input
                  id="pan"
                  value={payload.personal?.pan ?? ""}
                  onChange={(e) => updatePersonal("pan", e.target.value.toUpperCase())}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={payload.personal?.dateOfBirth ?? ""}
                  onChange={(e) => updatePersonal("dateOfBirth", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={payload.personal?.mobile ?? ""}
                  onChange={(e) => updatePersonal("mobile", e.target.value)}
                  placeholder="10-digit"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={payload.personal?.address ?? ""}
                onChange={(e) => updatePersonal("address", e.target.value)}
                placeholder="Full address"
              />
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => savePayload(2)} disabled={saving}>
                {saving ? "Saving…" : "Next"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">Income & deductions</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="salary">Salary (₹)</Label>
                <Input
                  id="salary"
                  type="number"
                  min={0}
                  value={payload.income?.salary ?? ""}
                  onChange={(e) => updateIncome("salary", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherIncome">Other income (₹)</Label>
                <Input
                  id="otherIncome"
                  type="number"
                  min={0}
                  value={payload.income?.otherIncome ?? ""}
                  onChange={(e) => updateIncome("otherIncome", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interest">Interest (₹)</Label>
                <Input
                  id="interest"
                  type="number"
                  min={0}
                  value={payload.income?.interest ?? ""}
                  onChange={(e) => updateIncome("interest", Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <h3 className="pt-4 text-sm font-medium text-muted-foreground">Deductions</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="80C">80C (e.g. PPF, ELSS) (₹)</Label>
                <Input
                  id="80C"
                  type="number"
                  min={0}
                  value={payload.deductions?.section80C ?? ""}
                  onChange={(e) => updateDeductions("section80C", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="80D">80D (health insurance) (₹)</Label>
                <Input
                  id="80D"
                  type="number"
                  min={0}
                  value={payload.deductions?.section80D ?? ""}
                  onChange={(e) => updateDeductions("section80D", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hra">HRA (₹)</Label>
                <Input
                  id="hra"
                  type="number"
                  min={0}
                  value={payload.deductions?.hra ?? ""}
                  onChange={(e) => updateDeductions("hra", Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherDed">Other (₹)</Label>
                <Input
                  id="otherDed"
                  type="number"
                  min={0}
                  value={payload.deductions?.other ?? ""}
                  onChange={(e) => updateDeductions("other", Number(e.target.value) || 0)}
                />
              </div>
            </div>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button onClick={() => savePayload(3)} disabled={saving}>
                {saving ? "Saving…" : "Next"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">Tax summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gross income</span>
                <span>₹ {grossIncome.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total deductions</span>
                <span>₹ {totalDeductions.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>Taxable income</span>
                <span>₹ {taxableIncome.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated tax (simplified)</span>
                <span>₹ {taxAmount.toLocaleString("en-IN")}</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This is an indicative calculation. Actual tax may vary with rebates and rules.
            </p>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button onClick={() => savePayload(4)} disabled={saving}>
                {saving ? "Saving…" : "Next"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 rounded-2xl border border-border/80 bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold tracking-tight">Review & submit</h2>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                {payload.personal?.fullName || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">PAN:</span> {payload.personal?.pan || "—"}
              </p>
              <p>
                <span className="text-muted-foreground">Taxable income:</span> ₹{" "}
                {taxableIncome.toLocaleString("en-IN")}
              </p>
              <p>
                <span className="text-muted-foreground">Estimated tax:</span> ₹{" "}
                {taxAmount.toLocaleString("en-IN")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Submitting will mark this filing as submitted. In a full product, this would integrate
              with the income tax portal.
            </p>
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit filing"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
