import { Request, Response } from 'express';
import { Note, toPublicNote } from '../models/Note';
import { NoteMember, NoteMemberDocument } from '../models/NoteMember';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { requireNoteAccess } from '../services/noteAccess';
import { accountNameOf, displayLabelFor, labelShownToCollaborators, shortenLabel } from '../services/collabLabels';
import { createInviteToken, hashInviteToken } from '../services/inviteTokens';
import { captureInvitationState, isInviteExpired, newInviteExpiry } from '../services/inviteState';
import { assertInvitationKeepsItsPlace, assertMayInvite } from '../services/inviteLimits';
import { requireInviteeEmail, requireRole } from '../services/inviteValidation';
import { sendInvitationOrUndo } from '../services/inviteEmail';
import { notifyOwnerOfInviteResponse } from '../services/inviteResponsePush';
import { notifyMemberOfAccessChange } from '../services/accessChangePush';
import { buildInviteMessageHtml, buildInvitePageHtml } from '../services/inviteHtml';
import { COLLABORATION_UPGRADE_MESSAGE, NoteRole, canUseCollaboration } from '../constants/collaboration';

// ---------------------------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------------------------

const notFound = () => new ApiError(404, 'Not found.', 'general');
const inviteUnavailable = () => new ApiError(404, 'This invitation is no longer available.', 'general');
const alreadyHasAccess = (field: 'email' | 'general') => new ApiError(409, 'That person already has access to this note.', field);

function requireCollaborationEnabled(uid: string): void {
  if (!canUseCollaboration(uid)) throw new ApiError(402, COLLABORATION_UPGRADE_MESSAGE, 'general');
}

// Only a note's OWNER manages who has access to it.
async function requireOwnedNote(req: AuthedRequest) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  if (access.role !== 'owner') throw new ApiError(403, 'Only the owner of a note can do that.', 'general');
  return access.note;
}

