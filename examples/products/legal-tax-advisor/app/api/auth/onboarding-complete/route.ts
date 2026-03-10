import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db/mongo";
import { User } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";

/** POST /api/auth/onboarding-complete — Mark onboarding as done for the current user */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectDb();

    const dbUser = await User.findById(user.id);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!dbUser.onboardingCompletedAt) {
      dbUser.onboardingCompletedAt = new Date();
      await dbUser.save();
    }

    return NextResponse.json({
      ok: true,
      onboardingCompleted: true,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
