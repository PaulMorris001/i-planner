import { authedRequest } from "./authedRequest";

// Why an account can't add a shared folder: 'own' = it is their own folder, 'imported' =
// they already added this share and still have that copy, 'same' = they already have
// every note in it.
export type ExistingFolderReason = "own" | "imported" | "same";

export interface SharedFolderOutlineSection {
  name: string;
  // 0 = the shared folder itself, 1 = a subfolder of it, and so on.
  depth: number;
  notes: string[];
  moreNotes: number;
}

export interface SharedFolderPreview {
  name: string;
  noteCount: number;
  folderCount: number;
  sections: SharedFolderOutlineSection[];
  // Over the size a single share may hold: the folder can't be added.
  tooLarge: boolean;
  // Set when there is nothing to add; `folderId` is the folder to open, when there is one.
  existing: { folderId: string | null; reason: ExistingFolderReason } | null;
}

export interface SharedFolderImportResult {
  alreadyImported: boolean;
  reason: ExistingFolderReason | null;
  // The folder to open: the new copy, or the one the account already has.
  folderId: string | null;
  added: number;
  // Notes left out because the account already has exactly the same note.
  skipped: number;
}

export const sharedFolderService = {
  // Idempotent server-side: sharing the same folder twice returns the same link.
  share: (folderId: string) =>
    authedRequest<{ url: string }>(`/folders/${folderId}/share`, { method: "POST" }),

  getPreview: (token: string) => authedRequest<SharedFolderPreview>(`/shared-folders/${token}`),

  importFolder: (token: string) =>
    authedRequest<SharedFolderImportResult>(`/shared-folders/${token}/import`, { method: "POST" }),
};
