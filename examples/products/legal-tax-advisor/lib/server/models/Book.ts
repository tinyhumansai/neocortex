import mongoose from "mongoose";

const bookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    filename: { type: String, required: true, unique: true },
    sourcePath: { type: String },
    totalPages: { type: Number, default: 0 },
    totalChunks: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    errorMessage: String,
  },
  { timestamps: true }
);

bookSchema.index({ status: 1 });

export const Book = mongoose.models?.Book ?? mongoose.model("Book", bookSchema);
