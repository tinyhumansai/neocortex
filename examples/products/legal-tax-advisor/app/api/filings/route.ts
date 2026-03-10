import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db/mongo";
import { Filing } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";
import { z } from "zod";

const createFilingSchema = z.object({
  type: z.enum(["ITR"]),
  assessmentYear: z.string().min(4).max(9),
  formType: z.string().optional(),
});

type FilingLean = {
  _id: unknown;
  type: string;
  formType?: string;
  assessmentYear: string;
  status: string;
  referenceNumber?: string;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** GET /api/filings — List current user's filings */
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectDb();

    const filings = await Filing.find({ userId: new mongoose.Types.ObjectId(user.id) })
      .sort({ updatedAt: -1 })
      .lean();

    const list = (filings as unknown as FilingLean[]).map((f) => ({
      id: f._id?.toString?.(),
      type: f.type,
      formType: f.formType,
      assessmentYear: f.assessmentYear,
      status: f.status,
      referenceNumber: f.referenceNumber,
      submittedAt: f.submittedAt,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    return NextResponse.json(list);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

/** POST /api/filings — Create a new draft filing */
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    const body = await req.json();
    const parsed = createFilingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await connectDb();

    const existing = await Filing.findOne({
      userId: new mongoose.Types.ObjectId(user.id),
      type: parsed.data.type,
      assessmentYear: parsed.data.assessmentYear,
    });
    if (existing) {
      return NextResponse.json(
        { error: "A filing for this type and year already exists", id: existing._id.toString() },
        { status: 409 }
      );
    }

    const filing = await Filing.create({
      userId: new mongoose.Types.ObjectId(user.id),
      type: parsed.data.type,
      formType: parsed.data.formType ?? "ITR-1",
      assessmentYear: parsed.data.assessmentYear,
      status: "draft",
      payload: {},
    });

    return NextResponse.json({
      id: filing._id.toString(),
      type: filing.type,
      formType: filing.formType,
      assessmentYear: filing.assessmentYear,
      status: filing.status,
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
