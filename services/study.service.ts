import type {
  NewStudySessionInput,
  StudyRunResponse,
  StudySession,
  StudyState,
  StudyStats,
} from "@/types/study.types";
import { authedRequest } from "./authedRequest";

export const studyService = {
  // Everything the Study screen shows. `weekStart` is the start of the device's local week.
  state: (weekStart: string) =>
    authedRequest<StudyState>(`/study/state?weekStart=${encodeURIComponent(weekStart)}`),

  // Just the totals, for the Profile card.
  stats: (weekStart: string) =>
    authedRequest<StudyStats>(`/study/stats?weekStart=${encodeURIComponent(weekStart)}`),

  createSession: (input: NewStudySessionInput) =>
    authedRequest<StudySession>("/study/sessions", { method: "POST", body: input }),

  updateSession: (id: string, patch: Partial<NewStudySessionInput>) =>
    authedRequest<StudySession>(`/study/sessions/${id}`, { method: "PATCH", body: patch }),

  removeSession: (id: string) =>
    authedRequest<void>(`/study/sessions/${id}`, { method: "DELETE" }),

  start: (sessionId: string, autoStopAt: string | null) =>
    authedRequest<StudyRunResponse>(`/study/sessions/${sessionId}/start`, {
      method: "POST",
      body: { autoStopAt },
    }),

  pause: () => authedRequest<StudyRunResponse>("/study/run/pause", { method: "POST" }),
  resume: () => authedRequest<StudyRunResponse>("/study/run/resume", { method: "POST" }),
  stop: () => authedRequest<StudyRunResponse>("/study/run/stop", { method: "POST" }),
};
