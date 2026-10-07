import type { Note } from "@/types/note.types";
import { authedRequest } from "./authedRequest";

// Why an account can't add a note: 'own' = it is their own note (they shared it and opened
// the link), 'imported' = they already added this exact share, 'same' = they already have a
// note with exactly this title and text.
export type ExistingNoteReason = "own" | "imported" | "same";

export interface SharedNotePreview {
  title: string;
  body: string;
  // Set when the account already has this note: the screen offers "Open" instead of "Add".
  existing: { noteId: string; reason: ExistingNoteReason } | null;
}

export const sharedNoteService = {
  // Idempotent server-side — sharing the same note twice returns the same link.
  share: (noteId: string) =>
    authedRequest<{ url: string }>(`/notes/${noteId}/share`, { method: "POST" }),

  getPreview: (token: string) =>
    authedRequest<SharedNotePreview>(`/shared-notes/${token}`),

  // `alreadyImported` is true when the account already has this note (see
  // ExistingNoteReason); `note` is the one it already has, nothing new is created.
  importNote: (token: string) =>
    authedRequest<{ alreadyImported: boolean; reason: ExistingNoteReason | null; note: Note }>(`/shared-notes/${token}/import`, { method: "POST" }),
};
