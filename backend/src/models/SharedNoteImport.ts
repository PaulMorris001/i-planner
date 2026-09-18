import { Schema, model, Document } from 'mongoose';

// One record per (token, importer) pair — records which account already
// imported a given share, and which Note it created. Kept as its own
// collection (rather than an array field on SharedNote) specifically so the
// unique compound index below can act as an atomic "claim" — two concurrent
// import requests from the same user racing each other both create a Note
// first, but only one of their SharedNoteImport.create() calls can win;
// the loser's duplicate-key error is what the controller uses to detect the
// race and clean up its own redundant copy instead of leaving two behind.
export interface SharedNoteImportDocument extends Document {
  token: string;
  firebaseUid: string;
  noteId: string;
  createdAt: Date;
}

const sharedNoteImportSchema = new Schema<SharedNoteImportDocument>(
  {
    token: { type: String, required: true, index: true },
    firebaseUid: { type: String, required: true },
    noteId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sharedNoteImportSchema.index({ token: 1, firebaseUid: 1 }, { unique: true });

export const SharedNoteImport = model<SharedNoteImportDocument>('SharedNoteImport', sharedNoteImportSchema);
