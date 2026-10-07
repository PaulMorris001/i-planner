export interface Note {
  id: string;
  title: string;
  body: string;
  // Absent means "unfiled" — shown at the Notes screen's root alongside
  // folders. See types/folder.types.ts.
  folderId?: string;
  // Counts every saved change. Sent back with a save so the server can tell the copy this
  // screen holds is out of date (someone else changed the note) instead of overwriting them.
  version?: number;
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

// What a note save may carry besides the changed fields.
export type NoteUpdate = Partial<NewNoteInput> & { baseVersion?: number };
