import { Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';

export async function listNotes(req: AuthedRequest, res: Response) {
  const notes = await Note.find({ firebaseUid: req.userId }).sort({ updatedAt: -1 });
  res.json(notes.map(toPublicNote));
}

export async function createNote(req: AuthedRequest, res: Response) {
  const { title, body } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
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
  if (body !== undefined) note.body = body;

  await note.save();
  res.json(toPublicNote(note));
}

export async function deleteNote(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);
  await note.deleteOne();
  res.status(204).send();
}
