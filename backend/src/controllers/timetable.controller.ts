import { Response } from 'express';
import { Subscription, SubscriptionTier } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { extractTimetable } from '../services/timetableExtraction';
import { mimeTypeForFilename } from '../services/aiFileInput';
import { FEATURE_MIN_TIER, hasTier } from '../constants/featureTiers';
import { hasQueryRemaining, consumeQuery } from '../services/aiUsageLimiter';

// Stateless preview, same as extractSyllabusHandler — nothing persisted here.
// The frontend reviews/edits every extracted row, then bulk-creates the real
// ClassItems itself (via useClassActions().saveClasses, so Apple Calendar
// sync and reminders apply normally). Unlike syllabus, there's no
// free-allowance branch and no follow-up "create" endpoint — a timetable is
// realistically uploaded once per term (not once per class), so there's no
// per-upload record worth persisting; the resulting ClassItems are already
// the durable record.
export async function extractTimetableHandler(req: AuthedRequest, res: Response) {
  const { fileBase64, filename } = req.body ?? {};
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    throw new ApiError(400, 'A file is required.', 'general');
  }
  if (!filename || typeof filename !== 'string') {
    throw new ApiError(400, 'A file is required.', 'general');
  }
  const mimeType = mimeTypeForFilename(filename);
  if (!mimeType) {
    throw new ApiError(400, 'Upload a PDF, Word/PowerPoint document, or a photo (JPG/PNG).', 'general');
  }

  const subscription = await Subscription.findOne({ firebaseUid: req.userId });
  const tier: SubscriptionTier = subscription?.tier ?? 'free';
  if (!hasTier(tier, FEATURE_MIN_TIER.timetable_extraction)) {
    throw new ApiError(403, `Timetable AI extraction requires a ${FEATURE_MIN_TIER.timetable_extraction} subscription.`, 'tier');
  }
  const usage = await hasQueryRemaining(req.userId!, tier);
  if (!usage.allowed) {
    const period = usage.period === 'week' ? 'week' : 'month';
    const resetLabel = usage.resetsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    throw new ApiError(429, `You've used all ${usage.cap} AI actions for this ${period}. It resets ${resetLabel}.`, 'general');
  }

  let result;
  try {
    result = await extractTimetable({ fileBase64, filename, mimeType });
  } catch (err) {
    console.error('[timetable.controller] extraction failed', err);
    throw new ApiError(
      502,
      "Couldn't read that timetable. Try a clearer file, or add each class manually.",
      'general'
    );
  }

  // Only now — extraction actually produced content — does this count against
  // the user's metered quota. Same reasoning as syllabus's handler: outside
  // the try above and in its own try/catch, so a transient failure recording
  // usage can never turn an already-successful extraction into an error.
  try {
    await consumeQuery(req.userId!, tier);
  } catch (err) {
    console.error('[timetable.controller] failed to record AI usage after successful extraction', err);
  }

  res.json(result);
}
