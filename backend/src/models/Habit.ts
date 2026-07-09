import { Schema, model, Document } from 'mongoose';

export interface HabitDocument extends Document {
  firebaseUid: string;
  name: string;
  category: string;
  streak: number;
  week: boolean[];
}

const habitSchema = new Schema<HabitDocument>({
  firebaseUid: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  // Free-form string, canonical list lives in the frontend's constants/taskMeta.ts.
  category: { type: String, required: true },
  streak: { type: Number, default: 0 },
  week: {
    type: [Boolean],
    default: () => [false, false, false, false, false, false, false],
  },
});

export function toPublicHabit(doc: HabitDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    category: doc.category,
    streak: doc.streak,
    week: doc.week,
  };
}

export const Habit = model<HabitDocument>('Habit', habitSchema);
