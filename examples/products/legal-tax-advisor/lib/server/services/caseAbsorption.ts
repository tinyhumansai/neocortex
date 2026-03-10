import path from "path";
import fs from "fs/promises";
import { getBooksCollection, getBooksCollectionForRead, isChromaEnabled } from "../chroma";
import { logger } from "../logger";
import debug from "debug";

const log = debug("app:cases:absorb");
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const CHROMA_BATCH = 100;

const CHROMA_REQUIRED_MSG =
  "Chroma is required for case absorption. Set CHROMA_URL and run: npm run chroma";

interface StructuredCase {
  cnr?: string;
  filing?: { filing_date?: string; filing_number?: string };
  registration?: { registration_date?: string; registration_number?: string };
  status?: {
    stage?: string;
    coram?: string;
    bench_type?: string;
    case_status?: string;
    state?: string;
    district?: string;
  };
  petitioners?: Array<{ name?: string; advocates?: string[] }>;
  respondents?: Array<{ name?: string; advocates?: string[] }>;
  acts?: Array<{ act?: string; article?: string; section?: string }>;
  hearings?: Array<{ judge?: string; purpose?: string; hearing_date?: string }>;
  orders?: Array<{ order_number?: string; judge?: string; order_date?: string }>;
  [key: string]: unknown;
}

interface SummaryCase {
  cnr?: string;
  summary?: string;
  order_summary?: Array<{
    order_date?: string;
    summary?: string;
    order_number?: string;
    judges?: string[];
    petitioners?: string[];
    respondents?: string[];
    precedents?: Array<{ case_number?: string; court_name?: string; purpose?: string }>;
  }>;
}

