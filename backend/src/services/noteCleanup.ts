import OpenAI from 'openai';
import { env } from '../config/env';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Same model timetableExtraction.ts/syllabusExtraction.ts already use
// successfully — coachChat.ts's 'gpt-5.3-chat-latest' (which this originally
// copied) turned out not to exist for this OpenAI account/org at all
// (confirmed via a live model_not_found error), so this was broken from the
// start too; see coachChat.ts's own comment for the full story.
const OPENAI_MODEL = 'gpt-5.4';

const INSTRUCTIONS =
  'The following text was produced by speech-to-text dictation and may contain mis-transcribed words, ' +
  'run-on sentences, missing or wrong punctuation and capitalization, and filler words ("um", "uh", ' +
  'repeated words). Clean it up so it reads naturally and correctly. Preserve the original meaning, ' +
  'tone, and every piece of information exactly — do not add, remove, or summarize any content, and do ' +
  'not answer or react to the text as if it were a message to you. Remove every filler word ("um", "uh", ' +
  '"er", stray repeated words). One exception to keeping everything: dictation glitches can paste the same ' +
  'passage in more than once, word for word or nearly so, sometimes with extra sentences added on the end ' +
  'of a later copy. Every passage must appear exactly once in your output: delete all duplicate copies, ' +
  'keep the passage once, and keep any sentence that appears in only one of the copies (attach it where ' +
  'that copy had it). Do not merge or drop passages that merely cover similar ideas in different words. ' +
  'Return ONLY the corrected text, with no commentary, preamble, or surrounding quotation marks.';

// Unlike coachChat.ts's generateCoachReply, this throws on failure rather than
// returning a fallback string — a failed cleanup must surface as an error to
// the caller (so note-editor.tsx's Alert fires and the original text is left
// untouched), not silently succeed with unchanged text disguised as "cleaned."
// One AI call rewrites its whole input, so its time grows with length — a
// 100k-character note in one call would take minutes and time out. Longer
// notes are split at paragraph breaks into sections this size, cleaned a few
// at a time, and joined back in order.
const SECTION_CHARS = 12_000;
const PARALLEL_SECTIONS = 4;

// Splits at blank lines (paragraphs); a single paragraph longer than a
// section is split at sentence ends, and as a last resort at a space.
export function splitIntoSections(text: string, maxChars = SECTION_CHARS): string[] {
  if (text.length <= maxChars) return [text];
  const pieces: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length <= maxChars) {
      pieces.push(paragraph);
      continue;
    }
    let rest = paragraph;
    while (rest.length > maxChars) {
      const window = rest.slice(0, maxChars);
      const sentenceEnd = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
      const cut = sentenceEnd > maxChars / 2 ? sentenceEnd + 1 : window.lastIndexOf(' ') > 0 ? window.lastIndexOf(' ') : maxChars;
      pieces.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) pieces.push(rest);
  }
  // Pack paragraphs back together up to the section size.
  const sections: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + 2 + piece.length > maxChars) {
      sections.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) sections.push(current);
  return sections;
}

export async function cleanNoteText(text: string): Promise<string> {
  const sections = splitIntoSections(text);
  if (sections.length === 1) return cleanSection(text);
  const cleaned: string[] = new Array(sections.length);
  for (let start = 0; start < sections.length; start += PARALLEL_SECTIONS) {
    const batch = sections.slice(start, start + PARALLEL_SECTIONS);
    const results = await Promise.all(batch.map(cleanSection));
    results.forEach((result, i) => (cleaned[start + i] = result));
  }
  return cleaned.join('\n\n');
}

async function cleanSection(text: string): Promise<string> {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    instructions: INSTRUCTIONS,
    input: [{ role: 'user', content: text }],
  });

  const cleaned = response.output_text?.trim();
  if (!cleaned) {
    throw new Error('OpenAI returned an empty cleanup result');
  }
  return cleaned;
}
