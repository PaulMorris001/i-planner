import { Settings, SettingsDocument } from '../models/Settings';
import { env } from '../config/env';
import { encryptToken, decryptToken } from '../utils/tokenCrypto';
import {
  buildEventWindow,
  endOfLocalDayUtc,
  CalendarReauthRequiredError,
  SyncableClassItem,
  SyncableTaskItem,
  SyncFreq,
} from './calendarEventTime';

export type { SyncableClassItem, SyncableTaskItem } from './calendarEventTime';

// Hand-rolled fetch calls against Calendar API v3. Every write function no-ops
// cleanly when the user hasn't connected Google Calendar, so callers never need
// their own connected-check.

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const SYNC_CALENDAR_NAME = 'i-Planner';
const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
// Import safety cap — 10 pages x 250 is far beyond any real 60-day window.
const MAX_LIST_PAGES = 10;

function toGoogleEventTime(floatingDateTime: string, timeZone: string): { dateTime: string; timeZone: string } {
  return { dateTime: floatingDateTime, timeZone };
}

// RFC 5545 UTC form (YYYYMMDDTHHMMSSZ) — required for UNTIL when DTSTART has a TZID.
function toRRuleUntil(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function buildRRule(freq: SyncFreq, dayIdxs: number[], until?: Date): string | undefined {
  let rule: string | undefined;
  if (freq === 'weekly' || freq === 'weekdays') {
    const days = dayIdxs.map(i => BYDAY[i]).filter(Boolean).join(',');
    rule = days ? `RRULE:FREQ=WEEKLY;BYDAY=${days}` : undefined;
  } else if (freq === 'daily') {
    rule = 'RRULE:FREQ=DAILY';
  } else if (freq === 'monthly') {
    rule = 'RRULE:FREQ=MONTHLY';
  }
  return rule && until ? `${rule};UNTIL=${toRRuleUntil(until)}` : rule;
}

// The stored refresh token was rejected for good — flip the connection off and
// flag it so the app can show "Reconnect needed" instead of pretending to sync.
async function markReauthRequired(settings: SettingsDocument): Promise<void> {
  console.warn('[googleCalendarSync] refresh token rejected — marking reconnect required', settings.firebaseUid);
  settings.googleCalendarConnected = false;
  settings.googleReauthRequired = true;
  settings.googleAccessToken = undefined;
  settings.googleRefreshToken = undefined;
  settings.googleTokenExpiresAt = undefined;
  await Settings.updateOne(
    { _id: settings._id },
    {
      $set: { googleCalendarConnected: false, googleReauthRequired: true },
      $unset: { googleAccessToken: '', googleRefreshToken: '', googleTokenExpiresAt: '' },
    }
  );
}

async function refreshAccessTokenIfNeeded(settings: SettingsDocument): Promise<string | null> {
  const expiresAt = settings.googleTokenExpiresAt?.getTime() ?? 0;
  const currentAccessToken = decryptToken(settings.googleAccessToken);
  if (currentAccessToken && expiresAt > Date.now() + 60_000) {
    return currentAccessToken;
  }
  const refreshToken = decryptToken(settings.googleRefreshToken);
  if (!refreshToken) {
    await markReauthRequired(settings);
    return null;
  }

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

  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    console.error('[googleCalendarSync] token refresh failed', res.status, data);
    // invalid_grant = revoked/expired refresh token; anything else (5xx, network
    // blips) is transient and shouldn't disconnect the user.
    if (data.error === 'invalid_grant') await markReauthRequired(settings);
    return null;
  }

  settings.googleAccessToken = encryptToken(data.access_token);
  settings.googleTokenExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await settings.save();
  return data.access_token;
}

