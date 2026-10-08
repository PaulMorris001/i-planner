import { flattenText } from './collabEmailHtml';
import { accountNameOf } from './collabLabels';
import { REMINDERS_CHANNEL_ID, sendPushToUser } from './pushNotifications';

export type InviteOutcome = 'accepted' | 'declined';

interface InviteResponse {
  // The note's owner: the person who is told.
  ownerUid: string;
  noteId: string;
  noteTitle: string;
  // The address the invitation was sent to; used as the name when the person has none, or
  // answered from the email page without an account.
  inviteeEmail: string;
  // The account that answered, when it is known (accepting always has one).
  responderUid?: string;
  outcome: InviteOutcome;
}

const MAX_NAME_LENGTH = 40;
const MAX_TITLE_LENGTH = 50;

// Tells the note's owner that someone they invited accepted or declined. Not tied to any switch:
// it goes to every device the owner has registered, like the AI-reply push (the OS notification
// permission is the only control). Tapping it opens the note.
//
// Best-effort: a push problem is logged and never fails the accept or decline that triggered it.
export async function notifyOwnerOfInviteResponse(response: InviteResponse): Promise<void> {
  try {
    const name = flattenText((await accountNameOf(response.responderUid)) ?? response.inviteeEmail, MAX_NAME_LENGTH);
    const noteTitle = flattenText(response.noteTitle, MAX_TITLE_LENGTH) || 'your note';
    const accepted = response.outcome === 'accepted';

    await sendPushToUser(
      response.ownerUid,
      {
        title: accepted ? 'Invitation accepted' : 'Invitation declined',
        body: `${name} ${accepted ? 'accepted' : 'declined'} your invitation to "${noteTitle}".`,
        route: `/note-editor?id=${response.noteId}`,
      },
      { kind: 'invite-response', channelId: REMINDERS_CHANNEL_ID }
    );
  } catch (err) {
    console.error('[invite] could not notify the owner', err);
  }
}
