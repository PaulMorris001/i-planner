import { Schema, model, Document } from 'mongoose';

// One row per successful referral: who referred whom, and what each was paid.
// The unique index on referredUid is what guarantees an account can use a
// referral code only ONCE: creating this row is the "claim" the points depend on.
export interface ReferralDocument extends Document {
  referrerUid: string;
  referredUid: string;
  referrerPoints: number;
  referredPoints: number;
  createdAt: Date;
}

const referralSchema = new Schema<ReferralDocument>(
  {
    referrerUid: { type: String, required: true, index: true },
    referredUid: { type: String, required: true, unique: true },
    referrerPoints: { type: Number, required: true },
    referredPoints: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Referral = model<ReferralDocument>('Referral', referralSchema);
