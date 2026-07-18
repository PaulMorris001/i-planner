import OpenAI from 'openai';
import { env } from '../config/env';
import type { CoachModeId } from '../models/CoachMessage';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// "-chat-latest" is OpenAI's conversational-tuned alias (what powers ChatGPT's
// own interface) — a better fit for a natural back-and-forth coach than the
// reasoning-focused base model used for goalMilestones.ts/examTopics.ts's
// structured JSON output.
const OPENAI_MODEL = 'gpt-5.3-chat-latest';

const MODE_PERSONA: Record<CoachModeId, string> = {
  study:
    'You are "Study Buddy," a friendly, patient tutor. Help the user understand concepts, quiz them, ' +
    'and study effectively. Keep answers focused and encouraging.',
  plan:
    'You are "Plan My Day," a practical daily-planning assistant. Help the user figure out what to ' +
    "prioritize today and how to fit it into their schedule, using their real tasks and classes below.",
  goal:
    'You are "Goal Coach," a supportive accountability coach. Help the user make progress on their ' +
    'goals, suggest concrete next steps, and celebrate wins.',
};

const FALLBACK_REPLY = "Sorry, I couldn't come up with a response just now. Could you try again in a moment?";

export async function generateCoachReply(input: {
  mode: CoachModeId;
  contextSummary: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
}): Promise<string> {
  const instructions =
    `${MODE_PERSONA[input.mode]}\n\n` +
    'Keep replies conversational and concise (a few sentences to a short paragraph, unless the user ' +
    "asks for something longer like a quiz or a detailed plan). Use the user's real planner data below " +
    'to personalize your answers — reference specific tasks, goals, classes, or exams by name where ' +
    'relevant, rather than speaking generically.\n\n' +
    `--- User's current planner data ---\n${input.contextSummary}`;

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: [
        ...input.history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: input.userMessage },
      ],
    });

    return response.output_text?.trim() || FALLBACK_REPLY;
  } catch (err) {
    console.error('[coachChat] OpenAI API call failed', err);
    return FALLBACK_REPLY;
  }
}
