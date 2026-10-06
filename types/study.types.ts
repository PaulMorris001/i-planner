// What /study/* returns (backend/src/controllers/study.controller.ts).
export interface StudySession {
  id: string;
  name: string;
  // Monday-start weekday indices (0=Mon..6=Sun) the reminder repeats on.
  days: number[];
  // Minutes after local midnight (17:00 = 1020), or null when there is no schedule.
  startMinute: number | null;
  endMinute: number | null;
  notificationIds?: string[];
}

export interface NewStudySessionInput {
  name: string;
  days: number[];
  startMinute: number | null;
  endMinute: number | null;
  notificationIds?: string[];
}

export type StudyRunStatus = 'running' | 'paused';

export interface StudyRun {
  id: string;
  sessionId: string;
  sessionName: string;
  status: StudyRunStatus;
  startedAt: string;
  // Active (unpaused) milliseconds banked so far, not counting the current stretch.
  activeMs: number;
  // When the current running stretch began (server clock); null while paused.
  lastResumeAt: string | null;
  autoStopAt: string | null;
}

export interface StudyStats {
  allTimeMs: number;
  weekMs: number;
  sessionsThisWeek: number;
}

export interface StudyState {
  sessions: StudySession[];
  current: StudyRun | null;
  stats: StudyStats;
  // The server's clock, so the live timer isn't thrown off by a wrong phone clock.
  serverNow: string;
}

export interface StudyStopResult {
  logged: boolean;
  minutes: number;
  points: number;
}

export interface StudyRunResponse {
  current: StudyRun | null;
  serverNow: string;
  result?: StudyStopResult | null;
}
