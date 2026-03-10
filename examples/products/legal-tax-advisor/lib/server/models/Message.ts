import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    role: {
      type: String,
      enum: ["system", "user", "assistant"],
      required: true,
    },
    content: { type: String, required: true },
    tokenCount: Number,
  },
  { timestamps: true }
);

export const Message = mongoose.models?.Message ?? mongoose.model("Message", messageSchema);
