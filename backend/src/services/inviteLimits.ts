import { NoteMember, NoteMemberDocument } from '../models/NoteMember';
import { ApiError } from '../utils/ApiError';
import {
  MAX_INVITE_EMAILS_PER_DAY,
  MAX_INVITES_PER_RECIPIENT_PER_DAY,
  MAX_MEMBERS_PER_NOTE,
  MAX_SENDS_PER_INVITE,
  RESEND_COOLDOWN_MS,
} from '../constants/collaboration';
import { InvitationState, isInviteLive, placesInUseFilter, undoInvitation } from './inviteState';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const oneDayAgo = () => new Date(Date.now() - ONE_DAY_MS);

const tooManyPeopleError = () => new ApiError(400, `A note can have up to ${MAX_MEMBERS_PER_NOTE} people invited.`, 'general');

// Invitation emails an owner sent in the last day (new invitations and re-sends together).
const countEmailsSentBy = (ownerUid: string) => NoteMember.countDocuments({ ownerUid, lastSentAt: { $gte: oneDayAgo() } });

// Invitation emails one ADDRESS received in the last day, from everybody.
const countEmailsSentTo = (email: string) => NoteMember.countDocuments({ email, lastSentAt: { $gte: oneDayAgo() } });

interface InviteAttempt {
  ownerUid: string;
  noteId: string;
  email: string;
  // The invitation this address already has on this note, if any (a re-invite or a re-send).
  existing?: NoteMemberDocument | null;
}

// Every rule that decides whether an invitation email may go out right now. Throws the
// matching ApiError (429 / 400) when one is broken.
export async function assertMayInvite({ ownerUid, noteId, email, existing }: InviteAttempt): Promise<void> {
  // However often someone is invited again (including after declining), they only get a few emails.
  if (existing && existing.sendCount >= MAX_SENDS_PER_INVITE) {
    throw new ApiError(429, 'That person has been invited too many times already.', 'email');
  }
  if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    throw new ApiError(429, 'That person was just invited. Give it a minute before sending again.', 'general');
  }

  // A note has a limited number of places. Re-sending a live invitation keeps its place; a new,
  // declined or expired one needs a free place.
  const keepsItsPlace = !!existing && isInviteLive(existing);
  if (!keepsItsPlace && (await NoteMember.countDocuments(placesInUseFilter(noteId))) >= MAX_MEMBERS_PER_NOTE) {
    throw tooManyPeopleError();
  }

  if ((await countEmailsSentBy(ownerUid)) >= MAX_INVITE_EMAILS_PER_DAY) {
    throw new ApiError(429, "You've sent a lot of invitations today. Try again tomorrow.", 'general');
  }
  if ((await countEmailsSentTo(email)) >= MAX_INVITES_PER_RECIPIENT_PER_DAY) {
    throw new ApiError(429, "We can't send another invitation to that address right now. Try again tomorrow.", 'email');
  }
}

// Several invitations can pass the check above at the same instant. Once an invitation is saved,
// the places are settled by order of creation: only the first MAX_MEMBERS_PER_NOTE stand, and a
// later one is taken back (and the person is told the note is full).
export async function assertInvitationKeepsItsPlace(
  invitation: NoteMemberDocument,
  previousState: InvitationState | null
): Promise<void> {
  const firstPlaces = await NoteMember.find(placesInUseFilter(invitation.noteId))
    .sort({ _id: 1 })
    .limit(MAX_MEMBERS_PER_NOTE)
    .select('_id')
    .lean();
  const holdsAPlace = firstPlaces.some((place) => String(place._id) === String(invitation._id));
  if (holdsAPlace) return;
  await undoInvitation(invitation, previousState);
  throw tooManyPeopleError();
}
