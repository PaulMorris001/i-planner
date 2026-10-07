// Collaboration on notes. Every number here is in one place so the feature can be
// tightened, or put behind a paid plan, without hunting through the code.

// Most people (accepted or still pending) one note can have besides its owner.
export const MAX_MEMBERS_PER_NOTE = 10;
// How long an invitation link works.
export const INVITE_TTL_DAYS = 14;
// Invitation emails one account may send per day (new invites + resends together). Stops the
// invite form being used to send mail to strangers in bulk.
export const MAX_INVITE_EMAILS_PER_DAY = 30;
// Invitation emails ONE ADDRESS may receive per day from everyone combined, so an address
// can't be flooded by many different accounts each sending a few.
export const MAX_INVITES_PER_RECIPIENT_PER_DAY = 5;
// The longest name (the inviter's, or a collaborator's) that is shown to other people.
export const MAX_LABEL_LENGTH = 60;
// The same invitation can be re-sent at most this often, and this many times.
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_SENDS_PER_INVITE = 5;

export type NoteRole = 'viewer' | 'editor';
export const NOTE_ROLES: NoteRole[] = ['viewer', 'editor'];

// When collaboration moves to a paid plan, this is the one switch: return false (or look at
// the account's subscription tier) and every collaboration action is refused with the
// message below. Free for everyone for now.
export function canUseCollaboration(_firebaseUid: string): boolean {
  void _firebaseUid;
  return true;
}
export const COLLABORATION_UPGRADE_MESSAGE = 'Collaboration is available on a paid plan.';
