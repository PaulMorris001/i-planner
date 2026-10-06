import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useReferral } from '@/hooks/useReferral';
import { useSettings } from '@/hooks/useSettings';
import { studyService } from '@/services/study.service';
import { cancelNotifications, scheduleStudySessionNotifications } from '@/utils/notifications';
import { cancelStillStudyingNudge, hasStillStudyingNudge, scheduleStillStudyingNudge } from '@/utils/studyNudge';
import { localWeekStartIso, todaysAutoStop } from '@/utils/studyFormat';
import type {
  NewStudySessionInput,
  StudyRun,
  StudySession,
  StudyState,
  StudyStats,
  StudyStopResult,
} from '@/types/study.types';

const EMPTY_STATS: StudyStats = { allTimeMs: 0, weekMs: 0, sessionsThisWeek: 0 };

// The "still studying?" reminder exists only while a timer with no scheduled end is
// running. `restart` re-arms it from now (just started or resumed); otherwise an
// already-armed one is left alone and a missing one is created (app reopened mid-run).
function syncNudge(run: StudyRun | null, remindersEnabled: boolean, restart = false): void {
  const wanted = !!run && run.status === 'running' && !run.autoStopAt && remindersEnabled;
  if (!wanted) {
    cancelStillStudyingNudge().catch(() => {});
    return;
  }
  if (restart) {
    scheduleStillStudyingNudge().catch(() => {});
    return;
  }
  hasStillStudyingNudge()
    .then((armed) => (armed ? undefined : scheduleStillStudyingNudge()))
    .catch(() => {});
}

// State and actions for the Study screen: the person's reusable study sessions, the
// run in progress (if any) with a live ticking timer, and the all-time / this-week
// totals. The server keeps the time (so it can't be faked); this only mirrors it.
export function useStudy() {
  const { remindersEnabled } = useSettings();
  const { refresh: refreshPoints } = useReferral();

  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [current, setCurrent] = useState<StudyRun | null>(null);
  const [stats, setStats] = useState<StudyStats>(EMPTY_STATS);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // serverNow minus the phone clock, as of the last response.
  const [offsetMs, setOffsetMs] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const applyServerTime = (serverNow: string) => {
    const parsed = Date.parse(serverNow);
    if (Number.isFinite(parsed)) setOffsetMs(parsed - Date.now());
    setNowMs(Date.now());
  };

  const load = useCallback(async () => {
    try {
      const state: StudyState = await studyService.state(localWeekStartIso());
      applyServerTime(state.serverNow);
      setSessions(state.sessions);
      setCurrent(state.current);
      setStats(state.stats);
      setFailed(false);
      syncNudge(state.current, remindersEnabled);
    } catch (err) {
      console.error('[useStudy] failed to load', err);
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, [remindersEnabled]);

  useEffect(() => {
    load();
    // A session can end while the app is in the background (a scheduled auto-stop).
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  // Ticks once a second, but only while a run is actually counting.
  const running = current?.status === 'running';
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Active milliseconds of the current run, right now.
  let elapsedMs = 0;
  if (current) {
    elapsedMs = current.activeMs;
    if (current.status === 'running' && current.lastResumeAt) {
      elapsedMs += Math.max(0, nowMs + offsetMs - Date.parse(current.lastResumeAt));
    }
  }

  // The scheduled stop time passed while the screen was open: reload to pick up the result.
  useEffect(() => {
    if (!current?.autoStopAt) return;
    const wait = Date.parse(current.autoStopAt) - (Date.now() + offsetMs);
    const id = setTimeout(() => load(), Math.max(1000, wait + 1500));
    return () => clearTimeout(id);
  }, [current?.autoStopAt, offsetMs, load]);

  const run = async <T,>(action: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await action();
    } finally {
      setBusy(false);
    }
  };

  const applyRun = (response: { current: StudyRun | null; serverNow: string }) => {
    applyServerTime(response.serverNow);
    setCurrent(response.current);
  };

  const start = (session: StudySession) =>
    run(async () => {
      const response = await studyService.start(session.id, todaysAutoStop(session));
      applyRun(response);
      syncNudge(response.current, remindersEnabled, true);
    });

  const pause = () =>
    run(async () => {
      const response = await studyService.pause();
      applyRun(response);
      syncNudge(response.current, remindersEnabled);
    });

  const resume = () =>
    run(async () => {
      const response = await studyService.resume();
      applyRun(response);
      syncNudge(response.current, remindersEnabled, true);
    });

  const stop = (): Promise<StudyStopResult | null> =>
    run(async () => {
      const response = await studyService.stop();
      applyRun(response);
      syncNudge(null, remindersEnabled);
      await load();
      // Points were just added on the server; update the flame badge.
      refreshPoints().catch(() => {});
      return response.result ?? null;
    });

  // Reminders go with the session: scheduled on this device, ids stored on the server.
  const scheduleReminders = async (session: StudySession): Promise<string[]> => {
    await cancelNotifications(session.notificationIds);
    return remindersEnabled ? scheduleStudySessionNotifications(session) : [];
  };

  const createSession = (input: NewStudySessionInput) =>
    run(async () => {
      const created = await studyService.createSession(input);
      const ids = await scheduleReminders(created);
      const withIds = ids.length ? await studyService.updateSession(created.id, { notificationIds: ids }) : created;
      setSessions((prev) => [...prev, withIds]);
    });

  const updateSession = (id: string, input: NewStudySessionInput) =>
    run(async () => {
      const existing = sessions.find((s) => s.id === id);
      await cancelNotifications(existing?.notificationIds);
      const updated = await studyService.updateSession(id, input);
      const ids = remindersEnabled ? await scheduleStudySessionNotifications(updated) : [];
      const withIds = await studyService.updateSession(id, { notificationIds: ids });
      setSessions((prev) => prev.map((s) => (s.id === id ? withIds : s)));
    });

  const removeSession = (id: string) =>
    run(async () => {
      const existing = sessions.find((s) => s.id === id);
      await studyService.removeSession(id);
      await cancelNotifications(existing?.notificationIds);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    });

  return {
    sessions,
    current,
    stats,
    loaded,
    failed,
    busy,
    elapsedMs,
    reload: load,
    start,
    pause,
    resume,
    stop,
    createSession,
    updateSession,
    removeSession,
  };
}
