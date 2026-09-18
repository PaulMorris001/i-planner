import { Schema, model, Document } from 'mongoose';

// A pointer, not a content snapshot — the web page and in-app preview both
// resolve the underlying Note's *current* content at view/import time (like
// sharing a Google Doc link), not whatever it said when the link was made.
// If the Note is later deleted, resolution just comes up empty — nothing here
// needs to be cleaned up alongside it.
export interface SharedNoteDocument extends Document {
  token: string;
  noteId: string;
  firebaseUid: string;
  createdAt: Date;
}

const sharedNoteSchema = new Schema<SharedNoteDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    noteId: { type: String, required: true, index: true },
    firebaseUid: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const SharedNote = model<SharedNoteDocument>('SharedNote', sharedNoteSchema);
