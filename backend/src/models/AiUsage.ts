import { Document, Schema, model } from "mongoose";

export interface AiUsageDocument extends Document {
  firebaseUid: string;
  periodStart: Date;
  count: number;
}

const aiUsageSchema = new Schema<AiUsageDocument>({
  firebaseUid: { type: String, required: true, index: true, unique: true },
  periodStart: { type: Date, required: true },
  count: { type: Number, default: 0 },
});

export const AiUsage = model<AiUsageDocument>("AiUsage", aiUsageSchema);
