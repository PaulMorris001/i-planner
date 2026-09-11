import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { Alert } from 'react-native';
import type { Note } from '@/types/note.types';

// Escapes user text before embedding it in the generated HTML — title/body are
// freeform note content, not markup, and must not be interpreted as HTML.
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A safe, friendly PDF filename derived from the note's title — letters/digits/
// spaces/dashes only, collapsed whitespace, capped length. printToFileAsync
// itself only ever returns a random UUID filename, so this is what the share
// sheet actually offers the recipient (e.g. "Chapter 3 Notes.pdf" instead of a
// UUID).
function sanitizeFilename(title: string): string {
  const cleaned = title
    .trim()
    .replace(/[^\p{L}\p{N} \-_]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'Note').slice(0, 60);
}

function buildHtml(note: Note): string {
  const bodyHtml = escapeHtml(note.body).replace(/\n/g, '<br/>');
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Helvetica, Arial, sans-serif; padding: 32px; color: #1a1a1a; }
      h1 { font-size: 22px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #888; margin-bottom: 24px; }
      .body { font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(note.title)}</h1>
    <div class="meta">Exported from i-Planner &middot; ${new Date().toLocaleDateString()}</div>
    <div class="body">${bodyHtml || '<em>No additional text</em>'}</div>
  </body>
</html>`;
}

// Renders `note` to a PDF and hands it to the OS share sheet. There's no
// separate "download" mechanism on mobile the way there is on web — the share
// sheet's own "Save to Files" (iOS) / "Save to device" (Android) destination
// covers downloading, and every other app listed in it covers sharing.
export async function shareNote(note: Note): Promise<void> {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Not available', "Sharing isn't supported on this device.");
      return;
    }

    const { uri } = await Print.printToFileAsync({ html: buildHtml(note) });

    // Copy to a friendlier filename before sharing — see sanitizeFilename above.
    // (Clear out any leftover file from a previous share of a same-titled note
    // first — File#copy throws if the destination already exists.)
    const printedFile = new File(uri);
    const destination = new File(Paths.cache, `${sanitizeFilename(note.title)}.pdf`);
    if (destination.exists) destination.delete();
    printedFile.copy(destination);

    await Sharing.shareAsync(destination.uri, {
      mimeType: 'application/pdf',
      dialogTitle: note.title,
      UTI: 'com.adobe.pdf',
    });
  } catch (err) {
    console.error('[exportNote] failed to share note', err);
    Alert.alert('Couldn’t share note', 'Something went wrong exporting this note. Please try again.');
  }
}
