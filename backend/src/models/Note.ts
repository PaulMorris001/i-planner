import { Schema, model, Document } from 'mongoose';

export interface NoteDocument extends Document {
  firebaseUid: string;
  title: string;
  body: string;
  // Absent/undefined means "unfiled" — shown at the Notes screen's root
  // alongside folders, exactly how every note already behaved before
  // folders existed. Plain string, not a Mongoose ref/populate — this app
  // never uses those anywhere, ids are plain strings throughout.
  folderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const noteSchema = new Schema<NoteDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '' },
    folderId: { type: String },
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
    ...(doc.folderId ? { folderId: doc.folderId } : {}),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const Note = model<NoteDocument>('Note', noteSchema);
