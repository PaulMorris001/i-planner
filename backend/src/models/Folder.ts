import { Schema, model, Document } from 'mongoose';

export interface FolderDocument extends Document {
  firebaseUid: string;
  name: string;
  // Absent means a root-level folder. Plain string, not a Mongoose ref — this
  // app never uses ref/populate anywhere, ids are plain strings throughout
  // (see Note.folderId). One level of parent, but nothing stops a parent from
  // itself having a parent, so folders can nest arbitrarily deep.
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<FolderDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    parentId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

export function toPublicFolder(doc: FolderDocument) {
  return {
    id: doc.id as string,
    name: doc.name,
    ...(doc.parentId ? { parentId: doc.parentId } : {}),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const Folder = model<FolderDocument>('Folder', folderSchema);
