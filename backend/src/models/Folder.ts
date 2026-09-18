import { Schema, model, Document } from 'mongoose';
import { FOLDER_NAME_MAX_LENGTH } from '../constants/noteLimits';

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
    // Defense-in-depth backstop — see Note.ts's title/body maxlength for why
    // this is redundant with folder.controller.ts's own validation.
    name: { type: String, required: true, trim: true, maxlength: FOLDER_NAME_MAX_LENGTH },
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
