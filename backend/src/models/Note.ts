import { Schema, model, Document } from 'mongoose';
import { NOTE_TITLE_MAX_LENGTH, NOTE_BODY_MAX_LENGTH } from '../constants/noteLimits';

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
    // Redundant with note.controller.ts's own validation on every write path
    // that goes through it — a defense-in-depth backstop, not the primary
    // guard, so a future write path that forgets to validate still can't
    // silently write past the cap. A note this rejects at .save() falls
    // through errorHandler.ts's generic 500 rather than a clean 400, since
    // the controller is expected to have already caught it before this ever
    // matters.
    title: { type: String, required: true, trim: true, maxlength: NOTE_TITLE_MAX_LENGTH },
    body: { type: String, default: '', maxlength: NOTE_BODY_MAX_LENGTH },
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
