import { Schema, model, Document } from 'mongoose';

export interface SavingsGoalDocument extends Document {
  firebaseUid: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  targetDate: string; // "YYYY-MM-DD" — a real date-key, from the app's date picker.
}

const savingsGoalSchema = new Schema<SavingsGoalDocument>({
  firebaseUid: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  targetAmount: { type: Number, required: true },
  savedAmount: { type: Number, required: true, default: 0 },
  targetDate: { type: String, required: true },
});

export function toPublicSavingsGoal(doc: SavingsGoalDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    targetAmount: doc.targetAmount,
    savedAmount: doc.savedAmount,
    targetDate: doc.targetDate,
  };
}

export const SavingsGoal = model<SavingsGoalDocument>('SavingsGoal', savingsGoalSchema);
