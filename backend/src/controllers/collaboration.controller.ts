import crypto from 'crypto';
import { Request, Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { NoteMember, NoteMemberDocument } from '../models/NoteMember';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { firebaseAuth } from '../config/firebaseAdmin';
import { env } from '../config/env';
import { sendEmail } from '../utils/email';
import { getNoteAccess, requireNoteAccess } from '../services/noteAccess';
import { buildCollabInviteEmailHtml, flattenText } from '../services/collabEmailHtml';
import { buildInviteMessageHtml, buildInvitePageHtml } from '../services/inviteHtml';
import {
  COLLABORATION_UPGRADE_MESSAGE,
  INVITE_TTL_DAYS,
  MAX_INVITES_PER_RECIPIENT_PER_DAY,
  MAX_LABEL_LENGTH,
  MAX_INVITE_EMAILS_PER_DAY,
  MAX_MEMBERS_PER_NOTE,
  MAX_SENDS_PER_INVITE,
  NOTE_ROLES,
  NoteRole,
  RESEND_COOLDOWN_MS,
  canUseCollaboration,
} from '../constants/collaboration';

const DAY_MS = 24 * 60 * 60 * 1000;
// Loose on purpose: a real check is the email arriving. This only rejects obvious typos.
const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// The secret in the emailed link. Only its hash is stored.
function newInviteToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256(token) };
}

function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function requireRole(raw: unknown): NoteRole {
  if (typeof raw !== 'string' || !(NOTE_ROLES as string[]).includes(raw)) {
    throw new ApiError(400, 'Choose whether they can view or edit.', 'general');
  }
  return raw as NoteRole;
}

function requireCollaboration(uid: string) {
  if (!canUseCollaboration(uid)) throw new ApiError(402, COLLABORATION_UPGRADE_MESSAGE, 'general');
}

const cleanLabel = (value: string | undefined | null, fallback = 'Someone') => flattenText(value ?? '', MAX_LABEL_LENGTH) || fallback;

async function labelFor(uid: string, fallbackEmail?: string): Promise<string> {
  try {
    const user = await firebaseAuth.getUser(uid);
    return cleanLabel(user.displayName || user.email || fallbackEmail);
  } catch {
    return cleanLabel(fallbackEmail);
  }
}

// "vw@example.com" -> "v***@example.com": enough to recognise, never the whole address.
function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

// A person other than the viewer, as other collaborators see them: their name if their account
// has one, otherwise a masked address.
async function nameOf(uid: string | undefined): Promise<string | null> {
  if (!uid) return null;
  try {
    const user = await firebaseAuth.getUser(uid);
    return flattenText(user.displayName ?? '', MAX_LABEL_LENGTH) || null;
  } catch {
    return null;
  }
}

async function publicLabelFor(memberUid: string | undefined, email: string): Promise<string> {
  return (await nameOf(memberUid)) ?? maskEmail(email);
}

const isExpired = (m: Pick<NoteMemberDocument, 'status' | 'expiresAt'>) => m.status === 'pending' && m.expiresAt.getTime() <= Date.now();

// What the owner sees for each person. Never includes the token.
function toPublicMember(m: NoteMemberDocument) {
  return {
    id: m.id as string,
    email: m.email,
    role: m.role,
    status: m.status,
    expired: isExpired(m),
    createdAt: m.createdAt.toISOString(),
    respondedAt: m.respondedAt ? m.respondedAt.toISOString() : null,
  };
}

// Only the note's OWNER manages who has access.
async function requireOwnedNote(req: AuthedRequest) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  if (access.role !== 'owner') throw new ApiError(403, 'Only the owner of a note can do that.', 'general');
  return access.note;
}

// Invitation emails this owner has sent in the last day (new invites and resends).
async function emailsSentToday(ownerUid: string): Promise<number> {
  const since = new Date(Date.now() - DAY_MS);
  const rows = await NoteMember.find({ ownerUid, lastSentAt: { $gte: since } }).select('_id').lean();
  return rows.length;
}

// Invitation emails ONE ADDRESS received in the last day, from anyone.
async function emailsToAddressToday(email: string): Promise<number> {
  const since = new Date(Date.now() - DAY_MS);
  return NoteMember.countDocuments({ email, lastSentAt: { $gte: since } });
}

