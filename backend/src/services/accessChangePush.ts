import { flattenText } from './collabEmailHtml';
import { accountNameOf } from './collabLabels';
import { REMINDERS_CHANNEL_ID, sendPushToUser } from './pushNotifications';
import type { NoteRole } from '../constants/collaboration';

interface AccessChange {
  // The person whose permission changed: the one who is told.
  memberUid: string;
  ownerUid: string;
  noteId: string;
  noteTitle: string;
  newRole: NoteRole;
}

const MAX_NAME_LENGTH = 40;
const MAX_TITLE_LENGTH = 50;

// Tells a collaborator that the owner changed what they may do in a note (view <-> edit). Like the
// invitation-response push it is not tied to any switch, and tapping it opens the note.
//
// Best-effort: a push problem is logged and never fails the change that triggered it.
export async function notifyMemberOfAccessChange(change: AccessChange): Promise<void> {
  try {
    const ownerName = flattenText((await accountNameOf(change.ownerUid)) ?? 'The owner', MAX_NAME_LENGTH);
    const noteTitle = flattenText(change.noteTitle, MAX_TITLE_LENGTH) || 'a note';
    const canEdit = change.newRole === 'editor';

    await sendPushToUser(
      change.memberUid,
      {
        title: 'Your access changed',
        body: `${ownerName} changed your access to "${noteTitle}": you can now ${canEdit ? 'edit' : 'only view'} it.`,
        route: `/note-editor?id=${change.noteId}`,
      },
      { kind: 'access-change', channelId: REMINDERS_CHANNEL_ID }
    );
  } catch (err) {
    console.error('[collab] could not notify the member of the access change', err);
  }
}
