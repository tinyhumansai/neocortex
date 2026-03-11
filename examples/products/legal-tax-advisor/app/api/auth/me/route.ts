import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/server/db/mongo";
import { User } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectDb();
    const dbUser = await User.findById(user.id).lean();
    if (!dbUser || Array.isArray(dbUser)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const u = dbUser as unknown as {
      _id: { toString(): string };
      email: string;
      name?: string | null;
      image?: string | null;
      onboardingCompletedAt?: Date | null;
    };
    return NextResponse.json({
      id: u._id.toString(),
      email: u.email,
      name: u.name,
      image: u.image,
      onboardingCompleted: u.onboardingCompletedAt === undefined ? true : !!u.onboardingCompletedAt,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
