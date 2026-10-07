import { Schema, model, Document } from 'mongoose';

// A pointer to a folder, not a snapshot: like a shared note, the link always shows
// whatever is in the folder (notes and subfolders) when it is opened. Adding it to an
// account takes a one-time COPY of that moment (see SharedFolderImport). If the folder
// is deleted, the link just stops resolving; nothing here needs cleaning up with it.
export interface SharedFolderDocument extends Document {
  // Canonical internal id; SharedFolderImport rows reference it.
  token: string;
  // Short public id used in links (/f/<title-words>-<slug>).
  slug?: string;
  folderId: string;
  firebaseUid: string;
  createdAt: Date;
}

const sharedFolderSchema = new Schema<SharedFolderDocument>(
  {
    token: { type: String, required: true, unique: true, index: true },
    slug: { type: String, unique: true, sparse: true },
    folderId: { type: String, required: true, index: true },
    firebaseUid: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// One live share per folder: a duplicate-key error is the atomic "does a share already
// exist" check, so two simultaneous requests can't create two links for one folder.
sharedFolderSchema.index({ folderId: 1, firebaseUid: 1 }, { unique: true });

export const SharedFolder = model<SharedFolderDocument>('SharedFolder', sharedFolderSchema);
