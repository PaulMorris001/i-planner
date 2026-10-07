import { ApiError } from '../utils/ApiError';
import { NOTE_ROLES, NoteRole } from '../constants/collaboration';

// Loose on purpose: the real check is the email arriving. This only rejects obvious typos.
const EMAIL_PATTERN = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

// The address to invite, trimmed and lower-cased. Refuses anything that isn't an address and
// the inviter's own address.
export function requireInviteeEmail(rawEmail: unknown, inviterEmail: string | undefined): string {
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    throw new ApiError(400, 'Enter a valid email address.', 'email');
  }
  if (inviterEmail && email === inviterEmail.toLowerCase()) {
    throw new ApiError(400, "That's your own email address.", 'email');
  }
  return email;
}

export function requireRole(rawRole: unknown): NoteRole {
  const isKnownRole = typeof rawRole === 'string' && (NOTE_ROLES as string[]).includes(rawRole);
  if (!isKnownRole) throw new ApiError(400, 'Choose whether they can view or edit.', 'general');
  return rawRole as NoteRole;
}
