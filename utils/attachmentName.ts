// The server decides how to read an attachment from its file name's extension, so the extension
// has to match what the file really is. Phones don't always make that so: a picture saved from
// the Photos app can be named "IMG_1.HEIC" while holding a JPEG, a file from another app can have
// no extension at all, and the picker's `fileName` can be null.

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/csv': 'csv',
  'text/comma-separated-values': 'csv',
  'text/tab-separated-values': 'tsv',
  'text/plain': 'txt',
  'text/markdown': 'md',
};

function splitExtension(name: string): { base: string; ext: string } {
  const match = /^(.*?)(?:\.([A-Za-z0-9]{1,5}))?$/.exec(name);
  return { base: match?.[1] ?? name, ext: (match?.[2] ?? '').toLowerCase() };
}

// A name whose extension matches `mimeType`. Keeps the original base name when there is one.
// `fallbackBase` is used when the file has no name (limited photo access, a content URI).
export function attachmentNameFor(name: string | null | undefined, mimeType: string | null | undefined, fallbackBase: string): string {
  const wanted = mimeType ? EXT_BY_MIME[mimeType.toLowerCase()] : undefined;
  const { base, ext } = splitExtension((name ?? '').trim());
  const baseName = base || fallbackBase;
  // Nothing known about the real type: keep whatever extension the file came with.
  if (!wanted) return ext ? `${baseName}.${ext}` : baseName;
  // Same family (jpg/jpeg): leave as it is.
  if (ext === wanted || (wanted === 'jpg' && ext === 'jpeg')) return `${baseName}.${ext}`;
  return `${baseName}.${wanted}`;
}
