import { Schema, model, Document } from 'mongoose';

export interface GoalDocument extends Document {
  firebaseUid: string;
  type: string;
  tag: string;
  title: string;
  color: string;
  pct: number;
}

const goalSchema = new Schema<GoalDocument>({
  firebaseUid: { type: String, required: true, index: true },
  // type is the canonical GoalTypeId ('study'|'career'|'personal'|'habit') from the
  // frontend's New Goal sheet; tag/color are its display label/color at creation
  // time, stored directly rather than re-derived so past goals don't shift if the
  // frontend's type palette changes later.
  type: { type: String, required: true },
  tag: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  color: { type: String, required: true },
  pct: { type: Number, default: 0 },
});

export function toPublicGoal(doc: GoalDocument) {
  return {
    id: doc.id as string,
    type: doc.type,
    tag: doc.tag,
    title: doc.title,
    color: doc.color,
    pct: doc.pct,
  };
}

export const Goal = model<GoalDocument>('Goal', goalSchema);
