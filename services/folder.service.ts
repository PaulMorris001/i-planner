import type { NewFolderInput, Folder } from "@/types/folder.types";
import { authedRequest } from "./authedRequest";

export const folderService = {
  list: () => authedRequest<Folder[]>("/folders"),

  create: (input: NewFolderInput) =>
    authedRequest<Folder>("/folders", { method: "POST", body: input }),

  update: (id: string, patch: Partial<NewFolderInput>) =>
    authedRequest<Folder>(`/folders/${id}`, { method: "PATCH", body: patch }),

  remove: (id: string) =>
    authedRequest<void>(`/folders/${id}`, { method: "DELETE" }),
};
