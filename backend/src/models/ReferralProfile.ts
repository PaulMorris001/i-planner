import { Schema, model, Document } from 'mongoose';

// One per account: its own shareable code and its running points total.
export interface ReferralProfileDocument extends Document {
  firebaseUid: string;
  // The code other people enter when they sign up. Unique, upper-case.
  code: string;
  // Anonymous leaderboard name (user7k2m9qx). Unique; assigned lazily, so older
  // profiles get one the next time they are loaded.
  handle?: string;
  points: number;
  // How many people signed up with this account's code.
  referralCount: number;
  // Set when this account signed up with someone else's code (once only).
  referredByUid?: string;
  // True for a brand-new sign-up until they've seen the "here's your code" popup.
  welcomePending: boolean;
  createdAt: Date;
}

const referralProfileSchema = new Schema<ReferralProfileDocument>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    code: { type: String, required: true, unique: true, index: true },
    handle: { type: String, unique: true, sparse: true },
    points: { type: Number, default: 0, min: 0 },
    referralCount: { type: Number, default: 0, min: 0 },
    referredByUid: { type: String },
    welcomePending: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const ReferralProfile = model<ReferralProfileDocument>('ReferralProfile', referralProfileSchema);
