import { NextRequest, NextResponse } from "next/server";
import { getConfig } from "@/lib/server/config";
import { logger } from "@/lib/server/logger";
import { generateState, storeOAuthState } from "@/lib/server/services/oauth";
import { getGoogleAuthUrl } from "@/lib/server/services/oauth/google";

function buildCallbackUrl(): string {
  const c = getConfig();
  return `${c.APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`;
}

function getFrontendUrl(): string {
  return getConfig().APP_URL.replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  const redirectUri =
    req.nextUrl.searchParams.get("redirect_uri") || `${getFrontendUrl()}/oauth-callback`;
  const state = generateState();
  logger.info("Google OAuth start", { redirectUri });
  await storeOAuthState(state, { redirectUri });
  const callbackUrl = buildCallbackUrl();
  logger.info("Google OAuth redirect_uri sent to Google", { callbackUrl });
  const authUrl = getGoogleAuthUrl(state, callbackUrl);
  return NextResponse.redirect(authUrl);
}
