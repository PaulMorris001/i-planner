import { Schema, model, Document } from 'mongoose';
import { FOLDER_NAME_MAX_LENGTH } from '../constants/noteLimits';

export interface FolderDocument extends Document {
  firebaseUid: string;
  name: string;
  parentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const folderSchema = new Schema<FolderDocument>(
  {
    firebaseUid: { type: String, required: true, index: true },
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
