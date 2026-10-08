import { APP_STORE_URL, PLAY_STORE_URL, escapeHtml, page } from './sharedNoteHtml';
import type { NoteRole } from '../constants/collaboration';

const ROLE_LABEL: Record<NoteRole, string> = { editor: 'can view and edit', viewer: 'can view' };

const EXTRA_STYLES = `
  .role { display: inline-block; font-size: 12px; font-weight: 700; color: #3B82F6; background: #E8EEFC;
    border-radius: 999px; padding: 4px 10px; margin-bottom: 14px; }
  .note-title { font-size: 18px; font-weight: 700; padding: 12px 14px; background: #F7F7FB; border-radius: 12px; margin: 0 0 18px; }
  .decline-form { margin: 0; }
  .decline-btn { display: block; width: 100%; box-sizing: border-box; text-align: center; background: #fff; color: #6B6A80;
    font-weight: 700; padding: 13px; border-radius: 999px; font-size: 14px; border: 1.5px solid #E4E3EF; cursor: pointer; margin-top: 10px; }
`;

// The public, signed-out page the emailed invitation link opens. Viewing it changes nothing
// (email scanners open links); declining needs an actual button press (a POST).
export function buildInvitePageHtml(input: { inviterLabel: string; noteTitle: string; role: NoteRole; token: string }): string {
  const inviter = input.inviterLabel.trim() || 'Someone';
  return page(
    'Note invitation',
    `<style>${EXTRA_STYLES}</style>
    <h1>You've been invited to a note</h1>
    <div class="meta">${escapeHtml(inviter)} invited you to collaborate on i-Planner</div>
    <div class="role">You ${ROLE_LABEL[input.role]}</div>
    <div class="note-title">${escapeHtml(input.noteTitle || 'Untitled note')}</div>`,
    `<a class="open-btn" href="iplanner://invite?token=${encodeURIComponent(input.token)}">Open in i-Planner to accept</a>
    <form class="decline-form" method="post" action="/invite/${encodeURIComponent(input.token)}/decline">
      <button class="decline-btn" type="submit">Decline</button>
    </form>
    <div class="stores">Don't have the app? <a href="${APP_STORE_URL}">App Store</a> &middot; <a href="${PLAY_STORE_URL}">Google Play</a>. Install it, sign in, then open this link again. If the app opens but shows an error page, close it fully and reopen it once so it can update, then open this link again.</div>`
  );
}

export function buildInviteMessageHtml(title: string, message: string): string {
  return page(title, `<h1>${escapeHtml(title)}</h1><div class="body">${escapeHtml(message)}</div>`);
}