// Reuses an existing "i-Planner" calendar (e.g. from before a disconnect →
// reconnect) instead of piling up duplicates, and only creates one if missing.
async function ensureSyncCalendar(settings: SettingsDocument, accessToken: string): Promise<string | null> {
  if (settings.googleCalendarId) return settings.googleCalendarId;

  let calendarId: string | undefined;
  const listRes = await fetch(`${CALENDAR_API}/users/me/calendarList?minAccessRole=owner&maxResults=250`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = (await listRes.json()) as { items?: { id: string; summary?: string; deleted?: boolean }[] };
    calendarId = list.items?.find((c) => c.summary === SYNC_CALENDAR_NAME && !c.deleted)?.id;
  }

  if (!calendarId) {
    const res = await fetch(`${CALENDAR_API}/calendars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: SYNC_CALENDAR_NAME,
        description: 'Synced from the i-Planner app.',
        timeZone: settings.timeZone || undefined,
      }),
    });
    const data = (await res.json()) as { id?: string };
    if (!res.ok || !data.id) {
      console.error('[googleCalendarSync] failed to create sync calendar', data);
      return null;
    }
    calendarId = data.id;
  }

  settings.googleCalendarId = calendarId;
  await settings.save();
  return calendarId;
}

interface SyncContext {
  settings: SettingsDocument;
  accessToken: string;
  calendarId: string;
}

async function prepareSync(settings: SettingsDocument): Promise<SyncContext | null> {
  if (!settings.googleCalendarConnected) return null;
  const accessToken = await refreshAccessTokenIfNeeded(settings);
  if (!accessToken) return null;
  const calendarId = await ensureSyncCalendar(settings, accessToken);
  if (!calendarId) return null;
  return { settings, accessToken, calendarId };
}

async function createEvent(ctx: SyncContext, body: Record<string, unknown>, isRetry = false): Promise<string | undefined> {
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(ctx.calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return ((await res.json()) as { id: string }).id;

  // 404 on the calendar itself = the user deleted the "i-Planner" calendar in
  // Google. Forget it, make a fresh one, and retry once — otherwise every
  // future sync would fail forever against a calendar that no longer exists.
  if (res.status === 404 && !isRetry) {
    ctx.settings.googleCalendarId = undefined;
    const calendarId = await ensureSyncCalendar(ctx.settings, ctx.accessToken);
    if (calendarId) return createEvent({ ...ctx, calendarId }, body, true);
  }
  console.error('[googleCalendarSync] event create failed', res.status, await res.text());
  return undefined;
}

async function upsertEvent(
  ctx: SyncContext,
  existingEventId: string | undefined,
  body: Record<string, unknown>
): Promise<string | undefined> {
  if (existingEventId) {
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(existingEventId)}`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (res.ok) {
      const data = (await res.json()) as { id: string };
      return data.id;
    }
    // 404/410 — stale event id (user deleted it, or it lived on an older sync
    // calendar). Fall through and create a fresh event so upsert is always safe.
    if (res.status !== 404 && res.status !== 410) {
      console.error('[googleCalendarSync] event update failed', res.status, await res.text());
      return existingEventId;
    }
  }

  return createEvent(ctx, body);
}

async function deleteEvent(ctx: SyncContext, eventId: string): Promise<void> {
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(ctx.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${ctx.accessToken}` } }
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
  if (!ctx) return item.googleEventId;

  const timeZone = settings.timeZone || 'UTC';
  const recurring = item.recurring && !!item.freq;
  const { start, end } = buildEventWindow(item.startDate, item.time, 60, timeZone, recurring ? item : undefined);
  const body: Record<string, unknown> = {
    summary: item.courseName,
    start: toGoogleEventTime(start, timeZone),
    end: toGoogleEventTime(end, timeZone),
    location: item.venue || undefined,
    description: item.professor ? `Professor: ${item.professor}` : undefined,
  };
  const until = item.endDate ? endOfLocalDayUtc(item.endDate, timeZone) : undefined;
  const rrule = recurring ? buildRRule(item.freq, item.dayIdxs ?? [], until) : undefined;
  if (rrule) body.recurrence = [rrule];

  return upsertEvent(ctx, item.googleEventId, body);
}

export async function deleteClassEvent(
  settings: SettingsDocument,
  item: { googleEventId?: string }
): Promise<void> {
  if (!item.googleEventId) return;
  const ctx = await prepareSync(settings);
  if (!ctx) return;
  await deleteEvent(ctx, item.googleEventId);
}

export async function upsertTaskEvent(
  settings: SettingsDocument,
  task: SyncableTaskItem
): Promise<string | undefined> {
  if (!task.dueDate) return undefined;
  const ctx = await prepareSync(settings);
  if (!ctx) return task.googleEventId;

  const timeZone = settings.timeZone || 'UTC';
  const recurring = !!task.recurring && !!task.freq;
  const { start, end } = buildEventWindow(task.dueDate, task.time, 30, timeZone, recurring ? task : undefined);
  const body: Record<string, unknown> = {
    summary: task.title,
    start: toGoogleEventTime(start, timeZone),
    end: toGoogleEventTime(end, timeZone),
  };
  if (task.notes) body.description = task.notes;
  const rrule = recurring ? buildRRule(task.freq!, task.dayIdxs ?? []) : undefined;
  if (rrule) body.recurrence = [rrule];

  return upsertEvent(ctx, task.googleEventId, body);
}

export async function deleteTaskEvent(
  settings: SettingsDocument,
  task: { googleEventId?: string }
): Promise<void> {
  if (!task.googleEventId) return;
  const ctx = await prepareSync(settings);
  if (!ctx) return;
  await deleteEvent(ctx, task.googleEventId);
}

// Best-effort — lets the user's Google account drop the app's grant on
// disconnect instead of leaving a dangling authorization behind.
export async function revokeGoogleAccess(settings: SettingsDocument): Promise<void> {
  const token = decryptToken(settings.googleRefreshToken) ?? decryptToken(settings.googleAccessToken);
  if (!token) return;
  try {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } catch (err) {
    console.error('[googleCalendarSync] token revoke failed', err);
  }
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
//
// Throws (rather than returning []) on failure, so the import endpoint can tell
// "nothing there" apart from "couldn't check" — it prunes stale rows on the former.
export async function listPrimaryGoogleEvents(
  settings: SettingsDocument,
  timeMinIso: string,
  timeMaxIso: string
): Promise<RemoteGoogleEvent[]> {
  const accessToken = settings.googleCalendarConnected ? await refreshAccessTokenIfNeeded(settings) : null;
  if (!accessToken) {
    if (settings.googleReauthRequired || !settings.googleCalendarConnected) throw new CalendarReauthRequiredError('google');
    throw new Error('Could not refresh Google access token.');
  }

  type GoogleEvent = {
    id: string;
    summary?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
    location?: string;
    status?: string;
  };

  const items: GoogleEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const params = new URLSearchParams({
      timeMin: timeMinIso,
      timeMax: timeMaxIso,
      singleEvents: 'true', // expands recurring events into individual instances
      orderBy: 'startTime',
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await fetch(`${CALENDAR_API}/calendars/primary/events?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[googleCalendarSync] failed to list primary events', res.status, text);
      if (res.status === 401) throw new CalendarReauthRequiredError('google');
      throw new Error(`Google Calendar list failed (${res.status}).`);
    }
    const data = (await res.json()) as { items?: GoogleEvent[]; nextPageToken?: string };
    items.push(...(data.items ?? []));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return items
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
