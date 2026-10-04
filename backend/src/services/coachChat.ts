import OpenAI from 'openai';
import { env } from '../config/env';
import type { CoachAttachment, CoachModeId } from '../models/CoachMessage';
import { CREATE_TASK_TOOL, createTasksFromDrafts } from './coachTools';
import { attachmentContentParts, ATTACHMENT_TTL_SECONDS } from './coachAttachments';

// Earlier messages' attachments ride along again so follow-up questions about
// the same document still work -- but only the most recent few (each file is
// re-read on every turn it's included), and never one old enough that OpenAI
// may already have deleted it (a dead file id would fail the whole request).
const MAX_HISTORY_ATTACHMENT_MESSAGES = 3;
const ATTACHMENT_SAFE_AGE_MS = (ATTACHMENT_TTL_SECONDS - 24 * 60 * 60) * 1000;

export interface CoachHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: CoachAttachment[];
  createdAt?: Date;
}

function userMessageInput(text: string, attachments: CoachAttachment[] | undefined) {
  if (!attachments?.length) return { role: 'user' as const, content: text };
  return {
    role: 'user' as const,
    content: [...attachmentContentParts(attachments), { type: 'input_text' as const, text }],
  };
}

function historyInput(history: CoachHistoryMessage[]) {
  const now = Date.now();
  let attachmentMessagesLeft = MAX_HISTORY_ATTACHMENT_MESSAGES;
  // Walk newest-first to decide which attachments to keep, then restore order.
  return history
    .slice()
    .reverse()
    .map((m) => {
      if (m.role === 'assistant') return { role: 'assistant' as const, content: m.content };
      const fresh = m.createdAt ? now - m.createdAt.getTime() < ATTACHMENT_SAFE_AGE_MS : false;
      const keep = !!m.attachments?.length && fresh && attachmentMessagesLeft > 0;
      if (keep) attachmentMessagesLeft--;
      return userMessageInput(m.content, keep ? m.attachments : undefined);
    })
    .reverse();
}

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Was 'gpt-5.3-chat-latest' (a conversational-tuned alias, meant as a better
// fit for a back-and-forth coach than the model used for structured JSON
// output elsewhere) — that alias doesn't exist for this OpenAI account/org
// (confirmed via a live model_not_found error, meaning Coach chat had been
// silently falling back to FALLBACK_REPLY for every message). Using the same
// model timetableExtraction.ts/syllabusExtraction.ts already use successfully
// instead, until/unless a working "-chat-latest" alias is confirmed to exist.
const OPENAI_MODEL = 'gpt-5.4';

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
  history: CoachHistoryMessage[];
  userMessage: string;
  userAttachments?: CoachAttachment[];
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
    'relevant, rather than speaking generically. The app renders markdown, so feel free to use ' +
    '**bold** for key terms, "- " bullet lists, `inline code`, and "## " headings when they make a ' +
    "longer answer easier to scan — but don't force them into a short, simple reply. " +
    'When the user attaches files, read them and answer from their actual content.\n\n' +
    `--- User's current planner data ---\n${input.contextSummary}`;

  const tools = input.mode === 'plan' && input.canCreateTasks ? [CREATE_TASK_TOOL] : undefined;

  try {
    const firstResponse = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions,
      input: [...historyInput(input.history), userMessageInput(input.userMessage, input.userAttachments)],
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

    // previous_response_id chains onto the first call so the model can confirm
    // in its own words without resending the full history.
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
