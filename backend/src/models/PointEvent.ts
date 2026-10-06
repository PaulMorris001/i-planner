import { Schema, model, Document } from 'mongoose';

// One row per award of points: who got them, for what, and when. Two jobs:
//  - The unique {firebaseUid, key} index is what guarantees a given thing (a task,
//    a bill's cycle, a study run, ...) can only ever pay once. Creating the row is
//    the "claim" the points depend on, exactly like models/Referral.ts.
//  - The weekly leaderboard is worked out from these rows (by createdAt).
export interface PointEventDocument extends Document {
  firebaseUid: string;
  // Identifies what was rewarded, e.g. "task:<id>", "bill:<id>:2026-10-31".
  key: string;
  type: string;
  points: number;
  createdAt: Date;
}

const pointEventSchema = new Schema<PointEventDocument>({
  firebaseUid: { type: String, required: true },
  key: { type: String, required: true },
  type: { type: String, required: true },
  points: { type: Number, required: true },
  // Set explicitly (not via mongoose timestamps) so the referral backfill can
  // store the original referral time.
  createdAt: { type: Date, default: Date.now, index: true },
});

pointEventSchema.index({ firebaseUid: 1, key: 1 }, { unique: true });

export const PointEvent = model<PointEventDocument>('PointEvent', pointEventSchema);
