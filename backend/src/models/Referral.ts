import { Schema, model, Document } from 'mongoose';

// One row per successful referral: who referred whom, and what each was paid.
// The unique index on referredUid is what guarantees an account can use a
// referral code only ONCE: creating this row is the "claim" the points depend on.
export interface ReferralDocument extends Document {
  referrerUid: string;
  referredUid: string;
  referrerPoints: number;
  referredPoints: number;
  // Flipped (atomically, once) right before each side's points are added, so a
  // retry or a second request can never pay the same side twice.
  referrerPaid: boolean;
  referredPaid: boolean;
  createdAt: Date;
}

const referralSchema = new Schema<ReferralDocument>(
  {
    referrerUid: { type: String, required: true, index: true },
    referredUid: { type: String, required: true, unique: true },
    referrerPoints: { type: Number, required: true },
    referredPoints: { type: Number, required: true },
    referrerPaid: { type: Boolean, default: false },
    referredPaid: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Referral = model<ReferralDocument>('Referral', referralSchema);
