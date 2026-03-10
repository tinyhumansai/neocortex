import mongoose from "mongoose";

const caseDetailsSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    fields: { type: mongoose.Schema.Types.Mixed, default: {} },
    rawHtml: { type: String },
    fetchedAt: { type: String, required: true },
  },
  { _id: false }
);

const caseSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cnr: { type: String, required: true },
    caseDetails: { type: caseDetailsSchema, required: true },
    conversationId: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation" },
  },
  { timestamps: true }
);

caseSchema.index({ userId: 1, cnr: 1 });
caseSchema.index({ userId: 1, createdAt: -1 });

export const Case = mongoose.models?.Case ?? mongoose.model("Case", caseSchema);
