import { Response } from 'express';
import { Syllabus, toPublicSyllabus } from '../models/Syllabus';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { extractSyllabus } from '../services/syllabusExtraction';

export async function listSyllabi(req: AuthedRequest, res: Response) {
  const syllabi = await Syllabus.find({ firebaseUid: req.userId }).sort({ createdAt: -1 });
  res.json(syllabi.map(toPublicSyllabus));
}

// Stateless preview — extraction only, nothing persisted yet. The frontend
// reviews/edits the result and, on confirm, creates the real Class/Tasks
// itself (via usePlan()/useTasks(), so calendar sync and reminders apply the
// same as any manually-created class/task) then calls createSyllabus below.
export async function extractSyllabusHandler(req: AuthedRequest, res: Response) {
  const { fileBase64, filename } = req.body ?? {};
  if (!fileBase64 || typeof fileBase64 !== 'string') {
    throw new ApiError(400, 'A PDF file is required.', 'general');
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
