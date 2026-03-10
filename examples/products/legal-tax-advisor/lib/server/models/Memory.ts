import mongoose from "mongoose";

const memorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, required: true },
    summary: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    sourceConvId: String,
  },
  { timestamps: true }
);

memorySchema.index({ userId: 1 });
memorySchema.index({ userId: 1, createdAt: -1 });

export const Memory = mongoose.models?.Memory ?? mongoose.model("Memory", memorySchema);
