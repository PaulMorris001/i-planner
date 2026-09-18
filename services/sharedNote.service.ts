import type { Note } from "@/types/note.types";
import { authedRequest } from "./authedRequest";

export const sharedNoteService = {
  // Idempotent server-side — sharing the same note twice returns the same link.
  share: (noteId: string) =>
    authedRequest<{ url: string }>(`/notes/${noteId}/share`, { method: "POST" }),

  getPreview: (token: string) =>
    authedRequest<{ title: string; body: string }>(`/shared-notes/${token}`),

  importNote: (token: string) =>
    authedRequest<Note>(`/shared-notes/${token}/import`, { method: "POST" }),
};
