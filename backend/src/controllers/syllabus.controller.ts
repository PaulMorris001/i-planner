import { Response } from 'express';
import { Syllabus, toPublicSyllabus } from '../models/Syllabus';
import { Subscription } from '../models/Subscription';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { extractSyllabus } from '../services/syllabusExtraction';
import { FEATURE_MIN_TIER, hasTier } from '../constants/featureTiers';
import { checkAndConsumeQuery } from '../services/aiUsageLimiter';
import { findOwnedOrThrow } from '../utils/ownedDoc';

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
    throw new ApiError(400, 'A PDF file is required.', 'general');
  }

  // First-ever syllabus is free (onboarding shares this endpoint with the in-app
  // upload modal); gated from the second onward — same as generateExamTopicsHandler.
  const existingSyllabus = await Syllabus.findOne({ firebaseUid: req.userId });
  if (existingSyllabus) {
    const subscription = await Subscription.findOne({ firebaseUid: req.userId });
    const tier = subscription?.tier ?? 'free';
    if (!hasTier(tier, FEATURE_MIN_TIER.syllabus_extraction)) {
      throw new ApiError(403, `Syllabus AI extraction requires a ${FEATURE_MIN_TIER.syllabus_extraction} subscription.`, 'tier');
    }
    const usage = await checkAndConsumeQuery(req.userId!, tier);
    if (!usage.allowed) {
      const period = usage.period === 'week' ? 'week' : 'month';
      const resetLabel = usage.resetsAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      throw new ApiError(429, `You've used all ${usage.cap} AI actions for this ${period}. It resets ${resetLabel}.`, 'general');
    }
  }

  try {
    const result = await extractSyllabus({ fileBase64, filename: filename || 'syllabus.pdf' });
    res.json(result);
  } catch (err) {
    console.error('[syllabus.controller] extraction failed', err);
    throw new ApiError(
      502,
      "Couldn't read that syllabus. Try a clearer file, or add the class and deadlines manually.",
      'general'
    );
  }
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
