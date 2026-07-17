import { Response } from 'express';
import { Plan, PATH_TYPES, PathType } from '../models/Plan';
import { Settings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { deleteClassEvents, upsertClassEvents, SyncableClassItem } from '../services/googleCalendarSync';
import { generateExamTopics as generateExamTopicsService } from '../services/examTopics';

function assertValidPathType(pathType: string): asserts pathType is PathType {
  if (!(PATH_TYPES as readonly string[]).includes(pathType)) {
    throw new ApiError(400, `Invalid plan type: ${pathType}`, 'general');
  }
}

interface ClassRecord extends SyncableClassItem {
  id: string;
}

export async function getPlan(req: AuthedRequest, res: Response) {
  const { pathType } = req.params;
  assertValidPathType(pathType);

  const plan = await Plan.findOne({ firebaseUid: req.userId, pathType });
  res.json({ data: plan?.data ?? null });
}

export async function savePlan(req: AuthedRequest, res: Response) {
  const { pathType } = req.params;
  assertValidPathType(pathType);

  const { data } = req.body ?? {};
  if (data === undefined) {
    throw new ApiError(400, 'Missing plan data.', 'general');
  }

  if (pathType === 'student' && Array.isArray(data.classes)) {
    await syncClassesToGoogle(req.userId!, data.classes);
  }

  const plan = await Plan.findOneAndUpdate(
    { firebaseUid: req.userId, pathType },
    { data, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  res.json({ data: plan.data });
}

export async function generateExamTopicsHandler(req: AuthedRequest, res: Response) {
  const { name, subject, hoursPerWeek, weeksRemaining } = req.body ?? {};

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ApiError(400, 'Exam name is required.', 'general');
  }
  if (typeof weeksRemaining !== 'number' || weeksRemaining <= 0) {
    throw new ApiError(400, 'weeksRemaining must be a positive number.', 'general');
  }

  const topics = await generateExamTopicsService({
    name: name.trim(),
    subject: typeof subject === 'string' && subject.trim() ? subject.trim() : name.trim(),
    hoursPerWeek: typeof hoursPerWeek === 'number' && hoursPerWeek > 0 ? hoursPerWeek : 5,
    weeksRemaining,
  });

  res.json({ topics });
}

// Single choke point for Google-class-sync: all 3 frontend class call sites
// (classes.tsx, dashboard.tsx, student-plan.tsx) already funnel through this one
// savePlan endpoint, so no frontend changes are needed for Google sync at all.
async function syncClassesToGoogle(firebaseUid: string, newClasses: ClassRecord[]) {
  const settings = await Settings.findOne({ firebaseUid });
  if (!settings?.googleCalendarConnected) return;

  const existingPlan = await Plan.findOne({ firebaseUid, pathType: 'student' });
  const existingData = existingPlan?.data as { classes?: ClassRecord[] } | undefined;
  const oldClasses: ClassRecord[] = Array.isArray(existingData?.classes) ? existingData.classes : [];
  const oldById = new Map(oldClasses.map(c => [c.id, c]));
  const newById = new Map(newClasses.map(c => [c.id, c]));

  for (const old of oldClasses) {
    if (!newById.has(old.id)) {
      await deleteClassEvents(settings, old);
    }
  }

  for (const item of newClasses) {
    const old = oldById.get(item.id);
    const changed =
      !old ||
      old.courseName !== item.courseName ||
      old.startDate !== item.startDate ||
      old.recurring !== item.recurring ||
      old.freq !== item.freq ||
      old.time !== item.time ||
      JSON.stringify(old.dayIdxs) !== JSON.stringify(item.dayIdxs);

    if (!changed) {
      item.googleEventId = old.googleEventId;
      continue;
    }

    item.googleEventId = await upsertClassEvents(settings, { ...item, googleEventId: old?.googleEventId });
  }
}
