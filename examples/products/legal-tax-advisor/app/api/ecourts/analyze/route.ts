import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/server/auth";
import { openai, AVAILABLE_MODELS } from "@/lib/server/openai";
import { buildSystemPrompt } from "@/lib/server/utils/systemPrompt";
import { getRelevantBookChunks } from "@/lib/server/services/bookAbsorption";

const schema = z.object({
  cnr: z.string().min(1),
  question: z.string().min(1).max(5000).optional(),
  model: z.string().default("gpt-4o"),
  caseDetails: z
    .object({
      text: z.string(),
      fields: z.record(z.string()).optional(),
      fetchedAt: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/ecourts/analyze
 * Body: { cnr, question?, model? }
 *
 * Flow:
 * - Fetch case details from eCourts
 * - Retrieve relevant context from Chroma (existing ingested PDFs)
 * - Ask the LLM to summarize case status + answer the advocate’s question
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { cnr, question, model, caseDetails } = parsed.data;
  if (!caseDetails?.text) {
    return NextResponse.json(
      { error: "Fetch case details first, then use Analyze with AI." },
      { status: 400 }
    );
  }
  const validModel = AVAILABLE_MODELS.find((m: { id: string }) => m.id === model)?.id ?? "gpt-4o";

  try {
    const userQuery =
      question?.trim() || "Summarize the current case status and key next steps for an advocate.";

    const retrievalQuery = `${userQuery}\n\nCase details:\n${caseDetails.text.slice(0, 4000)}`;
    const bookContext = await getRelevantBookChunks(retrievalQuery, 10);
    // Build case context with both raw text and structured fields so the model can "explain fields"
    const fieldsBlock =
      caseDetails.fields && Object.keys(caseDetails.fields).length > 0
        ? `\nCase fields (key-value from eCourts):\n${Object.entries(caseDetails.fields)
            .map(([k, v]) => `- ${k}: ${v}`)
            .join("\n")}\n`
        : "";
    const caseContext = `CNR: ${cnr}\n${caseDetails.fetchedAt ? `FetchedAt: ${caseDetails.fetchedAt}\n` : ""}\nCase text:\n${caseDetails.text}${fieldsBlock}`;

    const caseInstruction = `IMPORTANT: The user is asking about the case they just fetched from eCourts (CNR above). Answer ONLY using the case details below. If they ask to "explain the fields" or "explain fields", explain the case data fields (the key-value pairs) from the case details, not general legal practice areas. Do not give a generic overview of legal specializations.`;
    const systemPrompt = buildSystemPrompt(
      "",
      bookContext || undefined,
      caseInstruction + "\n\n" + caseContext
    );

    const completion = await openai.chat.completions.create({
      model: validModel,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    });

    const answer = completion.choices[0]?.message?.content ?? "";
    return NextResponse.json({
      cnr,
      fetchedAt: caseDetails.fetchedAt ?? null,
      answer,
      caseDetails: { fields: caseDetails.fields ?? {} },
      context: { usedBookContext: !!bookContext },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
