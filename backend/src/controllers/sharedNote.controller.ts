import crypto from 'crypto';
import { Request, Response } from 'express';
import { Note, NoteDocument, toPublicNote } from '../models/Note';
import { SharedNote, SharedNoteDocument } from '../models/SharedNote';
import { SharedNoteImport } from '../models/SharedNoteImport';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { shortId } from '../utils/shortId';
import { slugFromShareId, titledShareId } from '../utils/shareSlug';
import { env } from '../config/env';
import { NOTE_TITLE_MAX_LENGTH, NOTE_BODY_MAX_LENGTH } from '../constants/noteLimits';
import { isRichBody, sanitizeBody } from '../utils/richText';
import { buildSharedNoteHtml, buildSharedNoteUnavailableHtml } from '../services/sharedNoteHtml';

// Resolves a share token to the underlying note's *current* content — not a
// snapshot, see models/SharedNote.ts. Returns null if the share link itself
// is bogus, or if the note it points at has since been deleted; callers turn
// that into whatever "not available" response fits their context (an HTML
// page for the web route, a 404 ApiError for the JSON routes).
// A link carries the short slug (/n/<slug>), the slug with the note's title in
// front (/n/<title-words>-<slug>), or, for links made before short links
// existed, the original UUID token (/shared/<token>). The words in front are
// only for readers: the slug after the last hyphen is what identifies the note.
async function findShare(id: string) {
  const exact = await SharedNote.findOne({ $or: [{ slug: id }, { token: id }] });
  if (exact || !id.includes('-')) return exact;
  return SharedNote.findOne({ slug: slugFromShareId(id) });
}

async function resolveSharedNote(id: string) {
  const shared = await findShare(id);
  if (!shared) return null;
  const note = await Note.findOne({ _id: shared.noteId, firebaseUid: shared.firebaseUid });
  if (!note) return null;
  return { note, shared };
}

// What a copy of `note` would be once imported (same caps/sanitizing as the import
// itself), so "do I already have this?" compares like with like.
export function copyOf(note: { title: string; body: string }) {
  return {
    title: note.title.slice(0, NOTE_TITLE_MAX_LENGTH),
    // A formatted body is copied whole: cutting HTML at a character count would slice
    // through a tag. It was validated and sanitized when saved; sanitizing again is a
    // cheap safeguard on a path that skips note.controller.ts.
    body: isRichBody(note.body) ? sanitizeBody(note.body) : note.body.slice(0, NOTE_BODY_MAX_LENGTH),
  };
}

export type ExistingReason = 'own' | 'imported' | 'same';

// A note must never be added to an account that already has it:
//  - 'own': the link is to the person's OWN note (they shared it, then opened it).
//  - 'imported': they already added this exact share and that copy still exists.
//  - 'same': they already have a note with exactly this title and text (for example a
//    friend sent their copy back without changing it).
// Adding a note creates a NEW, independent note (new id, no syncing). So a friend's
// copy that was edited and shared back is a different note and can be added.
async function findExistingNote(
  uid: string,
  shared: SharedNoteDocument,
  source: NoteDocument
): Promise<{ note: NoteDocument; reason: ExistingReason } | null> {
  if (shared.firebaseUid === uid) return { note: source, reason: 'own' };

  const previousImport = await SharedNoteImport.findOne({ token: shared.token, firebaseUid: uid });
  if (previousImport) {
    const copy = await Note.findOne({ _id: previousImport.noteId, firebaseUid: uid });
    if (copy) return { note: copy, reason: 'imported' };
    // That earlier copy was deleted since: falls through to the checks below.
  }

  const { title, body } = copyOf(source);
  const same = await Note.findOne({ firebaseUid: uid, title, body });
  if (same) return { note: same, reason: 'same' };
  return null;
}

