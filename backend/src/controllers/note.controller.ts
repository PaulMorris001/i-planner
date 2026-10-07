import { Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { Folder } from '../models/Folder';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { NoteMember } from '../models/NoteMember';
import { requireNoteAccess } from '../services/noteAccess';
import { cleanNoteText } from '../services/noteCleanup';
import { NOTE_BODY_MAX_LENGTH, NOTE_RICH_BODY_MAX_LENGTH, NOTE_TITLE_MAX_LENGTH } from '../constants/noteLimits';
import { sanitizeBody, visibleTextLength } from '../utils/richText';

// Cleans a body (formatted ones are sanitized; see utils/richText.ts) and
// enforces the length limits: the visible text is capped at
// NOTE_BODY_MAX_LENGTH, the stored string at NOTE_RICH_BODY_MAX_LENGTH.
function validatedBody(body: string): string {
  const clean = sanitizeBody(body);
  if (clean.length > NOTE_RICH_BODY_MAX_LENGTH || visibleTextLength(clean) > NOTE_BODY_MAX_LENGTH) {
    throw new ApiError(400, `Note is too long (max ${NOTE_BODY_MAX_LENGTH.toLocaleString()} characters).`, 'general');
  }
  return clean;
}

export async function listNotes(req: AuthedRequest, res: Response) {
  const notes = await Note.find({ firebaseUid: req.userId }).sort({ updatedAt: -1 });
  res.json(notes.map(toPublicNote));
}

export async function createNote(req: AuthedRequest, res: Response) {
  const { title, body, folderId } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new ApiError(400, 'Title is required.', 'general');
  }
  const trimmedTitle = title.trim();
  if (trimmedTitle.length > NOTE_TITLE_MAX_LENGTH) {
    throw new ApiError(400, `Title is too long (max ${NOTE_TITLE_MAX_LENGTH.toLocaleString()} characters).`, 'general');
  }
  const cleanBody = typeof body === 'string' ? validatedBody(body) : '';
  // Verified against the owning user, not just trusted from the client, so a
  // note can never end up silently referencing another user's folder (or one
  // that no longer exists) — findOwnedOrThrow throws its own clean 404 if not.
  if (typeof folderId === 'string' && folderId) {
    await findOwnedOrThrow(Folder, folderId, req.userId!);
  }

  const note = await Note.create({
    firebaseUid: req.userId,
    title: trimmedTitle,
    // A brand-new note's body is optional — anything other than a real
    // string (including simply omitted) just starts empty. updateNote below
    // is stricter: a wrong type there is far more likely a client bug acting
    // on an *existing* note than an intentional "clear the body."
    body: cleanBody,
    ...(typeof folderId === 'string' && folderId ? { folderId } : {}),
  });

  res.status(201).json(toPublicNote(note));
}

export async function updateNote(req: AuthedRequest, res: Response) {
  // The owner can change everything; an invited editor only the title and text; a viewer nothing.
  // Someone with no access gets the same 404 as a note that doesn't exist.
  const access = await requireNoteAccess(req.userId!, req.params.id);
  if (access.role === 'viewer') throw new ApiError(403, 'You can view this note but not edit it.', 'general');
  const isOwner = access.role === 'owner';
  const note = access.note;

  const { title, body, folderId, baseVersion } = req.body ?? {};
  if (!isOwner && folderId !== undefined) throw new ApiError(403, 'Only the owner of a note can move it.', 'general');

  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  if (title !== undefined) {
    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new ApiError(400, 'Title is required.', 'general');
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length > NOTE_TITLE_MAX_LENGTH) {
      throw new ApiError(400, `Title is too long (max ${NOTE_TITLE_MAX_LENGTH.toLocaleString()} characters).`, 'general');
    }
    set.title = trimmedTitle;
  }
  if (body !== undefined) {
    // Unlike createNote, a wrong type here is rejected outright rather than
    // silently coerced — coercing to '' on an *update* would silently wipe
    // an existing note's content, and passing anything else straight to
    // Mongoose would let it get cast/stringified with no length check at all.
    if (typeof body !== 'string') {
      throw new ApiError(400, 'Body must be text.', 'general');
    }
    set.body = validatedBody(body);
  }
  // Explicit null (or '') un-files the note — the "move to no folder" case —
  // distinct from folderId simply being absent from the patch, which leaves
  // it untouched. A real, non-empty string moves it into that folder, after
  // the same ownership check as create.
  if (folderId !== undefined) {
    if (folderId === null || folderId === '') {
      unset.folderId = '';
    } else if (typeof folderId === 'string') {
      await findOwnedOrThrow(Folder, folderId, req.userId!);
      set.folderId = folderId;
    }
  }

  // Nothing to change: leave the note (and its version) exactly as it is.
  if (!Object.keys(set).length && !Object.keys(unset).length) {
    res.json(toPublicNote(note));
    return;
  }

  // Optimistic concurrency. The app sends the version it loaded; if the note has been saved by
  // someone else since, this save is refused (below) rather than overwriting their work.
  // An invited editor MUST send it; the owner may omit it (older app versions do).
  const filter: Record<string, unknown> = { _id: note._id };
  if (baseVersion !== undefined) {
    if (!Number.isInteger(baseVersion) || baseVersion < 0) throw new ApiError(400, 'Invalid version.', 'general');
    filter.$or = baseVersion === 0 ? [{ version: 0 }, { version: { $exists: false } }] : [{ version: baseVersion }];
  } else if (!isOwner) {
    throw new ApiError(400, 'Reload the note and try again.', 'general');
  }

  const updated = await Note.findOneAndUpdate(
    filter,
    {
      $set: { ...set, lastEditedByUid: req.userId },
      $inc: { version: 1 },
      ...(Object.keys(unset).length ? { $unset: unset } : {}),
    },
    { new: true, runValidators: true }
  );
  if (!updated) {
    // Either someone saved first (a conflict) or the note was deleted in the meantime.
    const latest = await Note.findById(note._id);
    if (!latest) throw new ApiError(404, 'Not found.', 'general');
    res.status(409).json({
      message: 'This note was changed by someone else. Load the latest version to keep their changes.',
      field: 'conflict',
      note: toPublicNote(latest),
    });
    return;
  }
  res.json(toPublicNote(updated));
}

export async function deleteNote(req: AuthedRequest, res: Response) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  // Only the owner deletes a note. Someone it was shared with can leave it instead.
  if (access.role !== 'owner') throw new ApiError(403, 'Only the owner of a note can delete it. You can leave it instead.', 'general');
  await access.note.deleteOne();
  // Everyone who had access loses it with the note.
  await NoteMember.deleteMany({ noteId: access.note.id });
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
