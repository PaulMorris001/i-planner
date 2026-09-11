import { Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

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
  const { title, body } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  if (typeof body === 'string' && body.length > NOTE_BODY_MAX_LENGTH) {
    throw new ApiError(400, `Note is too long (max ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters).`, 'general');
  }

  const note = await Note.create({
    firebaseUid: req.userId,
    title: title.trim(),
    body: typeof body === 'string' ? body : '',
  });

  res.status(201).json(toPublicNote(note));
}

export async function updateNote(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);

  const { title, body } = req.body ?? {};
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

  await note.save();
  res.json(toPublicNote(note));
}

export async function deleteNote(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);
  await note.deleteOne();
  res.status(204).send();
}