export async function createShare(req: AuthedRequest, res: Response) {
  const note = await findOwnedOrThrow(Note, req.params.id, req.userId!);
  let shared = await SharedNote.findOne({ noteId: note.id, firebaseUid: req.userId });
  if (!shared) {
    try {
      shared = await SharedNote.create({ token: crypto.randomUUID(), slug: shortId(), noteId: note.id, firebaseUid: req.userId });
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
  // Shares from before short links existed get a slug now. The old /shared/
  // <uuid> link stays valid, since findShare still matches the token.
  if (!shared.slug) {
    for (let attempt = 0; attempt < 3 && !shared.slug; attempt++) {
      try {
        shared.slug = shortId();
        await shared.save();
      } catch (err) {
        shared.slug = undefined; // ~1-in-10^17 slug collision - just retry
        if (!isDuplicateKeyError(err) || attempt === 2) throw err;
      }
    }
  }
  res.json({ url: `${env.shareBaseUrl}/n/${titledShareId(note.title, shared.slug!)}` });
}

// Unauthenticated — anyone with the link can view the preview page, same as
// clicking a shared Google Doc link before being asked to sign in.
export async function getSharedNoteWebPage(req: Request, res: Response) {
  const resolved = await resolveSharedNote(req.params.token);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  if (!resolved) {
    res.status(404).send(buildSharedNoteUnavailableHtml());
    return;
  }
  // The app is opened with the real slug, not the title-prefixed one from the URL.
  res.send(buildSharedNoteHtml({ title: resolved.note.title, body: resolved.note.body }, resolved.shared.slug ?? resolved.shared.token));
}

export async function getSharedNotePreview(req: AuthedRequest, res: Response) {
  const resolved = await resolveSharedNote(req.params.token);
  if (!resolved) throw new ApiError(404, 'This note is no longer available.', 'general');
  const existing = await findExistingNote(req.userId!, resolved.shared, resolved.note);
  res.json({
    title: resolved.note.title,
    body: resolved.note.body,
    // Set when this account already has the note: the app offers "Open" instead of "Add".
    existing: existing ? { noteId: existing.note.id as string, reason: existing.reason } : null,
  });
}

export async function importSharedNote(req: AuthedRequest, res: Response) {
  const shared = await findShare(req.params.token);
  if (!shared) throw new ApiError(404, 'This note is no longer available.', 'general');

  // Already imported this exact share before: hand back that copy even if the sharer
  // has since deleted the original.
  const previousImport = await SharedNoteImport.findOne({ token: shared.token, firebaseUid: req.userId });
  if (previousImport) {
    const existingCopy = await Note.findOne({ _id: previousImport.noteId, firebaseUid: req.userId });
    if (existingCopy) {
      res.json({ alreadyImported: true, reason: 'imported', note: toPublicNote(existingCopy) });
      return;
    }
    // That earlier copy was deleted since. Its import record has to go too: the unique
    // {token, account} index would otherwise reject the new copy below as a repeat.
    await SharedNoteImport.deleteOne({ _id: previousImport._id, noteId: previousImport.noteId });
  }

  const note = await Note.findOne({ _id: shared.noteId, firebaseUid: shared.firebaseUid });
  if (!note) throw new ApiError(404, 'This note is no longer available.', 'general');

  // Never create a second copy of a note the account already has.
  const existing = await findExistingNote(req.userId!, shared, note);
  if (existing) {
    res.json({ alreadyImported: true, reason: existing.reason, note: toPublicNote(existing.note) });
    return;
  }

  // This bypasses note.controller.ts's createNote entirely (it's a straight
  // copy, not a client-submitted create), so nothing else enforces the usual
  // length caps on this path — truncate defensively rather than trusting the
  // source note is already within them (it should be, but a cap lowered
  // since the source was created, or legacy data from before caps existed,
  // would otherwise import uncapped).
  const { title, body } = copyOf(note);

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
      res.json({ alreadyImported: true, reason: 'imported', note: toPublicNote(winningNote) });
      return;
    }
    throw err;
  }

  res.status(201).json({ alreadyImported: false, reason: null, note: toPublicNote(created) });
}
