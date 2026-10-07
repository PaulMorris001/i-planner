import mongoose from 'mongoose';
import { Note, NoteDocument } from '../models/Note';
import { NoteMember } from '../models/NoteMember';
import { ApiError } from '../utils/ApiError';

export type NoteAccessRole = 'owner' | 'editor' | 'viewer';

export interface NoteAccess {
  note: NoteDocument;
  role: NoteAccessRole;
}

// What `uid` may do with a note: it is theirs, or they accepted an invitation to it, or neither
// (null). A pending, declined or removed invitation gives no access. A malformed id is simply
// "no access", never a crash.
export async function getNoteAccess(uid: string, noteId: string): Promise<NoteAccess | null> {
  if (!mongoose.isValidObjectId(noteId)) return null;
  const note = await Note.findById(noteId);
  if (!note) return null;
  if (note.firebaseUid === uid) return { note, role: 'owner' };
  const membership = await NoteMember.findOne({ noteId: note.id, memberUid: uid, status: 'accepted' });
  if (!membership) return null;
  return { note, role: membership.role };
}

// Same, but a missing note and a note you have no access to look identical (404), so the
// existence of someone else's note is never revealed.
export async function requireNoteAccess(uid: string, noteId: string): Promise<NoteAccess> {
  const access = await getNoteAccess(uid, noteId);
  if (!access) throw new ApiError(404, 'Not found.', 'general');
  return access;
}
