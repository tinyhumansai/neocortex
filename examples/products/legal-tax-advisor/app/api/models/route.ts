import { NextRequest, NextResponse } from "next/server";
import { AVAILABLE_MODELS } from "@/lib/server/openai";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
    return NextResponse.json(AVAILABLE_MODELS);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
