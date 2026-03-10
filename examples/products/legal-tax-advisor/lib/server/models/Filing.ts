import mongoose from "mongoose";

const filingSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["ITR"], required: true },
    formType: { type: String, default: "ITR-1" },
    assessmentYear: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "submitted"],
      default: "draft",
    },
    /** Flexible payload for form data (income, deductions, personal, etc.) */
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Optional: reference number after submit (stub or from gov API later) */
    referenceNumber: String,
    submittedAt: Date,
  },
  { timestamps: true }
);

filingSchema.index({ userId: 1, assessmentYear: 1, type: 1 });
filingSchema.index({ userId: 1, status: 1 });

export const Filing = mongoose.models?.Filing ?? mongoose.model("Filing", filingSchema);
