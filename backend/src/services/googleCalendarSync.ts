import { SettingsDocument } from '../models/Settings';
import { env } from '../config/env';
import { encryptToken, decryptToken } from '../utils/tokenCrypto';

// Hand-rolled fetch calls against Calendar API v3. Every exported function no-ops
// cleanly when the user hasn't connected Google Calendar, so callers never need
// their own connected-check.

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

// Minimal shapes this service needs — Classes are a schemaless blob (Plan.data.classes)
// and this backend doesn't share a types package with the app.
export interface SyncableClassItem {
  courseName: string;
  startDate: string;
  recurring: boolean;
  freq: 'weekly' | 'weekdays' | 'daily' | 'monthly';
  dayIdxs: number[];
  time: string;
  professor?: string;
  venue?: string;
  googleEventId?: string;
}

export interface SyncableTaskItem {
  title: string;
  dueDate: string;
  time?: string;
  notes?: string;
  recurring?: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
  googleEventId?: string;
}

// Parses "9:00 AM"-style strings; unparseable/empty falls back to 9:00 AM.
function parseTime(time: string | undefined): { hour: number; minute: number } {
  const match = time?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { hour: 9, minute: 0 };
  let hour = parseInt(match[1], 10) % 12;
  if (match[3]?.toUpperCase() === 'PM') hour += 12;
  return { hour, minute: parseInt(match[2], 10) };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Formats a UTC-arithmetic instant back into a floating "wall clock" string with no
// offset — Date.UTC/getUTC* here is just deterministic minute arithmetic, not a real
// instant, so this is unaffected by the server's own TZ.
function formatFloating(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

// dueDate/startDate is either a plain "YYYY-MM-DD" (digits ARE the calendar day)
// or a full timestamp from a date picker (an arbitrary real moment). Naive
// slicing only works for the first case — for the second, those digits are the
// instant's UTC day, which can differ from the user's local day (e.g. a
// late-evening pick rolls into the next UTC day). Resolve via stored timeZone.
function localDatePart(dateIso: string, timeZone: string): string {
  if (!dateIso.includes('T')) return dateIso.slice(0, 10);
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso.slice(0, 10);
  // en-CA formats as YYYY-MM-DD, exactly what this needs.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Builds floating (no-offset) local datetime strings. Paired with an explicit IANA
// timeZone in toGoogleEventTime, Google interprets the hour/minute literally in the
// user's timezone rather than as a UTC instant — "9:00 AM" lands at 9 AM local.
function buildEventWindow(dateIso: string, time: string | undefined, durationMinutes: number, timeZone: string) {
  const { hour, minute } = parseTime(time);
  const datePart = localDatePart(dateIso, timeZone);
  const startMs = Date.UTC(
    Number(datePart.slice(0, 4)),
    Number(datePart.slice(5, 7)) - 1,
    Number(datePart.slice(8, 10)),
    hour,
    minute
  );
  const endMs = startMs + durationMinutes * 60_000;
  return { start: formatFloating(startMs), end: formatFloating(endMs) };
}

// Falls back to UTC when the device hasn't reported its timezone yet (e.g. an
// existing user who hasn't opened the app since this was added).
function toGoogleEventTime(floatingDateTime: string, timeZone: string): { dateTime: string; timeZone: string } {
  return { dateTime: floatingDateTime, timeZone };
}

function buildRRule(freq: SyncableClassItem['freq'], dayIdxs: number[]): string | undefined {
  if (freq === 'weekly' || freq === 'weekdays') {
    const days = dayIdxs.map(i => BYDAY[i]).filter(Boolean).join(',');
    return days ? `RRULE:FREQ=WEEKLY;BYDAY=${days}` : undefined;
  }
  if (freq === 'daily') return 'RRULE:FREQ=DAILY';
  if (freq === 'monthly') return 'RRULE:FREQ=MONTHLY';
  return undefined;
}

async function refreshAccessTokenIfNeeded(settings: SettingsDocument): Promise<string | null> {
  const expiresAt = settings.googleTokenExpiresAt?.getTime() ?? 0;
  const currentAccessToken = decryptToken(settings.googleAccessToken);
  if (currentAccessToken && expiresAt > Date.now() + 60_000) {
    return currentAccessToken;
  }
  const refreshToken = decryptToken(settings.googleRefreshToken);
  if (!refreshToken) return null;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.googleOAuthClientId,
      client_secret: env.googleOAuthClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) {
    console.error('[googleCalendarSync] token refresh failed', data);
    return null;
  }

  settings.googleAccessToken = encryptToken(data.access_token);
  settings.googleTokenExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await settings.save();
  return data.access_token;
}

async function ensureSyncCalendar(settings: SettingsDocument, accessToken: string): Promise<string | null> {
  if (settings.googleCalendarId) return settings.googleCalendarId;

  const res = await fetch(`${CALENDAR_API}/calendars`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ summary: 'i-Planner', description: 'Synced from the i-Planner app.' }),
  });

  const data = (await res.json()) as { id?: string };
  if (!res.ok || !data.id) {
    console.error('[googleCalendarSync] failed to create sync calendar', data);
    return null;
  }

  settings.googleCalendarId = data.id;
  await settings.save();
  return data.id;
}

