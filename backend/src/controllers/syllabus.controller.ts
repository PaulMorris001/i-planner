import { Response } from 'express';
import { Syllabus, toPublicSyllabus } from '../models/Syllabus';
import { Subscription, SubscriptionTier } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { extractSyllabus, mimeTypeForFilename } from '../services/syllabusExtraction';
import { FEATURE_MIN_TIER, hasTier } from '../constants/featureTiers';
import { hasQueryRemaining, consumeQuery } from '../services/aiUsageLimiter';
import { findOwnedOrThrow } from '../utils/ownedDoc';

// First N syllabi are free regardless of tier — see extractSyllabusHandler.
const FREE_SYLLABUS_COUNT = 2;

export async function listSyllabi(req: AuthedRequest, res: Response) {
  const syllabi = await Syllabus.find({ firebaseUid: req.userId }).sort({ createdAt: -1 });
  res.json(syllabi.map(toPublicSyllabus));
}

// Stateless preview — nothing persisted. Frontend reviews/edits, then creates the
// real Class/Tasks itself (so calendar sync and reminders apply normally) and
// calls createSyllabus below.
export async function extractSyllabusHandler(req: AuthedRequest, res: Response) {
  const { fileBase64, filename } = req.body ?? {};
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    throw new ApiError(400, 'A file is required.', 'general');
  }
  // filename isn't just a display label here — mimeTypeForFilename derives the
  // actual MIME type from it, which decides how the file bytes get sent to
  // OpenAI (input_file vs input_image). A missing filename used to silently
  // default to "syllabus.pdf" back when the MIME type was hardcoded to PDF
  // regardless; now that would mislabel whatever was actually uploaded, so a
  // real filename is required instead.
  if (!filename || typeof filename !== 'string') {
    throw new ApiError(400, 'A file is required.', 'general');
  }
  const mimeType = mimeTypeForFilename(filename);
  if (!mimeType) {
    throw new ApiError(400, 'Upload a PDF, Word/PowerPoint document, or a photo (JPG/PNG).', 'general');
  }

  // First two syllabi are free (onboarding shares this endpoint with the in-app
  // upload modal); gated from the third onward — same as generateExamTopicsHandler.
  const existingSyllabusCount = await Syllabus.countDocuments({ firebaseUid: req.userId });
  const withinFreeAllowance = existingSyllabusCount < FREE_SYLLABUS_COUNT;

  let tier: SubscriptionTier = 'free';
  // Only set when this request actually needs to spend a metered AI query —
  // i.e. past the free allowance. Checked (not consumed) before the extract
  // call below, and only actually consumed after that call succeeds, so a
  // failed/unreadable upload never costs the user a query for nothing.
  let shouldConsumeUsage = false;

  if (!withinFreeAllowance) {
    const subscription = await Subscription.findOne({ firebaseUid: req.userId });
    tier = subscription?.tier ?? 'free';
    if (!hasTier(tier, FEATURE_MIN_TIER.syllabus_extraction)) {
      throw new ApiError(403, `Syllabus AI extraction requires a ${FEATURE_MIN_TIER.syllabus_extraction} subscription.`, 'tier');
    }
    const usage = await hasQueryRemaining(req.userId!, tier);
    if (!usage.allowed) {
      const period = usage.period === 'week' ? 'week' : 'month';
      const resetLabel = usage.resetsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      throw new ApiError(429, `You've used all ${usage.cap} AI actions for this ${period}. It resets ${resetLabel}.`, 'general');
    }
    shouldConsumeUsage = true;
  }

  let result;
  try {
    result = await extractSyllabus({ fileBase64, filename, mimeType });
  } catch (err) {
    console.error('[syllabus.controller] extraction failed', err);
    throw new ApiError(
      502,
      "Couldn't read that syllabus. Try a clearer file, or add the class and deadlines manually.",
      'general'
    );
  }

  // Only now — extraction actually produced content — does this count against
  // the user's metered quota. Deliberately outside the try above (and its own
  // try/catch here) so a transient failure recording usage can never turn an
  // already-successful extraction into a false "couldn't read" error for the
  // user; worst case here is one query going uncounted, not a wrongly-lost result.
  if (shouldConsumeUsage) {
    try {
      await consumeQuery(req.userId!, tier);
    } catch (err) {
      console.error('[syllabus.controller] failed to record AI usage after successful extraction', err);
    }
  }

  res.json(result);
}

export async function createSyllabus(req: AuthedRequest, res: Response) {
  const { fileName, courseName, classId } = req.body ?? {};
  if (!fileName || typeof fileName !== 'string') {
    throw new ApiError(400, 'fileName is required.', 'general');
  }
  if (!courseName || typeof courseName !== 'string') {
    throw new ApiError(400, 'courseName is required.', 'general');
  }

  const syllabus = await Syllabus.create({
    firebaseUid: req.userId,
    fileName,
    courseName,
    classId: classId || undefined,
  });

  res.status(201).json(toPublicSyllabus(syllabus));
}

export async function updateSyllabus(req: AuthedRequest, res: Response) {
  const syllabus = await findOwnedOrThrow(Syllabus, req.params.id, req.userId!);

  const { courseName } = req.body ?? {};
  if (courseName !== undefined) {
    if (!courseName || typeof courseName !== 'string' || !courseName.trim()) {
      throw new ApiError(400, 'Course name is required.', 'general');
    }
    syllabus.courseName = courseName.trim();
  }

  await syllabus.save();
  res.json(toPublicSyllabus(syllabus));
}

export async function deleteSyllabus(req: AuthedRequest, res: Response) {
  const syllabus = await findOwnedOrThrow(Syllabus, req.params.id, req.userId!);
  await syllabus.deleteOne();
  res.status(204).send();
}