// Who counts against a note's people limit: everyone who accepted, and invitations that can
// still be accepted. Expired and declined invitations do not use a place.
const countsTowardLimit = (noteId: string) => ({
  noteId,
  $or: [{ status: 'accepted' }, { status: 'pending', expiresAt: { $gt: new Date() } }],
});

// The fields an invitation write changes, so a failed email can put them back exactly.
const SNAPSHOT_FIELDS = ['role', 'status', 'tokenHash', 'expiresAt', 'inviterLabel', 'lastSentAt', 'sendCount', 'memberUid', 'respondedAt'] as const;
function snapshotOf(m: NoteMemberDocument) {
  const set: Record<string, unknown> = {};
  const unset: Record<string, ''> = {};
  for (const key of SNAPSHOT_FIELDS) {
    const value = (m as unknown as Record<string, unknown>)[key];
    if (value === undefined || value === null) unset[key] = '';
    else set[key] = value;
  }
  return { set, unset };
}
async function restoreSnapshot(id: unknown, snapshot: ReturnType<typeof snapshotOf>) {
  await NoteMember.updateOne({ _id: id }, { $set: snapshot.set, ...(Object.keys(snapshot.unset).length ? { $unset: snapshot.unset } : {}) });
}

async function deliverInvite(member: NoteMemberDocument, token: string, noteTitle: string): Promise<void> {
  const { subject, html, text } = buildCollabInviteEmailHtml({
    inviterLabel: member.inviterLabel,
    noteTitle,
    role: member.role,
    inviteUrl: `${env.backendPublicUrl.replace(/\/+$/, '')}/invite/${token}`,
    expiresInDays: INVITE_TTL_DAYS,
  });
  await sendEmail({ to: member.email, subject, html, text });
}

// ---------- the owner's side ----------

export async function listMembers(req: AuthedRequest, res: Response) {
  const note = await requireOwnedNote(req);
  const members = await NoteMember.find({ noteId: note.id }).sort({ createdAt: 1 });
  res.json(members.map(toPublicMember));
}

export async function inviteMember(req: AuthedRequest, res: Response) {
  requireCollaboration(req.userId!);
  const note = await requireOwnedNote(req);
  const email = normalizeEmail(req.body?.email);
  const role = requireRole(req.body?.role);

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) throw new ApiError(400, 'Enter a valid email address.', 'email');
  if (req.userEmail && email === req.userEmail.toLowerCase()) throw new ApiError(400, "That's your own email address.", 'email');

  const existing = await NoteMember.findOne({ noteId: note.id, email });
  if (existing && existing.status === 'accepted') throw new ApiError(409, 'That person already has access to this note.', 'email');
  // However many times someone is invited (or re-invited after declining), they get a limited number of emails.
  if (existing && existing.sendCount >= MAX_SENDS_PER_INVITE) {
    throw new ApiError(429, 'That person has been invited too many times already.', 'email');
  }

  // The note's people are capped. Re-inviting someone whose invitation is still live does not add one.
  const counted = await NoteMember.countDocuments(countsTowardLimit(note.id));
  const aliveAlready = !!existing && existing.status === 'pending' && existing.expiresAt.getTime() > Date.now();
  if (!aliveAlready && counted >= MAX_MEMBERS_PER_NOTE) {
    throw new ApiError(400, `A note can have up to ${MAX_MEMBERS_PER_NOTE} people invited.`, 'general');
  }
  if ((await emailsSentToday(req.userId!)) >= MAX_INVITE_EMAILS_PER_DAY) {
    throw new ApiError(429, "You've sent a lot of invitations today. Try again tomorrow.", 'general');
  }
  if ((await emailsToAddressToday(email)) >= MAX_INVITES_PER_RECIPIENT_PER_DAY) {
    throw new ApiError(429, "We can't send another invitation to that address right now. Try again tomorrow.", 'email');
  }
  if (existing && existing.status === 'pending' && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError(429, 'That person was just invited. Give it a minute before sending again.', 'general');
  }

  const { token, tokenHash } = newInviteToken();
  const now = new Date();
  const fields = {
    noteId: note.id,
    ownerUid: req.userId!,
    email,
    role,
    status: 'pending' as const,
    tokenHash,
    expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS),
    inviterLabel: await labelFor(req.userId!, req.userEmail),
    lastSentAt: now,
  };
  const before = existing ? snapshotOf(existing) : null;

  let member: NoteMemberDocument;
  try {
    member = existing
      ? ((await NoteMember.findOneAndUpdate(
          { _id: existing._id, status: { $ne: 'accepted' } },
          { $set: { ...fields, sendCount: existing.sendCount + 1 }, $unset: { memberUid: '', respondedAt: '' } },
          { new: true }
        )) as NoteMemberDocument)
      : await NoteMember.create({ ...fields, sendCount: 1 });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ApiError(409, 'That person was just invited.', 'email');
    throw err;
  }
  if (!member) throw new ApiError(409, 'That person already has access to this note.', 'email');

  // Several invitations can get past the check above at the same moment. Settle it by order of
  // creation: only the first MAX_MEMBERS_PER_NOTE places stand, the rest are taken back.
  const standing = await NoteMember.find(countsTowardLimit(note.id)).sort({ _id: 1 }).limit(MAX_MEMBERS_PER_NOTE).select('_id').lean();
  if (!standing.some((row) => String(row._id) === String(member._id))) {
    if (before) await restoreSnapshot(member._id, before);
    else await NoteMember.deleteOne({ _id: member._id });
    throw new ApiError(400, `A note can have up to ${MAX_MEMBERS_PER_NOTE} people invited.`, 'general');
  }

  try {
    await deliverInvite(member, token, note.title);
  } catch (err) {
    console.error('[collaboration] invitation email failed', err);
    // An invitation nobody received must not replace one that was working: put everything back exactly.
    if (before) await restoreSnapshot(member._id, before);
    else await NoteMember.deleteOne({ _id: member._id });
    throw new ApiError(502, "We couldn't send the invitation email. Check the address and try again.", 'general');
  }
  res.status(201).json(toPublicMember(member));
}

