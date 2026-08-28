import { Schema, model, Document } from 'mongoose';

export interface NoteDocument extends Document {
  firebaseUid: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<NoteDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
  },
  // Unlike Habit, updatedAt is kept — Habit's derived fields (streak/week) come from
  // createdAt, but Notes has no such derivation and needs "last edited" for sort order.
  { timestamps: { createdAt: true, updatedAt: true } }
);

export function toPublicNote(doc: NoteDocument) {
  return {
    id: doc.id as string,
    title: doc.title,
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const Note = model<NoteDocument>('Note', noteSchema);
