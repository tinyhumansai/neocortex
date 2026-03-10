import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDb } from "@/lib/server/db/mongo";
import { Conversation, Message } from "@/lib/server/models";
import { requireAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    await connectDb();

    const conv = await Conversation.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(user.id),
    });
    if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const messages = await Message.find({ conversationId: conv._id }).sort({ createdAt: 1 }).lean();

    type Msg = {
      _id: { toString(): string };
      conversationId: { toString(): string };
      role: string;
      content: string;
      tokenCount?: number;
      createdAt: Date;
    };
    const msgList = messages as unknown as Msg[];
    return NextResponse.json({
      id: conv._id.toString(),
      title: conv.title,
      model: conv.model,
      userId: conv.userId.toString(),
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messages: msgList.map((m) => ({
        id: m._id.toString(),
        conversationId: m.conversationId.toString(),
        role: m.role,
        content: m.content,
        tokenCount: m.tokenCount,
        createdAt: m.createdAt,
      })),
    });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    const body = await req.json();
    const { title } = body;
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    await connectDb();
    const result = await Conversation.updateOne(
      { _id: id, userId: new mongoose.Types.ObjectId(user.id) },
      { $set: { title } }
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(req);
    const { id } = await params;
    await connectDb();

    const conv = await Conversation.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(user.id),
    });
    if (conv) {
      await Message.deleteMany({ conversationId: conv._id });
      await Conversation.deleteOne({ _id: conv._id });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
}