export async function resendInvite(req: AuthedRequest, res: Response) {
  requireCollaboration(req.userId!);
  const note = await requireOwnedNote(req);
  const member = await NoteMember.findOne({ _id: req.params.memberId, noteId: note.id }).catch(() => null);
  if (!member) throw new ApiError(404, 'Not found.', 'general');
  if (member.status === 'accepted') throw new ApiError(409, 'That person already has access to this note.', 'general');
  if (member.sendCount >= MAX_SENDS_PER_INVITE) throw new ApiError(429, 'That invitation has been sent too many times already.', 'general');
  if (Date.now() - member.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError(429, 'That person was just invited. Give it a minute before sending again.', 'general');
  }
  if ((await emailsSentToday(req.userId!)) >= MAX_INVITE_EMAILS_PER_DAY) {
    throw new ApiError(429, "You've sent a lot of invitations today. Try again tomorrow.", 'general');
  }
  if ((await emailsToAddressToday(member.email)) >= MAX_INVITES_PER_RECIPIENT_PER_DAY) {
    throw new ApiError(429, "We can't send another invitation to that address right now. Try again tomorrow.", 'email');
  }
  // A declined or expired invitation coming back to life takes a place again.
  const wasLive = member.status === 'pending' && member.expiresAt.getTime() > Date.now();
  if (!wasLive && (await NoteMember.countDocuments(countsTowardLimit(note.id))) >= MAX_MEMBERS_PER_NOTE) {
    throw new ApiError(400, `A note can have up to ${MAX_MEMBERS_PER_NOTE} people invited.`, 'general');
  }

  // A fresh link: the earlier one stops working once this one has been sent.
  const { token, tokenHash } = newInviteToken();
  const now = new Date();
  const before = snapshotOf(member);
  const updated = await NoteMember.findOneAndUpdate(
    { _id: member._id, status: { $ne: 'accepted' } },
    {
      $set: { tokenHash, status: 'pending', expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * DAY_MS), lastSentAt: now, sendCount: member.sendCount + 1 },
      $unset: { respondedAt: '' },
    },
    { new: true }
  );
  if (!updated) throw new ApiError(409, 'That person already has access to this note.', 'general');
  try {
    await deliverInvite(updated, token, note.title);
  } catch (err) {
    console.error('[collaboration] invitation email failed', err);
    // The email never went out, so the earlier link must keep working.
    await restoreSnapshot(updated._id, before);
    throw new ApiError(502, "We couldn't send the invitation email. Try again.", 'general');
  }
  res.json(toPublicMember(updated));
}

