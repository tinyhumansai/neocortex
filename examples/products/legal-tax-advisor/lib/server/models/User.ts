import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: String,
    image: String,
    provider: { type: String, required: true },
    providerId: { type: String, required: true },
    /** Set when user completes the first-time onboarding flow */
    onboardingCompletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ provider: 1, providerId: 1 }, { unique: true });

export const User = mongoose.models?.User ?? mongoose.model("User", userSchema);
