import { Response } from 'express';
import { CoachMessage, COACH_MODES, CoachModeId, toPublicCoachMessage } from '../models/CoachMessage';
import { Settings } from '../models/Settings';
import { Subscription } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { buildContextSummary } from '../services/coachContext';
import { generateCoachReply } from '../services/coachChat';
import { checkAndConsumeQuery } from '../services/aiUsageLimiter';
import { FEATURE_MIN_TIER, hasTier } from '../constants/featureTiers';
import { parseIncomingAttachments, storeCoachAttachment } from '../services/coachAttachments';
import { sendPushToUser, REMINDERS_CHANNEL_ID } from '../services/pushNotifications';

// Short plain-text preview of a reply for a notification -- markdown symbols
// would show up literally there.
function replyPreview(text: string): string {
  const plain = text.replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 120 ? `${plain.slice(0, 119)}…` : plain;
}

// Stored as the message text when the user sends files with no message.
const ATTACHMENT_ONLY_PROMPT = 'Please take a look at the attached file.';

// How many past messages ride along as conversation history on each request —
// caps token growth for a long-running chat rather than sending the full history.
const HISTORY_LIMIT = 20;

const MODE_LABEL: Record<CoachModeId, string> = {
  study: 'Study Buddy',
  plan: 'Plan My Day',
  goal: 'Goal Coach',
};

function assertValidMode(mode: string): asserts mode is CoachModeId {
  if (!(COACH_MODES as readonly string[]).includes(mode)) {
    throw new ApiError(400, `Invalid coach mode: ${mode}`, 'general');
  }
}

export async function listCoachMessages(req: AuthedRequest, res: Response) {
  const { mode } = req.params;
  assertValidMode(mode);

  const messages = await CoachMessage.find({ firebaseUid: req.userId, mode }).sort({ createdAt: 1 });
  res.json(messages.map(toPublicCoachMessage));
}

export async function sendCoachMessage(req: AuthedRequest, res: Response) {
  const { mode } = req.params;
  assertValidMode(mode);

  const { content } = req.body ?? {};
  // Validated before anything is consumed or uploaded.
  const incomingAttachments = parseIncomingAttachments(req.body?.attachments);
  const typed = typeof content === 'string' ? content.trim() : '';
  if (!typed && !incomingAttachments.length) {
    throw new ApiError(400, 'Message content is required.', 'general');
  }
  const trimmed = typed || ATTACHMENT_ONLY_PROMPT;

  const [settings, subscription] = await Promise.all([
    Settings.findOne({ firebaseUid: req.userId }),
    Subscription.findOne({ firebaseUid: req.userId }),
  ]);

  const tier = subscription?.tier ?? 'free';
  const requiredTier = FEATURE_MIN_TIER[`coach_${mode}`];
  if (!hasTier(tier, requiredTier)) {
    throw new ApiError(403, `${MODE_LABEL[mode]} requires a ${requiredTier} subscription.`, 'tier');
  }

  // Server-side backstop for the client's AiDisclosureGate — App Store guideline
  // 5.1.2(i) requires consent before any personal data reaches OpenAI, so this
  // can't be enforced client-side only.
  if (!settings?.aiDisclosureAcknowledged) {
    throw new ApiError(403, 'AI data-sharing disclosure has not been acknowledged yet.', 'general');
  }

  const usage = await checkAndConsumeQuery(req.userId!, tier);
  if (!usage.allowed) {
    const period = usage.period === 'week' ? 'week' : 'month';
    const resetLabel = usage.resetsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    throw new ApiError(
      429,
      `You've used all ${usage.cap} AI Coach messages for this ${period}. It resets ${resetLabel}.`,
      'general'
    );
  }

  const recentDocs = await CoachMessage.find({ firebaseUid: req.userId, mode })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT);
  const history = recentDocs
    .reverse()
    .map((m) => ({ role: m.role, content: m.content, attachments: m.attachments, createdAt: m.createdAt }));

  let attachments;
  try {
    attachments = await Promise.all(incomingAttachments.map(storeCoachAttachment));
  } catch (err) {
    console.error('[coach] failed to store attachment', err);
    throw new ApiError(502, "Couldn't read the attached file. Try again, or attach a different file.", 'general');
  }

  await CoachMessage.create({
    firebaseUid: req.userId,
    mode,
    role: 'user',
    content: trimmed,
    attachments: attachments.length ? attachments : undefined,
  });

  const consent = {
    tasks: settings?.aiAccessTasks ?? true,
    goals: settings?.aiAccessGoals ?? true,
    calendar: settings?.aiAccessCalendar ?? true,
  };
  const contextSummary = await buildContextSummary(req.userId!, consent);
  const { text: replyText, createdTaskIds } = await generateCoachReply({
    mode,
    contextSummary,
    history,
    userMessage: trimmed,
    userAttachments: attachments,
    firebaseUid: req.userId!,
    canCreateTasks: consent.tasks,
  });

  const assistantDoc = await CoachMessage.create({
    firebaseUid: req.userId,
    mode,
    role: 'assistant',
    content: replyText,
  });

  res.status(201).json({ ...toPublicCoachMessage(assistantDoc), createdTaskIds });

  // "Your reply is ready" for someone who switched away while it was being
  // written. Sent every time; the app hides it when it's already open (see
  // its notification handler), so only backgrounded users actually see it.
  void sendPushToUser(
    req.userId!,
    { title: `${MODE_LABEL[mode]} replied`, body: replyPreview(replyText), route: '/coach' },
    { kind: 'ai-reply', channelId: REMINDERS_CHANNEL_ID }
  );
}
