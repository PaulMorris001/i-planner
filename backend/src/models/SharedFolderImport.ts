import { Schema, model, Document } from 'mongoose';

// One record per (share, account) that added the folder, and the top folder that copy
// created. The unique index is the atomic "claim": two simultaneous adds of the same
// link by the same account both start a copy, but only one can create this record, and
// the other cleans up after itself, so a folder is never added twice.
export interface SharedFolderImportDocument extends Document {
  token: string;
  firebaseUid: string;
  // The top-level folder this account's copy created.
  folderId: string;
  createdAt: Date;
}

const sharedFolderImportSchema = new Schema<SharedFolderImportDocument>(
  {
    token: { type: String, required: true, index: true },
    firebaseUid: { type: String, required: true },
    folderId: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

sharedFolderImportSchema.index({ token: 1, firebaseUid: 1 }, { unique: true });

export const SharedFolderImport = model<SharedFolderImportDocument>('SharedFolderImport', sharedFolderImportSchema);