export async function changeMemberRole(req: AuthedRequest, res: Response) {
  const note = await requireOwnedNote(req);
  const role = requireRole(req.body?.role);
  const member = await NoteMember.findOneAndUpdate({ _id: req.params.memberId, noteId: note.id }, { $set: { role } }, { new: true }).catch(() => null);
  if (!member) throw new ApiError(404, 'Not found.', 'general');
  res.json(toPublicMember(member));
}

// Cancels a pending invitation or removes someone's access. Immediate: their next request is refused.
export async function removeMember(req: AuthedRequest, res: Response) {
  const note = await requireOwnedNote(req);
  const removed = await NoteMember.findOneAndDelete({ _id: req.params.memberId, noteId: note.id }).catch(() => null);
  if (!removed) throw new ApiError(404, 'Not found.', 'general');
  res.status(204).send();
}

// The note's people with their access: the owner, and each collaborator with a role. Anyone with
// access can see it. The OWNER also gets every invitation (pending, declined, expired) with the
// address and an id to manage it; everyone else sees only people who accepted, by name (or a
// masked address), with no addresses and no ids.
export async function getNotePeople(req: AuthedRequest, res: Response) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  const isOwner = access.role === 'owner';
  const rows = await NoteMember.find(isOwner ? { noteId: access.note.id } : { noteId: access.note.id, status: 'accepted' }).sort({ createdAt: 1 });

  const people = await Promise.all(
    rows.map(async (m) => {
      // The owner knows the address, so it is the fallback; everyone else only ever gets a masked one.
      const label = isOwner ? (m.status === 'accepted' ? (await nameOf(m.memberUid)) ?? m.email : m.email) : await publicLabelFor(m.memberUid, m.email);
      return {
        ...(isOwner ? { id: m.id as string, email: m.email } : {}),
        label,
        role: m.role,
        status: m.status,
        expired: isExpired(m),
        isYou: m.memberUid === req.userId,
      };
    })
  );
  res.json({
    role: access.role,
    owner: { label: isOwner ? 'You' : await labelFor(access.note.firebaseUid), isYou: isOwner },
    people,
  });
}

// ---------- the member's side ----------

// Notes other people shared with me (accepted invitations only), with my role.
export async function listSharedWithMe(req: AuthedRequest, res: Response) {
  const memberships = await NoteMember.find({ memberUid: req.userId, status: 'accepted' });
  if (!memberships.length) {
    res.json([]);
    return;
  }
  const notes = await Note.find({ _id: { $in: memberships.map((m) => m.noteId) } });
  const byId = new Map(notes.map((n) => [n.id as string, n]));
  const result = memberships
    .map((m) => {
      const note = byId.get(m.noteId);
      return note ? { note: toPublicNote(note), role: m.role, ownerLabel: cleanLabel(m.inviterLabel) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => !!row)
    .sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));
  res.json(result);
}

// One shared note, fresh from the server (the app refreshes it before and while editing).
export async function getSharedNote(req: AuthedRequest, res: Response) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  res.json({ note: toPublicNote(access.note), role: access.role });
}

// A member stepping away from a note shared with them.
export async function leaveNote(req: AuthedRequest, res: Response) {
  const removed = await NoteMember.findOneAndDelete({ noteId: req.params.id, memberUid: req.userId, status: 'accepted' }).catch(() => null);
  if (!removed) throw new ApiError(404, 'Not found.', 'general');
  res.status(204).send();
}

// ---------- invitations (the emailed link) ----------

// The invitation behind a token, whatever its state; null when the token is unknown.
async function findInvite(token: string) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const member = await NoteMember.findOne({ tokenHash: sha256(token) });
  if (!member) return null;
  const note = await Note.findById(member.noteId).select('title firebaseUid');
  return { member, note };
}

export async function previewInvite(req: AuthedRequest, res: Response) {
  const found = await findInvite(req.params.token);
  if (!found || !found.note) throw new ApiError(404, 'This invitation is no longer available.', 'general');
  const { member, note } = found;
  res.json({
    noteTitle: note.title,
    role: member.role,
    inviterLabel: member.inviterLabel,
    // 'pending' | 'accepted' | 'declined', plus whether the link has run out.
    status: member.status,
    expired: isExpired(member),
    // True when this very account already has access (e.g. it opened the link twice).
    alreadyYours: member.status === 'accepted' && member.memberUid === req.userId,
    isOwner: note.firebaseUid === req.userId,
  });
}

