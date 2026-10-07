import { NoteMemberDocument } from '../models/NoteMember';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { sendEmail } from '../utils/email';
import { INVITE_TTL_DAYS } from '../constants/collaboration';
import { buildCollabInviteEmailHtml } from './collabEmailHtml';
import { InvitationState, undoInvitation } from './inviteState';

// The public page the emailed link opens (backend/src/routes/inviteWeb.routes.ts).
const invitePageUrl = (token: string) => `${env.backendPublicUrl.replace(/\/+$/, '')}/invite/${token}`;

// Emails the invitation, and if that fails takes the invitation back (see undoInvitation) so an
// email nobody received can't replace a link that was working. Throws a 502 in that case.
export async function sendInvitationOrUndo(
  invitation: NoteMemberDocument,
  token: string,
  noteTitle: string,
  previousState: InvitationState | null
): Promise<void> {
  const { subject, html, text } = buildCollabInviteEmailHtml({
    inviterLabel: invitation.inviterLabel,
    noteTitle,
    role: invitation.role,
    inviteUrl: invitePageUrl(token),
    expiresInDays: INVITE_TTL_DAYS,
  });
  try {
    await sendEmail({ to: invitation.email, subject, html, text });
  } catch (err) {
    console.error('[collaboration] invitation email failed', err);
    await undoInvitation(invitation, previousState);
    throw new ApiError(502, "We couldn't send the invitation email. Check the address and try again.", 'general');
  }
}
