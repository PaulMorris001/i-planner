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
  targetRole?: string;
  targetIndustry?: string;
  targetDate?: string;
}

const milestoneSchema = new Schema<MilestoneDocument>({
  title: { type: String, required: true, trim: true },
  done: { type: Boolean, default: false },
  dueLabel: { type: String, default: '' },
});

const goalSchema = new Schema<GoalDocument>({
  firebaseUid: { type: String, required: true, index: true },
  type: { type: String, required: true },
  tag: { type: String, required: true },
  title: { type: String, required: true, trim: true },
  color: { type: String, required: true },
  pct: { type: Number, default: 0 },
  milestones: { type: [milestoneSchema], default: [] },
  targetRole: { type: String },
  targetIndustry: { type: String },
  targetDate: { type: String },
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
    targetRole: doc.targetRole ?? '',
    targetIndustry: doc.targetIndustry ?? '',
    targetDate: doc.targetDate ?? '',
  };
}

export const Goal = model<GoalDocument>('Goal', goalSchema);