// What the owner sees for each invitation. Never includes the token.
function toPublicMember(member: NoteMemberDocument) {
  return {
    id: member.id as string,
    email: member.email,
    role: member.role,
    status: member.status,
    expired: isInviteExpired(member),
    createdAt: member.createdAt.toISOString(),
    respondedAt: member.respondedAt ? member.respondedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------------------------
// The owner's side: inviting people and managing their access
// ---------------------------------------------------------------------------------------------

export async function listMembers(req: AuthedRequest, res: Response) {
  const note = await requireOwnedNote(req);
  const members = await NoteMember.find({ noteId: note.id }).sort({ createdAt: 1 });
  res.json(members.map(toPublicMember));
}

interface InvitationToSave {
  noteId: string;
  ownerUid: string;
  email: string;
  role: NoteRole;
  tokenHash: string;
  inviterLabel: string;
  // This address's earlier invitation to the note (declined, expired or still pending), if any.
  existing: NoteMemberDocument | null;
}

// Creates the invitation, or renews this address's earlier one with a new link.
async function saveInvitation({ noteId, ownerUid, email, role, tokenHash, inviterLabel, existing }: InvitationToSave): Promise<NoteMemberDocument> {
  const fields = { noteId, ownerUid, email, role, tokenHash, inviterLabel, status: 'pending' as const, expiresAt: newInviteExpiry(), lastSentAt: new Date() };
  try {
    if (!existing) return await NoteMember.create({ ...fields, sendCount: 1 });

    const renewed = await NoteMember.findOneAndUpdate(
      { _id: existing._id, status: { $ne: 'accepted' } },
      { $set: { ...fields, sendCount: existing.sendCount + 1 }, $unset: { memberUid: '', respondedAt: '' } },
      { new: true }
    );
    // Null means they accepted in the meantime.
    if (!renewed) throw alreadyHasAccess('email');
    return renewed;
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ApiError(409, 'That person was just invited.', 'email');
    throw err;
  }
}

export async function inviteMember(req: AuthedRequest, res: Response) {
  const ownerUid = req.userId!;
  requireCollaborationEnabled(ownerUid);
  const note = await requireOwnedNote(req);
  const email = requireInviteeEmail(req.body?.email, req.userEmail);
  const role = requireRole(req.body?.role);

  const existing = await NoteMember.findOne({ noteId: note.id, email });
  if (existing?.status === 'accepted') throw alreadyHasAccess('email');
  await assertMayInvite({ ownerUid, noteId: note.id, email, existing });

  const { token, tokenHash } = createInviteToken();
  const previousState = existing ? captureInvitationState(existing) : null;
  const inviterLabel = await displayLabelFor(ownerUid, req.userEmail);

  const invitation = await saveInvitation({ noteId: note.id, ownerUid, email, role, tokenHash, inviterLabel, existing });
  await assertInvitationKeepsItsPlace(invitation, previousState);
  await sendInvitationOrUndo(invitation, token, note.title, previousState);
  res.status(201).json(toPublicMember(invitation));
}

// Sends the same invitation again with a fresh link (the earlier link stops working once the new
// email has gone out).
export async function resendInvite(req: AuthedRequest, res: Response) {
  const ownerUid = req.userId!;
  requireCollaborationEnabled(ownerUid);
  const note = await requireOwnedNote(req);

  const invitation = await NoteMember.findOne({ _id: req.params.memberId, noteId: note.id }).catch(() => null);
  if (!invitation) throw notFound();
  if (invitation.status === 'accepted') throw alreadyHasAccess('general');
  await assertMayInvite({ ownerUid, noteId: note.id, email: invitation.email, existing: invitation });

  const { token, tokenHash } = createInviteToken();
  const previousState = captureInvitationState(invitation);
  const renewed = await NoteMember.findOneAndUpdate(
    { _id: invitation._id, status: { $ne: 'accepted' } },
    {
      $set: { tokenHash, status: 'pending', expiresAt: newInviteExpiry(), lastSentAt: new Date(), sendCount: invitation.sendCount + 1 },
      $unset: { respondedAt: '' },
    },
    { new: true }
  );
  if (!renewed) throw alreadyHasAccess('general');

  await assertInvitationKeepsItsPlace(renewed, previousState);
  await sendInvitationOrUndo(renewed, token, note.title, previousState);
  res.json(toPublicMember(renewed));
}

export async function changeMemberRole(req: AuthedRequest, res: Response) {
  const note = await requireOwnedNote(req);
  const role = requireRole(req.body?.role);
  const before = await NoteMember.findOne({ _id: req.params.memberId, noteId: note.id }).catch(() => null);
  if (!before) throw notFound();
  const member = await NoteMember.findOneAndUpdate({ _id: before._id }, { $set: { role } }, { new: true });
  if (!member) throw notFound();
  res.json(toPublicMember(member));

  // Someone who already joined is told right away; a pending invitation simply carries the new
  // permission, and re-selecting the same one changes nothing, so neither sends a push.
  if (before.status === 'accepted' && before.memberUid && before.role !== role) {
    void notifyMemberOfAccessChange({ memberUid: before.memberUid, ownerUid: req.userId!, noteId: note.id, noteTitle: note.title, newRole: role });
  }
}

// Cancels a pending invitation or removes someone's access. Immediate: their next request is refused.
export async function removeMember(req: AuthedRequest, res: Response) {
  const note = await requireOwnedNote(req);
  const removed = await NoteMember.findOneAndDelete({ _id: req.params.memberId, noteId: note.id }).catch(() => null);
  if (!removed) throw notFound();
  res.status(204).send();
}

// ---------------------------------------------------------------------------------------------
// Who has access to a note
// ---------------------------------------------------------------------------------------------

// The owner knows every address: an accepted person is shown by name, anyone else by address.
async function labelSeenByOwner(member: NoteMemberDocument): Promise<string> {
  if (member.status !== 'accepted') return member.email;
  return (await accountNameOf(member.memberUid)) ?? member.email;
}

async function describePerson(member: NoteMemberDocument, viewer: { uid: string; isOwner: boolean }) {
  const label = viewer.isOwner ? await labelSeenByOwner(member) : await labelShownToCollaborators(member.memberUid, member.email);
  return {
    // Only the owner gets the address and the id needed to manage the invitation.
    ...(viewer.isOwner ? { id: member.id as string, email: member.email } : {}),
    label,
    role: member.role,
    status: member.status,
    expired: isInviteExpired(member),
    isYou: member.memberUid === viewer.uid,
  };
}

// The owner and each collaborator with their role. Anyone with access can ask. The OWNER sees every
// invitation (pending, declined, expired too); everyone else sees only the people who accepted,
// by name (or a masked address), with no addresses and no ids.
export async function getNotePeople(req: AuthedRequest, res: Response) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  const isOwner = access.role === 'owner';
  const viewer = { uid: req.userId!, isOwner };

  const shownMembers = await NoteMember.find(isOwner ? { noteId: access.note.id } : { noteId: access.note.id, status: 'accepted' }).sort({ createdAt: 1 });
  const people = await Promise.all(shownMembers.map((member) => describePerson(member, viewer)));

  res.json({
    role: access.role,
    owner: { label: isOwner ? 'You' : await displayLabelFor(access.note.firebaseUid), isYou: isOwner },
    people,
  });
}

// ---------------------------------------------------------------------------------------------
// The invited person's side: notes shared with them
// ---------------------------------------------------------------------------------------------

// Notes other people shared with me (accepted invitations only), most recently edited first.
export async function listSharedWithMe(req: AuthedRequest, res: Response) {
  const memberships = await NoteMember.find({ memberUid: req.userId, status: 'accepted' });
  if (memberships.length === 0) {
    res.json([]);
    return;
  }
  const notes = await Note.find({ _id: { $in: memberships.map((membership) => membership.noteId) } });
  const noteById = new Map(notes.map((note) => [note.id as string, note]));

  const sharedNotes = memberships.flatMap((membership) => {
    const note = noteById.get(membership.noteId);
    // A note that no longer exists simply isn't listed.
    return note ? [{ note: toPublicNote(note), role: membership.role, ownerLabel: shortenLabel(membership.inviterLabel) }] : [];
  });
  sharedNotes.sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));
  res.json(sharedNotes);
}

