import { Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { Folder } from '../models/Folder';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { cleanNoteText } from '../services/noteCleanup';

// Keep in sync with app/note-editor.tsx's NOTE_BODY_MAX_LENGTH — that caps it
// at entry for a nicer UX, this enforces it regardless so a stale client
// build (or the API called directly) can't bypass it. An unbounded body
// rendered into a <Text> builds a proportionally large native text-fragment
// tree, and a large enough one has caused a real, confirmed stack-overflow
// crash when that tree was later torn down — see notes.tsx's previewText.
const NOTE_BODY_MAX_LENGTH = 20_000;

export async function listNotes(req: AuthedRequest, res: Response) {
  const notes = await Note.find({ firebaseUid: req.userId }).sort({ updatedAt: -1 });
  res.json(notes.map(toPublicNote));
}

export async function createNote(req: AuthedRequest, res: Response) {
  const { title, body, folderId } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (typeof body === 'string' && body.length > NOTE_BODY_MAX_LENGTH) {
    throw new ApiError(400, `Note is too long (max ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters).`, 'general');
  }
  // Verified against the owning user, not just trusted from the client, so a
  // note can never end up silently referencing another user's folder (or one
  // that no longer exists) — findOwnedOrThrow throws its own clean 404 if not.
  if (typeof folderId === 'string' && folderId) {
    await findOwnedOrThrow(Folder, folderId, req.userId!);
  }

  const note = await Note.create({
    firebaseUid: req.userId,
    title: title.trim(),
    body: typeof body === 'string' ? body : '',
    ...(typeof folderId === 'string' && folderId ? { folderId } : {}),
  });

  res.status(201).json(toPublicNote(note));
}

export async function updateNote(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);

  const { title, body, folderId } = req.body ?? {};
  if (title !== undefined) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new ApiError(400, 'Title is required.', 'general');
    }
    note.title = title.trim();
  }
  if (body !== undefined) {
    if (typeof body === 'string' && body.length > NOTE_BODY_MAX_LENGTH) {
      throw new ApiError(400, `Note is too long (max ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters).`, 'general');
    }
    note.body = body;
  }
  // Explicit null (or '') un-files the note — the "move to no folder" case —
  // distinct from folderId simply being absent from the patch, which leaves
  // it untouched. A real, non-empty string moves it into that folder, after
  // the same ownership check as create.
  if (folderId !== undefined) {
    if (folderId === null || folderId === '') {
      note.folderId = undefined;
    } else if (typeof folderId === 'string') {
      await findOwnedOrThrow(Folder, folderId, req.userId!);
      note.folderId = folderId;
    }
  }

  await note.save();
  res.json(toPublicNote(note));
}

export async function deleteNote(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);
  await note.deleteOne();
  res.status(204).send();
}

// Stateless — not tied to any note id/ownership lookup. A brand-new,
// not-yet-saved note (or a note that hasn't been given a title yet, so
// nothing's been autosaved) should still be cleanable; this is just a text
// transform, not a note mutation.
export async function cleanNote(req: AuthedRequest, res: Response) {
  const { text } = req.body ?? {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new ApiError(400, 'Text is required.', 'general');
  }
  if (text.length > NOTE_BODY_MAX_LENGTH) {
    throw new ApiError(400, `Text is too long (max ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters).`, 'general');
  }
  const cleaned = await cleanNoteText(text);
  res.json({ cleaned });
}
