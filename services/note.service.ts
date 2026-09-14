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
};