export async function acceptInvite(req: AuthedRequest, res: Response) {
  requireCollaboration(req.userId!);
  const found = await findInvite(req.params.token);
  if (!found || !found.note) throw new ApiError(404, 'This invitation is no longer available.', 'general');
  const { member, note } = found;

  if (note.firebaseUid === req.userId) throw new ApiError(400, "This is your own note, so you don't need an invitation.", 'general');
  // Accepting twice from the same account is harmless: it just reports the access it already has.
  if (member.status === 'accepted') {
    if (member.memberUid === req.userId) {
      res.json({ noteId: member.noteId, role: member.role });
      return;
    }
    throw new ApiError(410, 'This invitation has already been used.', 'general');
  }
  if (member.status === 'declined') throw new ApiError(410, 'This invitation was declined. Ask for a new one.', 'general');
  if (isExpired(member)) throw new ApiError(410, 'This invitation has expired. Ask for a new one.', 'general');

  // One accepted place per account per note, however many invitations it holds.
  const alreadyMember = await NoteMember.findOne({ noteId: member.noteId, memberUid: req.userId, status: 'accepted' });
  if (alreadyMember) throw new ApiError(409, 'You already have access to this note.', 'general');

  // The claim: only a still-pending, unexpired invitation can be accepted, and only once.
  let accepted: NoteMemberDocument | null;
  try {
    accepted = await NoteMember.findOneAndUpdate(
      { _id: member._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'accepted', memberUid: req.userId, respondedAt: new Date() } },
      { new: true }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ApiError(409, 'You already have access to this note.', 'general');
    throw err;
  }
  if (!accepted) throw new ApiError(410, 'This invitation has already been used.', 'general');
  res.json({ noteId: accepted.noteId, role: accepted.role });
}

// Declining never needs an account: the link in the email is enough (see the public page).
async function declinePending(token: string): Promise<boolean> {
  const found = await findInvite(token);
  if (!found) return false;
  const declined = await NoteMember.findOneAndUpdate(
    { _id: found.member._id, status: 'pending' },
    { $set: { status: 'declined', respondedAt: new Date() } },
    { new: true }
  );
  return !!declined;
}

export async function declineInvite(req: AuthedRequest, res: Response) {
  const found = await findInvite(req.params.token);
  if (!found) throw new ApiError(404, 'This invitation is no longer available.', 'general');
  if (found.member.status === 'accepted') throw new ApiError(409, 'This invitation was already accepted.', 'general');
  await declinePending(req.params.token);
  res.status(204).send();
}

// ---------- the public pages (no sign-in) ----------

export async function getInviteWebPage(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const found = await findInvite(req.params.token);
  if (!found || !found.note) {
    res.status(404).send(buildInviteMessageHtml('Invitation unavailable', 'This invitation is no longer available, or the link is incorrect.'));
    return;
  }
  const { member, note } = found;
  if (member.status === 'accepted') {
    res.send(buildInviteMessageHtml('Already accepted', 'This invitation was already accepted. Open i-Planner to find the note under Shared with me.'));
    return;
  }
  if (member.status === 'declined') {
    res.send(buildInviteMessageHtml('Invitation declined', 'This invitation was declined.'));
    return;
  }
  if (isExpired(member)) {
    res.send(buildInviteMessageHtml('Invitation expired', 'This invitation has expired. Ask the sender to invite you again.'));
    return;
  }
  res.send(buildInvitePageHtml({ inviterLabel: member.inviterLabel, noteTitle: note.title, role: member.role, token: req.params.token }));
}

// POST only: a GET (which email scanners and link previews perform) must never decline anything.
export async function declineInviteWebPage(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const found = await findInvite(req.params.token);
  if (!found) {
    res.status(404).send(buildInviteMessageHtml('Invitation unavailable', 'This invitation is no longer available, or the link is incorrect.'));
    return;
  }
  if (found.member.status === 'accepted') {
    res.send(buildInviteMessageHtml('Already accepted', 'This invitation was already accepted, so it can no longer be declined here.'));
    return;
  }
  await declinePending(req.params.token);
  res.send(buildInviteMessageHtml('Invitation declined', "You've declined the invitation. The sender won't be notified by email, and you won't get access to the note."));
}

// Used by the note controller: does this note currently have anyone invited or accepted?
export async function noteHasCollaborators(noteId: string): Promise<boolean> {
  return !!(await NoteMember.exists({ noteId, status: 'accepted' }));
}

export { getNoteAccess };
