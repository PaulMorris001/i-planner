import sanitizeHtml from 'sanitize-html';

// Formatted notes are stored as HTML with this marker in front. The marker is
// what tells a formatted note apart from an older plain-text one: a plain note
// can legitimately contain "<" characters, so sniffing for tags would
// misclassify it. Keep in sync with the app's utils/richNote.ts.
export const RICH_BODY_MARKER = '<!--rt-->';

export function isRichBody(body: string): boolean {
  return body.startsWith(RICH_BODY_MARKER);
}

// Everything the editor's toolbar can produce (bold, italic, highlight, text
// alignment, bullet/numbered lists) plus the structural tags around them, and
// nothing else. Note HTML is shown on a public web page (sharedNoteHtml.ts) and
// inside the app's editor WebView, so anything outside this list, such as
// scripts, event handlers, iframes or links, is stripped on save. That makes the
// stored body safe for every reader, whatever a client sent.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'mark', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote'];
const CSS_COLOR = [/^#[0-9a-fA-F]{3,8}$/, /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/];

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    '*': ['style'],
    mark: ['style', 'data-color'],
    ol: ['start'],
  },
  allowedStyles: {
    '*': { 'text-align': [/^(left|center|right|justify)$/] },
    mark: { 'background-color': CSS_COLOR, color: CSS_COLOR },
  },
  // Drop the contents of tags that should never carry visible text.
  nonTextTags: ['script', 'style', 'textarea', 'noscript', 'iframe', 'object', 'embed'],
  disallowedTagsMode: 'discard',
};

// Sanitized HTML for a formatted body (marker already removed).
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

// Sanitizes a stored body: formatted ones are cleaned and keep their marker,
// plain ones pass through untouched.
export function sanitizeBody(body: string): string {
  return isRichBody(body) ? RICH_BODY_MARKER + sanitizeRichHtml(body.slice(RICH_BODY_MARKER.length)) : body;
}

// Length of the visible text of a body, which is what the note length limit
// counts. A formatted note's HTML markup doesn't use up the user's allowance.
export function visibleTextLength(body: string): number {
  if (!isRichBody(body)) return body.length;
  const text = sanitizeHtml(body.slice(RICH_BODY_MARKER.length), { allowedTags: [], allowedAttributes: {} });
  // The sanitizer re-encodes & < > as entities; count each as the single
  // character it displays as.
  return text.replace(/&(amp|lt|gt|quot|#39);/g, '_').length;
}