async function prepareSync(settings: SettingsDocument): Promise<{ accessToken: string; calendarId: string } | null> {
  if (!settings.googleCalendarConnected) return null;
  const accessToken = await refreshAccessTokenIfNeeded(settings);
  if (!accessToken) return null;
  const calendarId = await ensureSyncCalendar(settings, accessToken);
  if (!calendarId) return null;
  return { accessToken, calendarId };
}

async function upsertEvent(
  accessToken: string,
  calendarId: string,
  existingEventId: string | undefined,
  body: Record<string, unknown>
): Promise<string | undefined> {
  if (existingEventId) {
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return data.id;
    }
    if (res.status !== 404) {
      console.error('[googleCalendarSync] event update failed', res.status, await res.text());
      return existingEventId;
    }
    // 404 — stale event id (e.g. a reconnect rotated to a new sync calendar).
    // Fall through and create a fresh event so backfill is always safe to call.
  }

  const createRes = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!createRes.ok) {
    console.error('[googleCalendarSync] event create failed', createRes.status, await createRes.text());
    return undefined;
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  );
  // 404/410 means it's already gone — treat as a successful delete.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error('[googleCalendarSync] event delete failed', res.status, await res.text());
  }
}

export async function upsertClassEvent(
  settings: SettingsDocument,
  item: SyncableClassItem
): Promise<string | undefined> {
  const ctx = await prepareSync(settings);
  if (!ctx) return undefined;

  const timeZone = settings.timeZone || 'UTC';
  const { start, end } = buildEventWindow(item.startDate, item.time, 60, timeZone);
  const body: Record<string, unknown> = {
    summary: item.courseName,
    start: toGoogleEventTime(start, timeZone),
    end: toGoogleEventTime(end, timeZone),
    location: item.venue || undefined,
    description: item.professor ? `Professor: ${item.professor}` : undefined,
  };
  const rrule = item.recurring ? buildRRule(item.freq, item.dayIdxs) : undefined;
  if (rrule) body.recurrence = [rrule];

  return upsertEvent(ctx.accessToken, ctx.calendarId, item.googleEventId, body);
}

export async function deleteClassEvent(
  settings: SettingsDocument,
  item: { googleEventId?: string }
): Promise<void> {
  if (!item.googleEventId) return;
  const ctx = await prepareSync(settings);
  if (!ctx) return;
  await deleteEvent(ctx.accessToken, ctx.calendarId, item.googleEventId);
}

export async function upsertTaskEvent(
  settings: SettingsDocument,
  task: SyncableTaskItem
): Promise<string | undefined> {
  if (!task.dueDate) return undefined;
  const ctx = await prepareSync(settings);
  if (!ctx) return undefined;

  const timeZone = settings.timeZone || 'UTC';
  const { start, end } = buildEventWindow(task.dueDate, task.time, 30, timeZone);
  const body: Record<string, unknown> = {
    summary: task.title,
    start: toGoogleEventTime(start, timeZone),
    end: toGoogleEventTime(end, timeZone),
  };
  if (task.notes) body.description = task.notes;
  const rrule = task.recurring && task.freq ? buildRRule(task.freq, task.dayIdxs ?? []) : undefined;
  if (rrule) body.recurrence = [rrule];

  return upsertEvent(ctx.accessToken, ctx.calendarId, task.googleEventId, body);
}

export async function deleteTaskEvent(
  settings: SettingsDocument,
  task: { googleEventId?: string }
): Promise<void> {
  if (!task.googleEventId) return;
  const ctx = await prepareSync(settings);
  if (!ctx) return;
  await deleteEvent(ctx.accessToken, ctx.calendarId, task.googleEventId);
}

export interface RemoteGoogleEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

// Reads the user's "primary" calendar — deliberately not the dedicated
// "i-Planner" secondary calendar this file writes to. That separation naturally
// excludes everything the app already wrote via upsertClassEvent/upsertTaskEvent,
// with no id-matching needed (unlike the Apple import path, which shares one calendar).
export async function listPrimaryGoogleEvents(
  settings: SettingsDocument,
  timeMinIso: string,
  timeMaxIso: string
): Promise<RemoteGoogleEvent[]> {
  if (!settings.googleCalendarConnected) return [];
  const accessToken = await refreshAccessTokenIfNeeded(settings);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    timeMin: timeMinIso,
    timeMax: timeMaxIso,
    singleEvents: 'true', // expands recurring events into individual instances
    orderBy: 'startTime',
    maxResults: '250',
  });
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error('[googleCalendarSync] failed to list primary events', res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    items?: {
      id: string;
      summary?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      location?: string;
      status?: string;
    }[];
  };

  return (data.items ?? [])
    .filter((e) => e.status !== 'cancelled' && e.start && e.end)
    .map((e) => {
      const allDay = !!e.start!.date;
      return {
        id: e.id,
        title: e.summary || 'Untitled event',
        startAt: e.start!.dateTime ?? `${e.start!.date}T00:00:00`,
        endAt: e.end!.dateTime ?? `${e.end!.date}T00:00:00`,
        allDay,
        location: e.location,
      };
    });
}
