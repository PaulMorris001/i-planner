import { Schema, model, Document } from 'mongoose';

export type CoachModeId = 'study' | 'plan' | 'goal';
export const COACH_MODES: readonly CoachModeId[] = ['study', 'plan', 'goal'];

// A file the user attached to a message (see services/coachAttachments.ts).
// Documents/images live in OpenAI file storage (openaiFileId, auto-deleted
// after 30 days); plain-text files are small enough to keep inline instead.
export interface CoachAttachment {
  filename: string;
  mimeType: string;
  openaiFileId?: string;
  textContent?: string;
}

export interface CoachMessageDocument extends Document {
  firebaseUid: string;
  mode: CoachModeId;
  role: 'user' | 'assistant';
  content: string;
  attachments?: CoachAttachment[];
  createdAt: Date;
}

const coachMessageSchema = new Schema<CoachMessageDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    mode: { type: String, enum: COACH_MODES, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    attachments: {
      type: [
        {
          _id: false,
          filename: { type: String, required: true },
          mimeType: { type: String, required: true },
          openaiFileId: { type: String },
          textContent: { type: String },
        },
      ],
      default: undefined,
    },
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
    // Names only -- the file itself never goes back to the client.
    attachments: doc.attachments?.length ? doc.attachments.map((a) => ({ filename: a.filename })) : undefined,
    createdAt: doc.createdAt.toISOString(),
  };
}

export const CoachMessage = model<CoachMessageDocument>('CoachMessage', coachMessageSchema);
