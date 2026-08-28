import { Schema, model, Document } from 'mongoose';

// One doc per user, reset in place when the tracking window rolls over.
// See services/aiUsageLimiter.ts for the read/reset/increment flow.
export interface AiUsageDocument extends Document {
  firebaseUid: string;
  // Start of the current tracking window (Monday 00:00 UTC for weekly/free,
  // the 1st of the month 00:00 UTC for monthly/paid tiers).
  periodStart: Date;
  count: number;
}

const aiUsageSchema = new Schema<AiUsageDocument>({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  periodStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
});

export const AiUsage = model<AiUsageDocument>('AiUsage', aiUsageSchema);
