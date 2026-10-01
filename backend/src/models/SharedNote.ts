import { Schema, model, Document } from 'mongoose';

// A pointer, not a content snapshot — the web page and in-app preview both
// resolve the underlying Note's *current* content at view/import time (like
// sharing a Google Doc link), not whatever it said when the link was made.
// If the Note is later deleted, resolution just comes up empty — nothing here
// needs to be cleaned up alongside it.
export interface SharedNoteDocument extends Document {
  // Canonical internal id (a UUID) -- SharedNoteImport rows reference it, and
  // links shared before short links existed (/shared/<uuid>) still use it.
  token: string;
  // Short public id used in share links (/n/<slug>). Added lazily: shares made
  // before it existed get one the next time the note is shared again.
  slug?: string;
  noteId: string;
  firebaseUid: string;
  createdAt: Date;
}

const sharedNoteSchema = new Schema<SharedNoteDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    slug: { type: String, unique: true, sparse: true },
    noteId: { type: String, required: true, index: true },
    firebaseUid: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Lets createShare (see sharedNote.controller.ts) rely on a duplicate-key
// error as the atomic "does a share already exist for this note" check,
// instead of a plain findOne-then-create that two concurrent share requests
// for the same note could both pass before either creates — yielding two
// live tokens for one note.
sharedNoteSchema.index({ noteId: 1, firebaseUid: 1 }, { unique: true });

export const SharedNote = model<SharedNoteDocument>('SharedNote', sharedNoteSchema);
