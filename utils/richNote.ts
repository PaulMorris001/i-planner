// A note's body is stored in one of two forms:
//  - plain text (every note made before the formatting toolbar existed), or
//  - the rich editor's HTML with RICH_BODY_MARKER in front.
// The marker is what tells them apart: plain text can legitimately contain "<",
// so sniffing for tags would misclassify it. Keep in sync with
// backend/src/utils/richText.ts. The server sanitizes formatted bodies on save.
export const RICH_BODY_MARKER = '<!--rt-->';

export function isRichBody(body: string): boolean {
  return body.startsWith(RICH_BODY_MARKER);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// Plain text -> the editor's HTML: one paragraph per line.
export function plainTextToEditorHtml(text: string): string {
  if (!text) return '<p></p>';
  return text
    .split('\n')
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

// A stored body -> the HTML to load into the editor.
export function bodyToEditorHtml(body: string): string {
  return isRichBody(body) ? body.slice(RICH_BODY_MARKER.length) || '<p></p>' : plainTextToEditorHtml(body);
}

// What the editor holds -> the string to store. An editor with no visible text
// (just "<p></p>") is stored as an empty note, not as a formatted one.
export function editorHtmlToBody(html: string): string {
  return editorHtmlToText(html).trim() ? RICH_BODY_MARKER + html : '';
}

function editorHtmlToText(html: string): string {
  return decodeEntities(
    html
      // A list item's paragraph and the item itself both close a line; count once.
      .replace(/<\/p>\s*<\/li>/gi, '</li>')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      // A tag cut off by slicing a long body for a preview.
      .replace(/<[^>]*$/, '')
      .replace(/<[^>]*>/g, '')
  );
}

// Readable text of a stored body: list previews, search, AI cleanup, and
// the length limit all work on this rather than on markup.
export function bodyToPlainText(body: string): string {
  const text = isRichBody(body) ? editorHtmlToText(body.slice(RICH_BODY_MARKER.length)) : body;
  return text.replace(/\n{3,}/g, '\n\n').trimEnd();
}

// Appends dictated text to the end of the editor's HTML: onto the last
// paragraph (like typing on after the final word) when there is one, otherwise
// as a new paragraph.
export function appendTextToEditorHtml(html: string, text: string): string {
  if (!text) return html;
  const escaped = escapeHtml(text);
  if (html.endsWith('</p>')) {
    const lastOpen = html.lastIndexOf('<p');
    const lastParagraph = html.slice(lastOpen);
    const isEmptyParagraph = /^<p[^>]*>(<br\s*\/?>)?<\/p>$/i.test(lastParagraph);
    const insertAt = html.length - '</p>'.length;
    return `${html.slice(0, insertAt)}${isEmptyParagraph ? '' : ' '}${escaped}</p>`;
  }
  return `${html}<p>${escaped}</p>`;
}
