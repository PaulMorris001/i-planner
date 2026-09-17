export interface Folder {
  id: string;
  name: string;
  // Absent means root-level. See backend/src/models/Folder.ts.
  parentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewFolderInput {
  name: string;
  parentId?: string;
}
