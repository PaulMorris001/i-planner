import { Schema, model, Document } from 'mongoose';

export type CoachModeId = 'study' | 'plan' | 'goal';
export const COACH_MODES: readonly CoachModeId[] = ['study', 'plan', 'goal'];

export interface CoachMessageDocument extends Document {
  firebaseUid: string;
  mode: CoachModeId;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

const coachMessageSchema = new Schema<CoachMessageDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    mode: { type: String, enum: COACH_MODES, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Conversation history is always fetched per user+mode, oldest first.
coachMessageSchema.index({ firebaseUid: 1, mode: 1, createdAt: 1 });

export function toPublicCoachMessage(doc: CoachMessageDocument) {
  return {
    id: doc.id as string,
    role: doc.role,
    content: doc.content,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const CoachMessage = model<CoachMessageDocument>('CoachMessage', coachMessageSchema);
