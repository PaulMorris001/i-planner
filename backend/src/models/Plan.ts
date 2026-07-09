import { Schema, model, Document } from 'mongoose';

export const PATH_TYPES = ['student', 'exam', 'professional'] as const;
export type PathType = (typeof PATH_TYPES)[number];

export interface PlanDocument extends Document {
  firebaseUid: string;
  pathType: PathType;
  data: unknown;
  updatedAt: Date;
}

const planSchema = new Schema<PlanDocument>({
  firebaseUid: { type: String, required: true, index: true },
  pathType: { type: String, enum: PATH_TYPES, required: true },
  // Shape mirrors the frontend's StudentPlan / ExamPlan / ProfessionalPlan
  // (types/plan.types.ts) — kept schemaless here since those shapes differ per
  // pathType and this backend doesn't share a types package with the app.
  data: { type: Schema.Types.Mixed, required: true },
  updatedAt: { type: Date, default: () => new Date() },
});

planSchema.index({ firebaseUid: 1, pathType: 1 }, { unique: true });

export const Plan = model<PlanDocument>('Plan', planSchema);
