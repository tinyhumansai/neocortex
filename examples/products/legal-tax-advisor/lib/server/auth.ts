import { jwtVerify } from "jose";
import { getConfig } from "./config";
import { User } from "./models";
import { NextRequest } from "next/server";

export type AuthUser = { id: string; email: string };

export async function getUserFromRequest(req: NextRequest): Promise<AuthUser | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(getConfig().JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    const sub = payload.sub as string;
    const email = payload.email as string;
    if (!email) return null;

    const user = await User.findById(sub);
    if (!user) return null;

    return { id: user._id.toString(), email: user.email };
  } catch {
    return null;
  }
}

/** Use in API routes: returns 401 JSON if not authenticated. */
export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await getUserFromRequest(req);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Please sign in to continue" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
