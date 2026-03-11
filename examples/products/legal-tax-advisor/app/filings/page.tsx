"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle, FileText, Calendar, ChevronRight } from "lucide-react";

type FilingItem = {
  id: string;
  type: string;
  formType?: string;
  assessmentYear: string;
  status: string;
  referenceNumber?: string;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export default function FilingsPage() {
  const [filings, setFilings] = useState<FilingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFilings()
      .then(setFilings)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-auto p-4 sm:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Tax Filings</h1>
          <p className="text-muted-foreground leading-relaxed">
            File your Income Tax Return (ITR) for the assessment year. Start a new filing or
            continue a draft.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mb-6">
          <Link href="/filings/new">
            <Button className="w-full rounded-xl sm:w-auto" size="lg">
              <PlusCircle className="mr-2 h-5 w-5" />
              Start new filing
            </Button>
          </Link>
        </div>

        {filings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center sm:p-10">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <FileText className="h-7 w-7 text-primary" />
              </div>
              <p className="font-semibold text-foreground">No filings yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Start your first ITR filing to get started.
              </p>
              <Link href="/filings/new" className="mt-5 inline-block">
                <Button variant="outline" className="rounded-xl">
                  Start new filing
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {filings.map((f) => (
              <li key={f.id}>
                <Link
                  href={f.status === "draft" ? `/filings/${f.id}/edit` : `/filings/${f.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover sm:gap-4"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">
                        {f.formType ?? f.type} — AY {f.assessmentYear}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.status === "submitted"
                            ? "bg-green-500/20 text-green-700 dark:text-green-400"
                            : "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {f.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(f.updatedAt).toLocaleDateString()}
                      </span>
                      {f.referenceNumber && <span>Ref: {f.referenceNumber}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
