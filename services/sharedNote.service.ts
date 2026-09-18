import type { Note } from "@/types/note.types";
import { authedRequest } from "./authedRequest";

export const sharedNoteService = {
  // Idempotent server-side — sharing the same note twice returns the same link.
  share: (noteId: string) =>
    authedRequest<{ url: string }>(`/notes/${noteId}/share`, { method: "POST" }),

  getPreview: (token: string) =>
    authedRequest<{ title: string; body: string }>(`/shared-notes/${token}`),

  // `alreadyImported` is true when this account already imported this exact
  // share before (including the sharer reopening their own link) — `note` is
  // the existing copy in that case, not a freshly created one.
  importNote: (token: string) =>
    authedRequest<{ alreadyImported: boolean; note: Note }>(`/shared-notes/${token}/import`, { method: "POST" }),
};
