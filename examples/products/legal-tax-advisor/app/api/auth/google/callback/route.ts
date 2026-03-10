import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import mongoose from "mongoose";
import { getConfig } from "@/lib/server/config";
import { connectDb } from "@/lib/server/db/mongo";
import { User } from "@/lib/server/models";
import { getOAuthState, deleteOAuthState } from "@/lib/server/services/oauth";
import { exchangeGoogleCode, fetchGoogleUser } from "@/lib/server/services/oauth/google";
import { logger } from "@/lib/server/logger";

function getFrontendUrl(): string {
  return getConfig().APP_URL.replace(/\/+$/, "");
}

function redirectWithError(redirectUri: string, message: string): string {
  return `${redirectUri}?error=${encodeURIComponent(message)}`;
}

function redirectWithToken(redirectUri: string, token: string): string {
  const sep = redirectUri.includes("?") ? "&" : "?";
  return `${redirectUri}${sep}token=${encodeURIComponent(token)}`;
}

async function createJwt(userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(getConfig().JWT_SECRET);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setExpirationTime("7d")
    .sign(secret);
}

async function findOrCreateUser(
  provider: string,
  providerId: string,
  email: string,
  name?: string,
  image?: string
) {
  const user = await User.findOneAndUpdate(
    { provider, providerId },
    {
      $set: {
        email,
        name: name ?? null,
        image: image ?? null,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  return user;
}

export async function GET(req: NextRequest) {
  const { code, state, error } = Object.fromEntries(req.nextUrl.searchParams);
  const redirectUri = `${getFrontendUrl()}/oauth-callback`;
  logger.info("Google OAuth callback", { hasCode: !!code, hasState: !!state, error });

  if (error) {
    logger.warn("Google OAuth error from provider:", error);
    return NextResponse.redirect(redirectWithError(redirectUri, String(error)));
  }

  const stateData = await getOAuthState(String(state));
  const finalRedirect = stateData?.redirectUri ?? redirectUri;

  if (!stateData) {
    logger.warn("Google OAuth invalid/expired state");
    return NextResponse.redirect(redirectWithError(finalRedirect, "Invalid or expired state"));
  }

  await deleteOAuthState(String(state));

  if (!code || typeof code !== "string") {
    return NextResponse.redirect(redirectWithError(finalRedirect, "Missing authorization code"));
  }

  try {
    await connectDb();
    const callbackUrl = `${getConfig().APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`;
    const { access_token } = await exchangeGoogleCode(code, callbackUrl);
    const profile = await fetchGoogleUser(access_token);

    const user = await findOrCreateUser(
      "google",
      profile.id,
      profile.email,
      profile.name,
      profile.picture
    );

    const token = await createJwt(user._id.toString(), user.email);
    logger.info("Google OAuth success", { userId: user._id.toString(), email: user.email });
    return NextResponse.redirect(redirectWithToken(finalRedirect, token));
  } catch (err) {
    logger.error("Google callback error:", err);
    return NextResponse.redirect(
      redirectWithError(finalRedirect, err instanceof Error ? err.message : "Authentication failed")
    );
  }
}
