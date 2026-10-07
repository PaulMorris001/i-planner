import { escapeHtml, page, APP_STORE_URL, PLAY_STORE_URL } from './sharedNoteHtml';

export interface FolderOutline {
  name: string;
  noteCount: number;
  folderCount: number;
  sections: { name: string; depth: number; notes: string[]; moreNotes: number }[];
}

const FOLDER_STYLES = `
  .folder { margin: 0 0 14px; }
  .folder-name { font-weight: 700; font-size: 15px; margin: 0 0 6px; }
  .folder-notes { list-style: none; margin: 0; padding: 0; }
  .folder-notes li { font-size: 14px; color: #0F0E2A; padding: 7px 0; border-top: 1px solid #E4E3EF; }
  .folder-notes li.more { color: #6B6A80; font-style: italic; }
  .folder-empty { font-size: 13px; color: #A8A7BE; font-style: italic; }
`;

// The public, signed-out preview of a shared folder: its name, how much is in it, and
// the titles of the notes (never their text). "Open in i-Planner" hands over to the app.
export function buildSharedFolderHtml(outline: FolderOutline, token: string): string {
  const counts = `${outline.noteCount} note${outline.noteCount === 1 ? '' : 's'}` +
    (outline.folderCount ? ` &middot; ${outline.folderCount} subfolder${outline.folderCount === 1 ? '' : 's'}` : '');
  const sections = outline.sections
    .map((section) => {
      const items = section.notes.map((title) => `<li>${escapeHtml(title)}</li>`).join('') +
        (section.moreNotes > 0 ? `<li class="more">and ${section.moreNotes} more</li>` : '');
      return `<div class="folder" style="margin-left:${Math.min(section.depth, 4) * 14}px">
        <div class="folder-name">${section.depth === 0 ? '' : '&#128193; '}${escapeHtml(section.name)}</div>
        ${items ? `<ul class="folder-notes">${items}</ul>` : '<div class="folder-empty">No notes</div>'}
      </div>`;
    })
    .join('');

  return page(
    outline.name,
    `<style>${FOLDER_STYLES}</style>
    <h1>&#128193; ${escapeHtml(outline.name)}</h1>
    <div class="meta">Shared folder from i-Planner &middot; ${counts}</div>
    ${sections}`,
    `<a class="open-btn" href="iplanner://shared-folder?token=${encodeURIComponent(token)}">Open in i-Planner</a>
    <div class="stores">Don't have the app? <a href="${APP_STORE_URL}">App Store</a> &middot; <a href="${PLAY_STORE_URL}">Google Play</a></div>`
  );
}

export function buildSharedFolderUnavailableHtml(): string {
  return page(
    'Folder unavailable',
    `<h1>This folder is no longer available</h1>
    <div class="body">It may have been deleted, or the link may be incorrect.</div>`
  );
}