export interface CaseAbsorbResult {
  cnr: string;
  totalChunks: number;
  success: boolean;
  error?: string;
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  if (!text || text.length <= size) return text ? [text] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const nextNewline = text.indexOf("\n", end);
      if (nextNewline !== -1 && nextNewline - end < 300) end = nextNewline + 1;
      else {
        const lastSpace = text.lastIndexOf(" ", end);
        if (lastSpace > start) end = lastSpace + 1;
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter(Boolean);
}

function buildCaseText(structured: StructuredCase, summary: SummaryCase): string {
  const parts: string[] = [];

  parts.push(`Case CNR: ${structured.cnr ?? summary.cnr ?? "unknown"}`);
  if (structured.filing) {
    parts.push(
      `Filing: ${structured.filing.filing_number ?? ""} (${structured.filing.filing_date ?? ""})`
    );
  }
  if (structured.registration) {
    parts.push(
      `Registration: ${structured.registration.registration_number ?? ""} (${structured.registration.registration_date ?? ""})`
    );
  }
  if (structured.status) {
    const s = structured.status;
    parts.push(
      `Status: ${s.case_status ?? ""} | Stage: ${s.stage ?? ""} | Coram: ${s.coram ?? ""} | Bench: ${s.bench_type ?? ""}`
    );
    parts.push(`Court: ${s.state ?? ""} - ${s.district ?? ""}`);
  }
  if (structured.petitioners?.length) {
    parts.push(
      "Petitioners: " +
        structured.petitioners
          .map((p) => `${p.name ?? ""}${p.advocates?.length ? ` (${p.advocates.join(", ")})` : ""}`)
          .join("; ")
    );
  }
  if (structured.respondents?.length) {
    parts.push(
      "Respondents: " +
        structured.respondents
          .map((r) => `${r.name ?? ""}${r.advocates?.length ? ` (${r.advocates.join(", ")})` : ""}`)
          .join("; ")
    );
  }
  if (structured.acts?.length) {
    const actsStr = structured.acts
      .filter((a) => a.act || a.section || a.article)
      .map((a) => [a.act, a.section, a.article].filter(Boolean).join(" "))
      .join("; ");
    if (actsStr) parts.push(`Acts/Sections: ${actsStr}`);
  }
  if (structured.hearings?.length) {
    parts.push(
      "Hearings: " +
        structured.hearings
          .slice(0, 10)
          .map((h) => `${h.hearing_date ?? ""} - ${h.judge ?? ""}: ${h.purpose ?? ""}`)
          .join(" | ")
    );
  }
  if (structured.orders?.length) {
    parts.push(
      "Orders: " +
        structured.orders
          .slice(0, 15)
          .map((o) => `#${o.order_number} ${o.order_date ?? ""} (${o.judge ?? ""})`)
          .join(" | ")
    );
  }

  if (summary.summary) {
    parts.push("\n--- Case Summary ---\n" + summary.summary);
  }
  if (summary.order_summary?.length) {
    parts.push("\n--- Order Summaries ---");
    for (const os of summary.order_summary.slice(0, 20)) {
      parts.push(`[${os.order_date ?? ""}] ${os.summary ?? ""}`);
      if (os.precedents?.length) {
        parts.push(
          "  Precedents: " +
            os.precedents.map((p) => p.case_number + " - " + (p.purpose ?? "")).join("; ")
        );
      }
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

/**
 * Absorb a single case folder (CNR-named) into Chroma.
 * Expects structured.json and summary.json in the folder.
 */
export async function absorbCase(caseDir: string): Promise<CaseAbsorbResult> {
  if (!isChromaEnabled()) throw new Error(CHROMA_REQUIRED_MSG);

  const cnr = path.basename(caseDir);
  const structuredPath = path.join(caseDir, "structured.json");
  const summaryPath = path.join(caseDir, "summary.json");

  const [structuredRaw, summaryRaw] = await Promise.all([
    fs.readFile(structuredPath, "utf-8").catch(() => null),
    fs.readFile(summaryPath, "utf-8").catch(() => null),
  ]);

  if (!structuredRaw && !summaryRaw) {
    throw new Error(`Case ${cnr}: missing structured.json and summary.json`);
  }

  const structured: StructuredCase = structuredRaw ? JSON.parse(structuredRaw) : {};
  const summary: SummaryCase = summaryRaw ? JSON.parse(summaryRaw) : {};

  const text = buildCaseText(structured, summary);
  if (!text.trim()) {
    throw new Error(`Case ${cnr}: no extractable text`);
  }

  const chunks = chunkText(text);
  log("absorbCase", { cnr, chunks: chunks.length, textLen: text.length });

  const collection = await getBooksCollection();
  await collection.delete({ where: { caseId: cnr } });

  const ids = chunks.map((_, i) => `case_${cnr}_${i}`);
  const metadatas = chunks.map(() => ({
    source: "case",
    caseId: cnr,
    cnr,
  }));

  for (let i = 0; i < chunks.length; i += CHROMA_BATCH) {
    await collection.add({
      ids: ids.slice(i, i + CHROMA_BATCH),
      documents: chunks.slice(i, i + CHROMA_BATCH),
      metadatas: metadatas.slice(i, i + CHROMA_BATCH),
    });
  }

  logger.info("Case absorbed", { cnr, totalChunks: chunks.length });
  return { cnr, totalChunks: chunks.length, success: true };
}

/**
 * Get case content by CNR from Chroma (ingested scraped cases).
 * Returns combined text of all chunks for that CNR, or null if not found.
 */
export async function getCaseByCnrFromChroma(cnr: string): Promise<string | null> {
  if (!isChromaEnabled()) return null;
  try {
    const collection = await getBooksCollectionForRead();
    const result = await collection.get({
      where: { caseId: { $eq: cnr } },
      include: ["documents"],
    });
    const docs = result.documents ?? [];
    if (!docs.length) return null;
    const combined = docs.filter(Boolean).join("\n\n---\n\n");
    return combined.trim() || null;
  } catch {
    return null;
  }
}

/**
 * List CNR folders in the scraped cases directory.
 */
export async function listCaseFolders(sourcePath: string): Promise<string[]> {
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && /^[A-Z0-9]{16,}$/i.test(e.name))
    .map((e) => path.join(sourcePath, e.name));
}

/**
 * Absorb all cases from the scraped cases directory.
 */
export async function absorbAllCases(sourcePath: string): Promise<CaseAbsorbResult[]> {
  const folders = await listCaseFolders(sourcePath);
  const results: CaseAbsorbResult[] = [];

  for (const folder of folders) {
    try {
      const result = await absorbCase(folder);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Case absorption failed", { folder, error: msg });
      results.push({ cnr: path.basename(folder), totalChunks: 0, success: false, error: msg });
    }
  }

  return results;
}
