import { Schema, model, Document, Types } from 'mongoose';

export interface MilestoneDocument extends Types.Subdocument {
  title: string;
  done: boolean;
  dueLabel: string;
}

export interface GoalDocument extends Document {
  firebaseUid: string;
  type: string;
  tag: string;
  title: string;
  color: string;
  pct: number;
  milestones: Types.DocumentArray<MilestoneDocument>;
}

const milestoneSchema = new Schema<MilestoneDocument>({
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  // Free-text relative timeframe (e.g. "This month", "Mid-way") rather than a real
  // date — matches what AI-generated milestones naturally produce.
  dueLabel: { type: String, default: '' },
});

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
  // Derived from milestones (doneCount/total) — never set directly by the client.
  // See goal.controller.ts.
  pct: { type: Number, default: 0 },
  milestones: { type: [milestoneSchema], default: [] },
});

export function toPublicGoal(doc: GoalDocument) {
  return {
    id: doc.id as string,
    type: doc.type,
    tag: doc.tag,
    title: doc.title,
    color: doc.color,
    pct: doc.pct,
    milestones: doc.milestones.map((m) => ({
      id: m.id as string,
      title: m.title,
      done: m.done,
      dueLabel: m.dueLabel,
    })),
  };
}

export const Goal = model<GoalDocument>('Goal', goalSchema);
