import type { NewNoteInput, Note } from "@/types/note.types";
import { authedRequest } from "./authedRequest";

export const noteService = {
  list: () => authedRequest<Note[]>("/notes"),

  create: (input: NewNoteInput) =>
    authedRequest<Note>("/notes", { method: "POST", body: input }),

  update: (id: string, patch: Partial<NewNoteInput>) =>
    authedRequest<Note>(`/notes/${id}`, { method: "PATCH", body: patch }),

  remove: (id: string) =>
    authedRequest<void>(`/notes/${id}`, { method: "DELETE" }),

  // Stateless AI cleanup for speech-to-text artifacts — not tied to a saved
  // note id, see backend/src/controllers/note.controller.ts's cleanNote.
  cleanText: (text: string) =>
    authedRequest<{ cleaned: string }>("/notes/clean", { method: "POST", body: { text } }),
};
