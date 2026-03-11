import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db/mongo";
import { Filing } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";

/** POST /api/filings/:id/submit — Mark filing as submitted (stub: no real gov API yet) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    await connectDb();

    const filing = await Filing.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(user.id),
    });

    if (!filing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (filing.status !== "draft") {
      return NextResponse.json({ error: "Filing already submitted" }, { status: 400 });
    }

    filing.status = "submitted";
    filing.submittedAt = new Date();
    filing.referenceNumber = `LEX-${Date.now().toString(36).toUpperCase()}`;
    await filing.save();

    return NextResponse.json({
      id: filing._id.toString(),
      status: filing.status,
      referenceNumber: filing.referenceNumber,
      submittedAt: filing.submittedAt,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
