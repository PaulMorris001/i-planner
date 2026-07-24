import { Response } from 'express';
import { CoachMessage, COACH_MODES, CoachModeId, toPublicCoachMessage } from '../models/CoachMessage';
import { Settings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { buildContextSummary } from '../services/coachContext';
import { generateCoachReply } from '../services/coachChat';

// How many past messages ride along as conversation history on each request —
// caps token growth for a long-running chat rather than sending the full history.
const HISTORY_LIMIT = 20;

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

  const recentDocs = await CoachMessage.find({ firebaseUid: req.userId, mode })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT);
  const history = recentDocs.reverse().map((m) => ({ role: m.role, content: m.content }));

  await CoachMessage.create({ firebaseUid: req.userId, mode, role: 'user', content: trimmed });

  const settings = await Settings.findOne({ firebaseUid: req.userId });
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
  });

  const assistantDoc = await CoachMessage.create({
    firebaseUid: req.userId,
    mode,
    role: 'assistant',
    content: replyText,
  });

  res.status(201).json({ ...toPublicCoachMessage(assistantDoc), createdTaskIds });
}