// One note I have access to, fresh from the server, with my role (the app polls this to pick up
// other people's edits and role changes).
export async function getSharedNote(req: AuthedRequest, res: Response) {
  const access = await requireNoteAccess(req.userId!, req.params.id);
  res.json({ note: toPublicNote(access.note), role: access.role });
}

// An invited person stepping away from a note shared with them.
export async function leaveNote(req: AuthedRequest, res: Response) {
  const left = await NoteMember.findOneAndDelete({ noteId: req.params.id, memberUid: req.userId, status: 'accepted' }).catch(() => null);
  if (!left) throw notFound();
  res.status(204).send();
}

// ---------------------------------------------------------------------------------------------
// Invitations (the emailed link)
// ---------------------------------------------------------------------------------------------

const MIN_TOKEN_LENGTH = 20;
const MAX_TOKEN_LENGTH = 100;

// The invitation behind a token, in whatever state it is in. null when the token is unknown.
async function findInviteByToken(token: unknown) {
  if (typeof token !== 'string' || token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) return null;
  const invitation = await NoteMember.findOne({ tokenHash: hashInviteToken(token) });
  if (!invitation) return null;
  const note = await Note.findById(invitation.noteId).select('title firebaseUid');
  return { invitation, note };
}

export async function previewInvite(req: AuthedRequest, res: Response) {
  const lookup = await findInviteByToken(req.params.token);
  if (!lookup?.note) throw inviteUnavailable();
  const { invitation, note } = lookup;
  res.json({
    noteTitle: note.title,
    role: invitation.role,
    inviterLabel: invitation.inviterLabel,
    status: invitation.status,
    expired: isInviteExpired(invitation),
    // This very account already has access (for example it opened the link twice).
    alreadyYours: invitation.status === 'accepted' && invitation.memberUid === req.userId,
    isOwner: note.firebaseUid === req.userId,
  });
}

