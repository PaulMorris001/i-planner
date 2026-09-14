import type { Settings } from "@/types/settings.types";
import { authedRequest } from "./authedRequest";

export const settingsService = {
  get: () => authedRequest<Settings>("/settings"),

  patch: (update: Partial<Settings> & { timeZone?: string }) =>
    authedRequest<Settings>("/settings", { method: "PATCH", body: update }),

  startGoogleConnect: () =>
    authedRequest<{ url: string }>("/settings/calendar/google/start", {
      method: "POST",
    }),

  disconnectGoogle: () =>
    authedRequest<Settings>("/settings/calendar/google/disconnect", {
      method: "POST",
    }),

  startMicrosoftConnect: () =>
    authedRequest<{ url: string }>("/settings/calendar/microsoft/start", {
      method: "POST",
    }),

  disconnectOutlook: () =>
    authedRequest<Settings>("/settings/calendar/microsoft/disconnect", {
      method: "POST",
    }),
};
