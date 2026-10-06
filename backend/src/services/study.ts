import { StudyRun, StudyRunDocument } from '../models/StudyRun';
import { StudySession } from '../models/StudySession';
import { ApiError } from '../utils/ApiError';
import { isDuplicateKeyError } from '../utils/mongoErrors';
import { awardPointsSafely } from './points';
import { POINTS, STUDY_BLOCK_MS, STUDY_MIN_LOGGED_MS } from '../constants/points';

const DAY_MS = 24 * 60 * 60 * 1000;

// Active time so far: what is banked, plus the current stretch if it is running.
export function activeMsAt(run: Pick<StudyRunDocument, 'activeMs' | 'status' | 'lastResumeAt'>, at: number): number {
  const stretch = run.status === 'running' && run.lastResumeAt ? Math.max(0, at - run.lastResumeAt.getTime()) : 0;
  return run.activeMs + stretch;
}

export function pointsForActiveMs(activeMs: number): number {
  return Math.floor(activeMs / STUDY_BLOCK_MS) * POINTS.studyPerBlock;
}

export interface StopResult {
  // False when the session was too short (under 10 minutes) to be logged.
  logged: boolean;
  minutes: number;
  points: number;
}

// The update only matches while the run is still in the state that was read
// (status and banked time both change on every pause/resume), so two requests
// racing (e.g. Stop twice) can't both finish it or both add points.
function sameStateFilter(run: StudyRunDocument) {
  return { _id: run._id, open: true, status: run.status, activeMs: run.activeMs };
}

async function finishRun(run: StudyRunDocument, endAt: number): Promise<StopResult> {
  const total = activeMsAt(run, endAt);
  const minutes = Math.floor(total / 60_000);

  if (total < STUDY_MIN_LOGGED_MS) {
    await StudyRun.deleteOne(sameStateFilter(run));
    return { logged: false, minutes, points: 0 };
  }

  const points = pointsForActiveMs(total);
  const won = await StudyRun.updateOne(sameStateFilter(run), {
    $set: { status: 'ended', endedAt: new Date(endAt), activeMs: total, points },
    $unset: { open: '', lastResumeAt: '' },
  });
  // Only the request that actually ended the run pays; the points record is
  // keyed by the run so it can't be paid twice anyway.
  if (won.modifiedCount === 1 && points > 0) {
    await awardPointsSafely(run.firebaseUid, `study:${run.id}`, 'study', points);
  }
  if (won.modifiedCount === 1) return { logged: true, minutes, points };
  // Another request ended it first (a repeated Stop): report that one's result.
  const ended = await StudyRun.findOne({ _id: run._id });
  return { logged: !!ended, minutes: ended ? Math.floor(ended.activeMs / 60_000) : minutes, points: ended?.points ?? 0 };
}

// The account's open run, after applying a scheduled auto-stop that has passed
// (it ends at the scheduled time, not whenever this was noticed).
export async function getOpenRun(firebaseUid: string, now: number = Date.now()): Promise<StudyRunDocument | null> {
  const run = await StudyRun.findOne({ firebaseUid, open: true });
  if (!run) return null;
  if (run.autoStopAt && run.autoStopAt.getTime() <= now) {
    await finishRun(run, Math.max(run.startedAt.getTime(), run.autoStopAt.getTime()));
    return null;
  }
  return run;
}

export async function startRun(firebaseUid: string, sessionId: string, autoStopAt: unknown): Promise<StudyRunDocument> {
  let session = null;
  try {
    session = await StudySession.findOne({ _id: sessionId, firebaseUid });
  } catch {
    session = null;
  }
  if (!session) throw new ApiError(404, 'Study session not found.', 'general');

  const now = Date.now();
  if (await getOpenRun(firebaseUid, now)) {
    throw new ApiError(409, 'You already have a study session running.', 'general');
  }

  // A scheduled session stops by itself at its end time. Ignored unless it is a
  // real time in the future and within a day, so it can't be used to stop a run early.
  const stopAt = typeof autoStopAt === 'string' ? Date.parse(autoStopAt) : NaN;
  const validStop = Number.isFinite(stopAt) && stopAt > now && stopAt <= now + DAY_MS ? new Date(stopAt) : undefined;

  try {
    return await StudyRun.create({
      firebaseUid,
      sessionId: session.id,
      sessionName: session.name,
      startedAt: new Date(now),
      activeMs: 0,
      lastResumeAt: new Date(now),
      status: 'running',
      open: true,
      autoStopAt: validStop,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ApiError(409, 'You already have a study session running.', 'general');
    throw err;
  }
}

export async function pauseRun(firebaseUid: string): Promise<StudyRunDocument | null> {
  const now = Date.now();
  const run = await getOpenRun(firebaseUid, now);
  if (!run || run.status !== 'running') return run;
  const updated = await StudyRun.findOneAndUpdate(
    sameStateFilter(run),
    { $set: { status: 'paused', activeMs: activeMsAt(run, now) }, $unset: { lastResumeAt: '' } },
    { new: true }
  );
  return updated ?? (await getOpenRun(firebaseUid, now));
}

export async function resumeRun(firebaseUid: string): Promise<StudyRunDocument | null> {
  const now = Date.now();
  const run = await getOpenRun(firebaseUid, now);
  if (!run || run.status !== 'paused') return run;
  const updated = await StudyRun.findOneAndUpdate(
    sameStateFilter(run),
    { $set: { status: 'running', lastResumeAt: new Date(now) } },
    { new: true }
  );
  return updated ?? (await getOpenRun(firebaseUid, now));
}

export async function stopRun(firebaseUid: string): Promise<StopResult | null> {
  const now = Date.now();
  const run = await getOpenRun(firebaseUid, now);
  if (!run) return null;
  return finishRun(run, now);
}

function mondayStartUtc(now: number): number {
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return midnight - ((d.getUTCDay() + 6) % 7) * DAY_MS;
}

// The app sends the start of ITS local week; accepted only if it is a real time
// within the last 8 days (anything else falls back to the UTC week).
export function resolveWeekStart(raw: unknown, now: number = Date.now()): number {
  const sent = typeof raw === 'string' ? Date.parse(raw) : NaN;
  if (Number.isFinite(sent) && sent <= now + DAY_MS && sent >= now - 8 * DAY_MS) return sent;
  return mondayStartUtc(now);
}

export interface StudyStats {
  allTimeMs: number;
  weekMs: number;
  sessionsThisWeek: number;
}

// Totals of finished sessions only (a session counts once it is stopped).
export async function studyStats(firebaseUid: string, weekStart: number): Promise<StudyStats> {
  const weekStartDate = new Date(weekStart);
  const rows = await StudyRun.aggregate<{ allTimeMs: number; weekMs: number; sessionsThisWeek: number }>([
    { $match: { firebaseUid, status: 'ended' } },
    {
      $group: {
        _id: null,
        allTimeMs: { $sum: '$activeMs' },
        weekMs: { $sum: { $cond: [{ $gte: ['$endedAt', weekStartDate] }, '$activeMs', 0] } },
        sessionsThisWeek: { $sum: { $cond: [{ $gte: ['$endedAt', weekStartDate] }, 1, 0] } },
      },
    },
  ]);
  return { allTimeMs: rows[0]?.allTimeMs ?? 0, weekMs: rows[0]?.weekMs ?? 0, sessionsThisWeek: rows[0]?.sessionsThisWeek ?? 0 };
}
