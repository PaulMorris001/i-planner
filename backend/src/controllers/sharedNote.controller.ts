import crypto from 'crypto';
import { Request, Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { SharedNote } from '../models/SharedNote';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { env } from '../config/env';
import { buildSharedNoteHtml, buildSharedNoteUnavailableHtml } from '../services/sharedNoteHtml';

// Resolves a share token to the underlying note's *current* content — not a
// snapshot, see models/SharedNote.ts. Returns null if the share link itself
// is bogus, or if the note it points at has since been deleted; callers turn
// that into whatever "not available" response fits their context (an HTML
// page for the web route, a 404 ApiError for the JSON routes).
async function resolveSharedNote(token: string) {
  const shared = await SharedNote.findOne({ token });
  if (!shared) return null;
  const note = await Note.findOne({ _id: shared.noteId, firebaseUid: shared.firebaseUid });
  if (!note) return null;
  return note;
}

export async function createShare(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);
  let shared = await SharedNote.findOne({ noteId: note.id, firebaseUid: req.userId });
  if (!shared) {
    shared = await SharedNote.create({
      token: crypto.randomUUID(),
      noteId: note.id,
      firebaseUid: req.userId,
    });
  }
  res.json({ url: `${env.backendPublicUrl}/shared/${shared.token}` });
}

// Unauthenticated — anyone with the link can view the preview page, same as
// clicking a shared Google Doc link before being asked to sign in.
export async function getSharedNoteWebPage(req: Request, res: Response) {
  const note = await resolveSharedNote(req.params.token);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!note) {
    res.status(404).send(buildSharedNoteUnavailableHtml());
    return;
  }
  res.send(buildSharedNoteHtml({ title: note.title, body: note.body }, req.params.token));
}

export async function getSharedNotePreview(req: AuthedRequest, res: Response) {
  const note = await resolveSharedNote(req.params.token);
  if (!note) throw new ApiError(404, 'This note is no longer available.', 'general');
  res.json({ title: note.title, body: note.body });
}

export async function importSharedNote(req: AuthedRequest, res: Response) {
  const note = await resolveSharedNote(req.params.token);
  if (!note) throw new ApiError(404, 'This note is no longer available.', 'general');
  // Unfiled, like every other newly created note — the recipient can move it
  // into a folder themselves afterward.
  const created = await Note.create({ firebaseUid: req.userId, title: note.title, body: note.body });
  res.status(201).json(toPublicNote(created));
}
