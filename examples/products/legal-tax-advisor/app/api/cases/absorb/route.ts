import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getConfig } from "@/lib/server/config";
import { absorbAllCases, listCaseFolders } from "@/lib/server/services/caseAbsorption";
import { z } from "zod";

const schema = z.object({
  sourcePath: z.string().optional(),
});

function isAbsorbAuthorized(req: NextRequest): boolean {
  const secret = getConfig().CASES_ABSORB_SECRET;
  if (!secret) return false;
  return req.headers.get("X-Cases-Absorb-Secret") === secret;
}

/**
 * GET /api/cases/absorb — List case folders available for ingestion.
 * POST /api/cases/absorb — Ingest all cases from scraped-cases into Chroma.
 *
 * Auth: JWT Bearer token, or X-Cases-Absorb-Secret header when CASES_ABSORB_SECRET is set.
 * Body: { sourcePath?: string } — Override path. Default: SCRAPED_CASES_PATH env.
 */
export async function GET(req: NextRequest) {
  if (!isAbsorbAuthorized(req)) {
    try {
      await requireAuth(req);
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  }

  const { searchParams } = new URL(req.url);
  const sourcePath = searchParams.get("path") || getConfig().SCRAPED_CASES_PATH;
  if (!sourcePath) {
    return NextResponse.json(
      {
        error: "SCRAPED_CASES_PATH not set. Add to .env.local or pass ?path=/path/to/scraped-cases",
      },
      { status: 400 }
    );
  }

  try {
    const folders = await listCaseFolders(sourcePath);
    return NextResponse.json({
      sourcePath,
      count: folders.length,
      cnrs: folders.map((f) => f.split("/").pop()),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list cases" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  if (!isAbsorbAuthorized(req)) {
    try {
      await requireAuth(req);
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  const sourcePath = parsed.data?.sourcePath || getConfig().SCRAPED_CASES_PATH;

  if (!sourcePath) {
    return NextResponse.json(
      {
        error:
          'SCRAPED_CASES_PATH not set. Add to .env.local or pass { sourcePath: "/path/to/scraped-cases" }',
      },
      { status: 400 }
    );
  }

  try {
    const results = await absorbAllCases(sourcePath);
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    return NextResponse.json({
      sourcePath,
      total: results.length,
      succeeded: succeeded.length,
      failed: failed.length,
      results,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to absorb cases" },
      { status: 500 }
    );
  }
}
