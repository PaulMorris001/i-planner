import { firebaseAuth } from '../config/firebaseAdmin';
import { MAX_LABEL_LENGTH } from '../constants/collaboration';
import { flattenText } from './collabEmailHtml';

// A name safe to show to other people: one line, no control characters, capped in length.
export function shortenLabel(value: string | undefined | null, fallback = 'Someone'): string {
  return flattenText(value ?? '', MAX_LABEL_LENGTH) || fallback;
}

// The name on an account, or null when it has none (or the account can't be read).
export async function accountNameOf(uid: string | undefined): Promise<string | null> {
  if (!uid) return null;
  try {
    const user = await firebaseAuth.getUser(uid);
    return flattenText(user.displayName ?? '', MAX_LABEL_LENGTH) || null;
  } catch {
    return null;
  }
}

// How an account is named in an invitation: its name, else its email address.
export async function displayLabelFor(uid: string, fallbackEmail?: string): Promise<string> {
  try {
    const user = await firebaseAuth.getUser(uid);
    return shortenLabel(user.displayName || user.email || fallbackEmail);
  } catch {
    return shortenLabel(fallbackEmail);
  }
}

// "vw@example.com" -> "v***@example.com": enough to recognise, never the whole address.
export function maskEmail(email: string): string {
  const atSign = email.lastIndexOf('@');
  if (atSign < 1) return '***';
  return `${email[0]}***${email.slice(atSign)}`;
}

// How one collaborator is named to the OTHER collaborators: their account name if they have
// one, otherwise a masked address (collaborators never see each other's real addresses).
export async function labelShownToCollaborators(memberUid: string | undefined, email: string): Promise<string> {
  return (await accountNameOf(memberUid)) ?? maskEmail(email);
}
