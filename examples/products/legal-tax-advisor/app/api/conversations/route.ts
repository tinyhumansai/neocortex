import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db/mongo";
import { Conversation, Message } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    await connectDb();

    const conversations = await Conversation.find({
      userId: new mongoose.Types.ObjectId(user.id),
    })
      .sort({ updatedAt: -1 })
      .lean();

    type ConvLean = { _id: mongoose.Types.ObjectId; title: string; model: string; updatedAt: Date };
    const convList = conversations as unknown as ConvLean[];
    const withCount = await Promise.all(
      convList.map(async (c) => {
        const count = await Message.countDocuments({
          conversationId: c._id,
        });
        return {
          id: c._id.toString(),
          title: c.title,
          model: c.model,
          updatedAt: c.updatedAt,
          _count: { messages: count },
        };
      })
    );

    return NextResponse.json(withCount);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
