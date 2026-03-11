import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth } from "@/lib/server/auth";
import { fetchEcourtsCaseByCnrWithCaptcha } from "@/lib/server/services/ecourts";
import { getCaseByCnrFromChroma } from "@/lib/server/services/caseAbsorption";
import { Case } from "@/lib/server/models";

const schema = z.object({
  sessionId: z.string().min(1),
  cnr: z.string().min(1),
  captchaText: z.string().min(1),
});

/** POST /api/ecourts/cnr — Fetch eCourts case details by CNR using manual CAPTCHA. */
export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const cnrNormalized = parsed.data.cnr.trim().toUpperCase();

  try {
    const existing = (await Case.findOne({
      userId: new mongoose.Types.ObjectId(user.id),
      cnr: cnrNormalized,
    }).lean()) as {
      cnr: string;
      caseDetails?: {
        text?: string;
        fields?: Record<string, string>;
        rawHtml?: string;
        fetchedAt?: string;
      };
    } | null;

    if (existing?.caseDetails) {
      return NextResponse.json({
        userId: user.id,
        cnr: existing.cnr,
        fetchedAt: existing.caseDetails.fetchedAt,
        rawHtml: existing.caseDetails.rawHtml,
        text: existing.caseDetails.text,
        fields: existing.caseDetails.fields ?? {},
      });
    }

    const chromaText = await getCaseByCnrFromChroma(cnrNormalized);
    if (chromaText) {
      return NextResponse.json({
        userId: user.id,
        cnr: cnrNormalized,
        fetchedAt: "from ingested cases",
        text: chromaText,
        fields: {},
      });
    }

    const result = await fetchEcourtsCaseByCnrWithCaptcha(
      parsed.data.sessionId,
      parsed.data.cnr,
      parsed.data.captchaText
    );
    return NextResponse.json({ userId: user.id, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
