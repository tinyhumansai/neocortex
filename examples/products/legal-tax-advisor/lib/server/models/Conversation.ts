import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    title: { type: String, default: "New Conversation" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    model: { type: String, default: "gpt-4o" },
    type: {
      type: String,
      enum: ["chat", "case_search"],
      default: "chat",
    },
  },
  { timestamps: true }
);

export const Conversation =
  mongoose.models?.Conversation ?? mongoose.model("Conversation", conversationSchema);
