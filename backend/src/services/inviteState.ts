import { NoteMember, NoteMemberDocument } from '../models/NoteMember';
import { INVITE_TTL_DAYS } from '../constants/collaboration';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type InvitationTimes = Pick<NoteMemberDocument, 'status' | 'expiresAt'>;

// A pending invitation whose link has run out.
export const isInviteExpired = (invitation: InvitationTimes): boolean =>
  invitation.status === 'pending' && invitation.expiresAt.getTime() <= Date.now();

// A pending invitation that can still be accepted.
export const isInviteLive = (invitation: InvitationTimes): boolean =>
  invitation.status === 'pending' && invitation.expiresAt.getTime() > Date.now();

export const newInviteExpiry = (): Date => new Date(Date.now() + INVITE_TTL_DAYS * ONE_DAY_MS);

// Who uses up one of a note's places: everyone who accepted, and invitations that can still be
// accepted. Declined and expired invitations do not.
export const placesInUseFilter = (noteId: string) => ({
  noteId,
  $or: [{ status: 'accepted' }, { status: 'pending', expiresAt: { $gt: new Date() } }],
});

// ---- Putting an invitation back exactly as it was (when its email could not be sent) --------

const RESTORABLE_FIELDS = ['role', 'status', 'tokenHash', 'expiresAt', 'inviterLabel', 'lastSentAt', 'sendCount', 'memberUid', 'respondedAt'] as const;

// The values to $set, and the fields that were empty and so must be $unset.
export interface InvitationState {
  set: Record<string, unknown>;
  unset: Record<string, ''>;
}

export function captureInvitationState(invitation: NoteMemberDocument): InvitationState {
  const state: InvitationState = { set: {}, unset: {} };
  for (const field of RESTORABLE_FIELDS) {
    const value = (invitation as unknown as Record<string, unknown>)[field];
    if (value === undefined || value === null) state.unset[field] = '';
    else state.set[field] = value;
  }
  return state;
}

async function restoreInvitationState(invitationId: unknown, state: InvitationState): Promise<void> {
  const hasEmptyFields = Object.keys(state.unset).length > 0;
  await NoteMember.updateOne({ _id: invitationId }, { $set: state.set, ...(hasEmptyFields ? { $unset: state.unset } : {}) });
}

// Takes back an invitation that did not go through. One that already existed goes back to how it
// was (a link that was working keeps working); a brand-new one is simply removed.
export async function undoInvitation(invitation: NoteMemberDocument, previousState: InvitationState | null): Promise<void> {
  if (previousState) await restoreInvitationState(invitation._id, previousState);
  else await NoteMember.deleteOne({ _id: invitation._id });
}
