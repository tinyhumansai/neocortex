import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db/mongo";
import { Filing } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";

/** GET /api/filings/:id — Get one filing */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    await connectDb();

    const filing = await Filing.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(user.id),
    }).lean();

    if (!filing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const f = filing as unknown as {
      _id: unknown;
      type: string;
      formType?: string;
      assessmentYear: string;
      status: string;
      payload: Record<string, unknown>;
      referenceNumber?: string;
      submittedAt?: Date;
      createdAt: Date;
      updatedAt: Date;
    };

    return NextResponse.json({
      id: f._id?.toString?.(),
      type: f.type,
      formType: f.formType,
      assessmentYear: f.assessmentYear,
      status: f.status,
      payload: f.payload,
      referenceNumber: f.referenceNumber,
      submittedAt: f.submittedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

/** PATCH /api/filings/:id — Update draft payload */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    await connectDb();

    const filing = await Filing.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(user.id),
    });

    if (!filing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (filing.status !== "draft") {
      return NextResponse.json({ error: "Cannot update a submitted filing" }, { status: 400 });
    }

    if (body.payload != null) {
      filing.payload = typeof body.payload === "object" ? body.payload : filing.payload;
    }
    await filing.save();

    return NextResponse.json({
      id: filing._id.toString(),
      status: filing.status,
      payload: filing.payload,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
