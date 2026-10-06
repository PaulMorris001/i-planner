import { Response } from 'express';
import { StudySession, toPublicStudySession } from '../models/StudySession';
import { toPublicStudyRun } from '../models/StudyRun';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { findOwnedOrThrow } from '../utils/ownedDoc';
import { getOpenRun, pauseRun, resolveWeekStart, resumeRun, startRun, stopRun, studyStats } from '../services/study';

const MAX_SESSIONS = 50;

function parseSessionBody(body: Record<string, unknown>, partial: boolean) {
  const out: { name?: string; days?: number[]; startMinute?: number | null; endMinute?: number | null } = {};

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== 'string' || !body.name.trim()) throw new ApiError(400, 'Give the study session a name.', 'general');
    out.name = body.name.trim().slice(0, 80);
  }
  if (body.days !== undefined) {
    if (!Array.isArray(body.days) || body.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
      throw new ApiError(400, 'Days must be weekday numbers.', 'general');
    }
    out.days = [...new Set(body.days as number[])].sort((a, b) => a - b);
  }
  if (body.startMinute !== undefined || body.endMinute !== undefined) {
    const { startMinute, endMinute } = body;
    if (startMinute === null && endMinute === null) {
      out.startMinute = null;
      out.endMinute = null;
    } else {
      const ok = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1439;
      if (!ok(startMinute) || !ok(endMinute)) throw new ApiError(400, 'Set both a start and an end time.', 'general');
      if (endMinute <= startMinute) throw new ApiError(400, 'The end time must be after the start time.', 'general');
      out.startMinute = startMinute;
      out.endMinute = endMinute;
    }
  }
  return out;
}

// Everything the Study screen needs in one request.
export async function getStudyState(req: AuthedRequest, res: Response) {
  const now = Date.now();
  const [sessions, current, stats] = await Promise.all([
    StudySession.find({ firebaseUid: req.userId }).sort({ _id: 1 }),
    getOpenRun(req.userId!, now),
    studyStats(req.userId!, resolveWeekStart(req.query.weekStart, now)),
  ]);
  res.json({
    sessions: sessions.map(toPublicStudySession),
    current: current ? toPublicStudyRun(current) : null,
    stats,
    serverNow: new Date(now).toISOString(),
  });
}

// Just the totals, for the Profile card.
export async function getStudyStats(req: AuthedRequest, res: Response) {
  res.json(await studyStats(req.userId!, resolveWeekStart(req.query.weekStart)));
}

export async function createStudySession(req: AuthedRequest, res: Response) {
  if ((await StudySession.countDocuments({ firebaseUid: req.userId })) >= MAX_SESSIONS) {
    throw new ApiError(400, `You can have up to ${MAX_SESSIONS} study sessions.`, 'general');
  }
  const parsed = parseSessionBody(req.body ?? {}, false);
  const session = await StudySession.create({
    firebaseUid: req.userId,
    name: parsed.name,
    days: parsed.days ?? [],
    startMinute: parsed.startMinute ?? undefined,
    endMinute: parsed.endMinute ?? undefined,
  });
  res.status(201).json(toPublicStudySession(session));
}

export async function updateStudySession(req: AuthedRequest, res: Response) {
  const session = await findOwnedOrThrow(StudySession, req.params.id, req.userId!);
  const parsed = parseSessionBody(req.body ?? {}, true);
  if (parsed.name !== undefined) session.name = parsed.name;
  if (parsed.days !== undefined) session.days = parsed.days;
  if (parsed.startMinute !== undefined) {
    session.startMinute = parsed.startMinute ?? undefined;
    session.endMinute = parsed.endMinute ?? undefined;
  }
  const { notificationIds } = req.body ?? {};
  if (notificationIds !== undefined) {
    session.notificationIds = Array.isArray(notificationIds) ? notificationIds.filter((i) => typeof i === 'string') : undefined;
  }
  await session.save();
  res.json(toPublicStudySession(session));
}

export async function deleteStudySession(req: AuthedRequest, res: Response) {
  const session = await findOwnedOrThrow(StudySession, req.params.id, req.userId!);
  await session.deleteOne();
  res.status(204).send();
}

function runResponse(run: Awaited<ReturnType<typeof getOpenRun>>, extra: Record<string, unknown> = {}) {
  return { current: run ? toPublicStudyRun(run) : null, serverNow: new Date().toISOString(), ...extra };
}

export async function startStudy(req: AuthedRequest, res: Response) {
  const run = await startRun(req.userId!, req.params.id, req.body?.autoStopAt);
  res.status(201).json(runResponse(run));
}

export async function pauseStudy(req: AuthedRequest, res: Response) {
  res.json(runResponse(await pauseRun(req.userId!)));
}

export async function resumeStudy(req: AuthedRequest, res: Response) {
  res.json(runResponse(await resumeRun(req.userId!)));
}

export async function stopStudy(req: AuthedRequest, res: Response) {
  const result = await stopRun(req.userId!);
  res.json(runResponse(null, { result }));
}
