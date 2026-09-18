import crypto from 'crypto';
import { Request, Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { SharedNote } from '../models/SharedNote';
import { SharedNoteImport } from '../models/SharedNoteImport';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { env } from '../config/env';
import { NOTE_TITLE_MAX_LENGTH, NOTE_BODY_MAX_LENGTH } from '../constants/noteLimits';
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
    try {
      shared = await SharedNote.create({ token: crypto.randomUUID(), noteId: note.id, firebaseUid: req.userId });
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      // Lost a race with a concurrent share request for the same note — the
      // unique {noteId, firebaseUid} index (models/SharedNote.ts) is what
      // actually prevented the duplicate; fetch whichever one won.
      const existing = await SharedNote.findOne({ noteId: note.id, firebaseUid: req.userId });
      if (!existing) throw err;
      shared = existing;
    }
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
  const shared = await SharedNote.findOne({ token: req.params.token });
  if (!shared) throw new ApiError(404, 'This note is no longer available.', 'general');

  // Already imported this exact share before (including the sharer reopening
  // their own link) — hand back the existing copy instead of creating a
  // duplicate. Falls through to a fresh import if that earlier copy was
  // itself deleted since.
  const previousImport = await SharedNoteImport.findOne({ token: shared.token, firebaseUid: req.userId });
  if (previousImport) {
    const existingNote = await Note.findOne({ _id: previousImport.noteId, firebaseUid: req.userId });
    if (existingNote) {
      res.json({ alreadyImported: true, note: toPublicNote(existingNote) });
      return;
    }
    // That earlier copy was deleted since — fall through to a fresh import.
  }

  const note = await Note.findOne({ _id: shared.noteId, firebaseUid: shared.firebaseUid });
  if (!note) throw new ApiError(404, 'This note is no longer available.', 'general');

  // This bypasses note.controller.ts's createNote entirely (it's a straight
  // copy, not a client-submitted create), so nothing else enforces the usual
  // length caps on this path — truncate defensively rather than trusting the
  // source note is already within them (it should be, but a cap lowered
  // since the source was created, or legacy data from before caps existed,
  // would otherwise import uncapped).
  const title = note.title.slice(0, NOTE_TITLE_MAX_LENGTH);
  const body = note.body.slice(0, NOTE_BODY_MAX_LENGTH);

  // Unfiled, like every other newly created note — the recipient can move it
  // into a folder themselves afterward.
  const created = await Note.create({ firebaseUid: req.userId, title, body });

  try {
    await SharedNoteImport.create({ token: shared.token, firebaseUid: req.userId, noteId: created.id });
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // Lost a race with a concurrent import of this same link by this same
    // user — the unique {token, firebaseUid} index (models/SharedNoteImport.ts)
    // is what actually prevented two copies from coexisting. Our copy above
    // is now redundant; delete it and hand back whichever import won instead.
    await Note.deleteOne({ _id: created.id });
    const winningImport = await SharedNoteImport.findOne({ token: shared.token, firebaseUid: req.userId });
    const winningNote = winningImport && (await Note.findOne({ _id: winningImport.noteId, firebaseUid: req.userId }));
    if (winningNote) {
      res.json({ alreadyImported: true, note: toPublicNote(winningNote) });
      return;
    }
    throw err;
  }

  res.status(201).json({ alreadyImported: false, note: toPublicNote(created) });
}
