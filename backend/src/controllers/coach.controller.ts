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
  if (!content || typeof content !== 'string' || !content.trim()) {
    throw new ApiError(400, 'Message content is required.', 'general');
  }
  const trimmed = content.trim();

  const [settings, subscription] = await Promise.all([
    Settings.findOne({ firebaseUid: req.userId }),
    Subscription.findOne({ firebaseUid: req.userId }),
  ]);

  const tier = subscription?.tier ?? 'free';
  const requiredTier = FEATURE_MIN_TIER[`coach_${mode}`];
  if (!hasTier(tier, requiredTier)) {
    throw new ApiError(403, `${MODE_LABEL[mode]} requires a ${requiredTier} subscription.`, 'tier');
  }

  // Server-side backstop for the AiDisclosureGate shown in app/(app)/coach.tsx —
  // App Store guideline 5.1.2(i) requires permission *before* any personal data
  // reaches OpenAI, so this must be enforced here too, not just by the client
  // hiding the chat UI until the gate is acknowledged.
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
  const history = recentDocs.reverse().map((m) => ({ role: m.role, content: m.content }));

  await CoachMessage.create({ firebaseUid: req.userId, mode, role: 'user', content: trimmed });

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
}
