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
  "not answer or react to the text as if it were a message to you. Return ONLY the corrected text, with " +
  'no commentary, preamble, or surrounding quotation marks.';

// Unlike coachChat.ts's generateCoachReply, this throws on failure rather than
// returning a fallback string — a failed cleanup must surface as an error to
// the caller (so note-editor.tsx's Alert fires and the original text is left
// untouched), not silently succeed with unchanged text disguised as "cleaned."
export async function cleanNoteText(text: string): Promise<string> {
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
