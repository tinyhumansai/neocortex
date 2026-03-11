import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { getEcourtsCaptchaImage } from "@/lib/server/services/ecourts";

/** GET /api/ecourts/captcha — Return a fresh CAPTCHA image and sessionId for manual solve. */
export async function GET(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  try {
    const { sessionId, captchaImage } = await getEcourtsCaptchaImage();
    return NextResponse.json({ sessionId, captchaImage });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
