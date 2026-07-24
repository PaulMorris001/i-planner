import OpenAI from 'openai';
import { env } from '../config/env';
import type { CoachModeId } from '../models/CoachMessage';
import { CREATE_TASK_TOOL, createTasksFromDrafts } from './coachTools';

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
    "prioritize today and how to fit it into their schedule, using their real tasks and classes below. " +
    'When the user asks you to add, create, remind them about, or schedule something, actually call the ' +
    'create_task tool instead of just describing what you would add — then confirm what was created.',
  goal:
    'You are "Goal Coach," a supportive accountability coach. Help the user make progress on their ' +
    'goals, suggest concrete next steps, and celebrate wins.',
};

const FALLBACK_REPLY = "Sorry, I couldn't come up with a response just now. Could you try again in a moment?";

export interface CoachReplyResult {
  text: string;
  createdTaskIds: string[];
}

export async function generateCoachReply(input: {
  mode: CoachModeId;
  contextSummary: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  userMessage: string;
  firebaseUid: string;
  canCreateTasks: boolean;
}): Promise<CoachReplyResult> {
  const today = new Date().toISOString().slice(0, 10);
  const instructions =
    `${MODE_PERSONA[input.mode]}\n\n` +
    `Today's date is ${today}. ` +
    'Keep replies conversational and concise (a few sentences to a short paragraph, unless the user ' +
    "asks for something longer like a quiz or a detailed plan). Use the user's real planner data below " +
    'to personalize your answers — reference specific tasks, goals, classes, or exams by name where ' +
    'relevant, rather than speaking generically.\n\n' +
    `--- User's current planner data ---\n${input.contextSummary}`;

  // Only "Plan My Day" can create tasks — the one mode actually about
  // scheduling, so a casual Study Buddy/Goal Coach chat never accidentally
  // triggers task creation. Also respects the user's "Tasks & deadlines" AI
  // Data Access toggle — if they've told the coach not to touch task data, it
  // shouldn't be able to create tasks either, not just read them.
  const tools = input.mode === 'plan' && input.canCreateTasks ? [CREATE_TASK_TOOL] : undefined;

  try {
    const firstResponse = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: [
        ...input.history.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: input.userMessage },
      ],
      tools,
    });

    const functionCall = firstResponse.output.find((item) => item.type === 'function_call') as
      | OpenAI.Responses.ResponseFunctionToolCall
      | undefined;

    if (!functionCall) {
      return { text: firstResponse.output_text?.trim() || FALLBACK_REPLY, createdTaskIds: [] };
    }

    const { createdTaskIds, toolResultText } = await createTasksFromDrafts(
      input.firebaseUid,
      functionCall.arguments
    );

    // Feed the tool's result back so the model can confirm in its own words —
    // previous_response_id chains onto the first call rather than resending
    // the full conversation history a second time.
    const secondResponse = await openai.responses.create({
      model: OPENAI_MODEL,
      previous_response_id: firstResponse.id,
      input: [
        { type: 'function_call_output', call_id: functionCall.call_id, output: toolResultText },
      ],
    });

    return { text: secondResponse.output_text?.trim() || FALLBACK_REPLY, createdTaskIds };
  } catch (err) {
    console.error('[coachChat] OpenAI API call failed', err);
    return { text: FALLBACK_REPLY, createdTaskIds: [] };
  }
}