export async function acceptInvite(req: AuthedRequest, res: Response) {
  const uid = req.userId!;
  requireCollaborationEnabled(uid);
  const lookup = await findInviteByToken(req.params.token);
  if (!lookup?.note) throw inviteUnavailable();
  const { invitation, note } = lookup;

  if (note.firebaseUid === uid) throw new ApiError(400, "This is your own note, so you don't need an invitation.", 'general');

  if (invitation.status === 'accepted') {
    // Accepting twice from the same account is harmless: it just reports the access it already has.
    if (invitation.memberUid === uid) {
      res.json({ noteId: invitation.noteId, role: invitation.role });
      return;
    }
    throw new ApiError(410, 'This invitation has already been used.', 'general');
  }
  if (invitation.status === 'declined') throw new ApiError(410, 'This invitation was declined. Ask for a new one.', 'general');
  if (isInviteExpired(invitation)) throw new ApiError(410, 'This invitation has expired. Ask for a new one.', 'general');

  // An account has one place per note, however many invitations it holds.
  const alreadyMember = await NoteMember.findOne({ noteId: invitation.noteId, memberUid: uid, status: 'accepted' });
  if (alreadyMember) throw new ApiError(409, 'You already have access to this note.', 'general');

  // Only a still-pending, unexpired invitation can be accepted, and only once.
  let accepted: NoteMemberDocument | null;
  try {
    accepted = await NoteMember.findOneAndUpdate(
      { _id: invitation._id, status: 'pending', expiresAt: { $gt: new Date() } },
      { $set: { status: 'accepted', memberUid: uid, respondedAt: new Date() } },
      { new: true }
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ApiError(409, 'You already have access to this note.', 'general');
    throw err;
  }
  if (!accepted) throw new ApiError(410, 'This invitation has already been used.', 'general');
  res.json({ noteId: accepted.noteId, role: accepted.role });

  // Only the request that actually accepted it tells the owner (a repeat tap changes nothing).
  void notifyOwnerOfInviteResponse({
    ownerUid: accepted.ownerUid,
    noteId: accepted.noteId,
    noteTitle: note.title,
    inviteeEmail: accepted.email,
    responderUid: uid,
    outcome: 'accepted',
  });
}

// Marks a still-pending invitation as declined. Declining never needs an account: the link in the
// email is enough. Returns whether THIS call declined it (false when it had already been answered).
async function declinePendingInvite(invitationId: unknown): Promise<boolean> {
  const declined = await NoteMember.findOneAndUpdate(
    { _id: invitationId, status: 'pending' },
    { $set: { status: 'declined', respondedAt: new Date() } }
  );
  return !!declined;
}

export async function declineInvite(req: AuthedRequest, res: Response) {
  const lookup = await findInviteByToken(req.params.token);
  if (!lookup) throw inviteUnavailable();
  if (lookup.invitation.status === 'accepted') throw new ApiError(409, 'This invitation was already accepted.', 'general');
  const declinedNow = await declinePendingInvite(lookup.invitation._id);
  res.status(204).send();
  if (declinedNow && lookup.note) {
    void notifyOwnerOfInviteResponse({
      ownerUid: lookup.invitation.ownerUid,
      noteId: lookup.invitation.noteId,
      noteTitle: lookup.note.title,
      inviteeEmail: lookup.invitation.email,
      responderUid: req.userId,
      outcome: 'declined',
    });
  }
}

// ---------------------------------------------------------------------------------------------
// The public pages behind the emailed link (no sign-in)
// ---------------------------------------------------------------------------------------------

const UNAVAILABLE_PAGE = buildInviteMessageHtml('Invitation unavailable', 'This invitation is no longer available, or the link is incorrect.');

export async function getInviteWebPage(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const lookup = await findInviteByToken(req.params.token);
  if (!lookup?.note) {
    res.status(404).send(UNAVAILABLE_PAGE);
    return;
  }
  const { invitation, note } = lookup;

  if (invitation.status === 'accepted') {
    res.send(buildInviteMessageHtml('Already accepted', 'This invitation was already accepted. Open i-Planner to find the note under Shared with me.'));
  } else if (invitation.status === 'declined') {
    res.send(buildInviteMessageHtml('Invitation declined', 'This invitation was declined.'));
  } else if (isInviteExpired(invitation)) {
    res.send(buildInviteMessageHtml('Invitation expired', 'This invitation has expired. Ask the sender to invite you again.'));
  } else {
    res.send(buildInvitePageHtml({ inviterLabel: invitation.inviterLabel, noteTitle: note.title, role: invitation.role, token: req.params.token }));
  }
}

// POST only: a GET (which email scanners and link previews perform) must never decline anything.
export async function declineInviteWebPage(req: Request, res: Response) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const lookup = await findInviteByToken(req.params.token);
  if (!lookup) {
    res.status(404).send(UNAVAILABLE_PAGE);
    return;
  }
  if (lookup.invitation.status === 'accepted') {
    res.send(buildInviteMessageHtml('Already accepted', 'This invitation was already accepted, so it can no longer be declined here.'));
    return;
  }
  const declinedNow = await declinePendingInvite(lookup.invitation._id);
  if (declinedNow && lookup.note) {
    void notifyOwnerOfInviteResponse({
      ownerUid: lookup.invitation.ownerUid,
      noteId: lookup.invitation.noteId,
      noteTitle: lookup.note.title,
      inviteeEmail: lookup.invitation.email,
      outcome: 'declined',
    });
  }
  res.send(buildInviteMessageHtml('Invitation declined', "You've declined the invitation. The sender won't be notified by email, and you won't get access to the note."));
}
