const APP_STORE_URL = 'https://apps.apple.com/app/id6792868417';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.obitoventures.iplanner';

// Same reasoning as utils/exportNote.ts's own escapeHtml — title/body are
// freeform user text, not markup, and this page is publicly reachable by
// anyone with the link (unauthenticated), so this is a real XSS boundary,
// not just cosmetic escaping.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PAGE_STYLES = `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #F7F7FB; color: #0F0E2A; margin: 0; padding: 32px 20px; }
  .card { max-width: 560px; margin: 0 auto; background: #fff; border: 1px solid #E4E3EF;
    border-radius: 20px; padding: 28px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #A8A7BE; margin-bottom: 20px; }
  .body { font-size: 15px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 28px; }
  .open-btn { display: block; text-align: center; background: #3B82F6; color: #fff; font-weight: 700;
    text-decoration: none; padding: 14px; border-radius: 999px; font-size: 15px; }
  .stores { margin-top: 16px; text-align: center; font-size: 13px; color: #6B6A80; }
  .stores a { color: #3B82F6; text-decoration: none; font-weight: 600; }
`;

function page(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>${PAGE_STYLES}</style>
  </head>
  <body>
    <div class="card">${bodyHtml}</div>
  </body>
</html>`;
}

export function buildSharedNoteHtml(note: { title: string; body: string }, token: string): string {
  const bodyHtml = escapeHtml(note.body).replace(/\n/g, '<br/>');
  return page(
    note.title,
    `<h1>${escapeHtml(note.title)}</h1>
    <div class="meta">Shared from i-Planner</div>
    <div class="body">${bodyHtml || '<em>No additional text</em>'}</div>
    <a class="open-btn" href="iplanner://shared-note?token=${encodeURIComponent(token)}">Open in i-Planner</a>
    <div class="stores">Don't have the app? <a href="${APP_STORE_URL}">App Store</a> &middot; <a href="${PLAY_STORE_URL}">Google Play</a></div>`
  );
}

export function buildSharedNoteUnavailableHtml(): string {
  return page(
    'Note unavailable',
    `<h1>This note is no longer available</h1>
    <div class="body">It may have been deleted, or the link may be incorrect.</div>`
  );
}
