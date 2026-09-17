export interface Note {
  id: string;
  title: string;
  body: string;
  // Absent means "unfiled" — shown at the Notes screen's root alongside
  // folders. See types/folder.types.ts.
  folderId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewNoteInput {
  title: string;
  body: string;
  // string moves the note into that folder; explicit null un-files it (the
  // "move to no folder" case) — distinct from omitting the key entirely,
  // which leaves whatever folder a PATCH's target note already has alone.
  // See backend/src/controllers/note.controller.ts's updateNote.
  folderId?: string | null;
}
