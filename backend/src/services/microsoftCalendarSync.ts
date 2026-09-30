import { Settings, SettingsDocument } from '../models/Settings';
import { env } from '../config/env';
import { encryptToken, decryptToken } from '../utils/tokenCrypto';
import {
  buildEventWindow,
  localDatePart,
  recurrenceEndDate,
  CalendarReauthRequiredError,
  SyncableClassItem,
  SyncableTaskItem,
  SyncFreq,
  EventWindow,
} from './calendarEventTime';

// Outlook counterpart to googleCalendarSync.ts, same two halves:
//  - write: classes/tasks go to a dedicated "i-Planner" calendar in the user's
//    Outlook account (never their default calendar), via Microsoft Graph.
//  - read: the user's default calendar is imported for review in Import Calendar.
// Every write function no-ops cleanly when Outlook isn't connected.

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
// Must be sent on every token request (both the initial exchange and refreshes) —
// unlike Google's token endpoint, Microsoft's wants the scope repeated here too.
export const GRAPH_SCOPE = 'offline_access https://graph.microsoft.com/Calendars.ReadWrite';
const SYNC_CALENDAR_NAME = 'i-Planner';
const GRAPH_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const MAX_LIST_PAGES = 10;

async function markReauthRequired(settings: SettingsDocument): Promise<void> {
  console.warn('[microsoftCalendarSync] refresh token rejected — marking reconnect required', settings.firebaseUid);
  settings.outlookCalendarConnected = false;
  settings.outlookReauthRequired = true;
  settings.outlookAccessToken = undefined;
  settings.outlookRefreshToken = undefined;
  settings.outlookTokenExpiresAt = undefined;
  await Settings.updateOne(
    { _id: settings._id },
    {
      $set: { outlookCalendarConnected: false, outlookReauthRequired: true },
      $unset: { outlookAccessToken: '', outlookRefreshToken: '', outlookTokenExpiresAt: '' },
    }
  );
}

async function refreshAccessTokenIfNeeded(settings: SettingsDocument): Promise<string | null> {
  const expiresAt = settings.outlookTokenExpiresAt?.getTime() ?? 0;
  const currentAccessToken = decryptToken(settings.outlookAccessToken);
  if (currentAccessToken && expiresAt > Date.now() + 60_000) {
    return currentAccessToken;
  }
  if (!env.microsoftOAuthClientId || !env.microsoftOAuthClientSecret) return null;
  const refreshToken = decryptToken(settings.outlookRefreshToken);
  if (!refreshToken) {
    await markReauthRequired(settings);
    return null;
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.microsoftOAuthClientId,
      client_secret: env.microsoftOAuthClientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: GRAPH_SCOPE,
    }).toString(),
  });

  const data = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !data.access_token) {
    console.error('[microsoftCalendarSync] token refresh failed', res.status, data);
    if (data.error === 'invalid_grant' || data.error === 'interaction_required') await markReauthRequired(settings);
    return null;
  }

  settings.outlookAccessToken = encryptToken(data.access_token);
  // Microsoft rotates the refresh token on most refreshes — persist the new one
  // when given, or the next refresh attempt fails with a stale/revoked token.
  if (data.refresh_token) settings.outlookRefreshToken = encryptToken(data.refresh_token);
  settings.outlookTokenExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
  await settings.save();
  return data.access_token;
}

// Reuses an existing "i-Planner" calendar (e.g. from before a reconnect)
// instead of piling up duplicates, and only creates one if missing.
async function ensureSyncCalendar(settings: SettingsDocument, accessToken: string): Promise<string | null> {
  if (settings.outlookCalendarId) return settings.outlookCalendarId;

  let calendarId: string | undefined;
  const listRes = await fetch(`${GRAPH_API}/me/calendars?$select=id,name&$top=100`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (listRes.ok) {
    const list = (await listRes.json()) as { value?: { id: string; name?: string }[] };
    calendarId = list.value?.find((c) => c.name === SYNC_CALENDAR_NAME)?.id;
  }

  if (!calendarId) {
    const res = await fetch(`${GRAPH_API}/me/calendars`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: SYNC_CALENDAR_NAME }),
    });
    const data = (await res.json()) as { id?: string };
    if (!res.ok || !data.id) {
      console.error('[microsoftCalendarSync] failed to create sync calendar', res.status, data);
      return null;
    }
    calendarId = data.id;
  }

  settings.outlookCalendarId = calendarId;
  await settings.save();
  return calendarId;
}

interface SyncContext {
  settings: SettingsDocument;
  accessToken: string;
  calendarId: string;
}

async function prepareSync(settings: SettingsDocument): Promise<SyncContext | null> {
  if (!settings.outlookCalendarConnected) return null;
  const accessToken = await refreshAccessTokenIfNeeded(settings);
  if (!accessToken) return null;
  const calendarId = await ensureSyncCalendar(settings, accessToken);
  if (!calendarId) return null;
  return { settings, accessToken, calendarId };
}

// Graph uses a structured recurrence object instead of an RRULE string.
// range.startDate must equal the event's own start date (hence window.startDate,
// already aligned to the first matching weekday by buildEventWindow).
function buildRecurrence(
  freq: SyncFreq,
  dayIdxs: number[],
  window: EventWindow,
  endDate: string | undefined
): Record<string, unknown> | null {
  let pattern: Record<string, unknown>;
  if (freq === 'weekly' || freq === 'weekdays') {
    const daysOfWeek = dayIdxs.map((i) => GRAPH_DAYS[i]).filter(Boolean);
    if (!daysOfWeek.length) return null;
    pattern = { type: 'weekly', interval: 1, daysOfWeek, firstDayOfWeek: 'monday' };
  } else if (freq === 'daily') {
    pattern = { type: 'daily', interval: 1 };
  } else if (freq === 'monthly') {
    pattern = { type: 'absoluteMonthly', interval: 1, dayOfMonth: window.dayOfMonth };
  } else {
    return null;
  }
  const range =
    endDate && endDate >= window.startDate
      ? { type: 'endDate', startDate: window.startDate, endDate }
      : { type: 'noEnd', startDate: window.startDate };
  return { pattern, range };
}

async function createEvent(ctx: SyncContext, body: Record<string, unknown>, isRetry = false): Promise<string | undefined> {
  const res = await fetch(`${GRAPH_API}/me/calendars/${encodeURIComponent(ctx.calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.ok) return ((await res.json()) as { id: string }).id;

  // 404 on the calendar = the user deleted the "i-Planner" calendar in Outlook.
  // Forget it, make a fresh one, and retry once.
  if (res.status === 404 && !isRetry) {
    ctx.settings.outlookCalendarId = undefined;
    const calendarId = await ensureSyncCalendar(ctx.settings, ctx.accessToken);
    if (calendarId) return createEvent({ ...ctx, calendarId }, body, true);
  }
  console.error('[microsoftCalendarSync] event create failed', res.status, await res.text());
  return undefined;
}

async function upsertEvent(
  ctx: SyncContext,
  existingEventId: string | undefined,
  body: Record<string, unknown>
): Promise<string | undefined> {
  if (existingEventId) {
    const res = await fetch(`${GRAPH_API}/me/events/${encodeURIComponent(existingEventId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ctx.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) return ((await res.json()) as { id: string }).id;
    // 404 — stale event id (user deleted it in Outlook). Recreate below.
    if (res.status !== 404) {
      console.error('[microsoftCalendarSync] event update failed', res.status, await res.text());
      return existingEventId;
    }
  }
  return createEvent(ctx, body);
}

async function deleteEvent(ctx: SyncContext, eventId: string): Promise<void> {
  const res = await fetch(`${GRAPH_API}/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${ctx.accessToken}` },
  });
  if (!res.ok && res.status !== 404) {
    console.error('[microsoftCalendarSync] event delete failed', res.status, await res.text());
  }
}

function eventBody(
  subject: string,
  window: EventWindow,
  timeZone: string,
  extras: { description?: string; location?: string; recurrence: Record<string, unknown> | null }
): Record<string, unknown> {
  return {
    subject,
    start: { dateTime: window.start, timeZone },
    end: { dateTime: window.end, timeZone },
    body: { contentType: 'text', content: extras.description ?? '' },
    location: { displayName: extras.location ?? '' },
    // Explicit null (not omitted) so an edit from recurring → one-off actually
    // clears the series on PATCH.
    recurrence: extras.recurrence,
    // The app already schedules its own reminders — an Outlook popup on top
    // would double-notify.
    isReminderOn: false,
  };
}

export async function upsertClassEvent(
  settings: SettingsDocument,
  item: SyncableClassItem
): Promise<string | undefined> {
  const ctx = await prepareSync(settings);
  if (!ctx) return item.outlookEventId;

  const timeZone = settings.timeZone || 'UTC';
  const recurring = item.recurring && !!item.freq;
  const window = buildEventWindow(item.startDate, item.time, 60, timeZone, recurring ? item : undefined);
  const recurrence = recurring
    ? buildRecurrence(item.freq, item.dayIdxs ?? [], window, recurrenceEndDate(item.endDate, timeZone))
    : null;

  return upsertEvent(
    ctx,
    item.outlookEventId,
    eventBody(item.courseName, window, timeZone, {
      description: item.professor ? `Professor: ${item.professor}` : undefined,
      location: item.venue,
      recurrence,
    })
  );
}

export async function deleteClassEvent(
  settings: SettingsDocument,
  item: { outlookEventId?: string }
): Promise<void> {
  if (!item.outlookEventId) return;
  const ctx = await prepareSync(settings);
  if (!ctx) return;
  await deleteEvent(ctx, item.outlookEventId);
}

export async function upsertTaskEvent(
  settings: SettingsDocument,
  task: SyncableTaskItem
): Promise<string | undefined> {
  if (!task.dueDate) return undefined;
  const ctx = await prepareSync(settings);
  if (!ctx) return task.outlookEventId;

  const timeZone = settings.timeZone || 'UTC';
  const recurring = !!task.recurring && !!task.freq;
  const window = buildEventWindow(task.dueDate, task.time, 30, timeZone, recurring ? task : undefined);
  const recurrence = recurring ? buildRecurrence(task.freq!, task.dayIdxs ?? [], window, undefined) : null;

  return upsertEvent(ctx, task.outlookEventId, eventBody(task.title, window, timeZone, { description: task.notes, recurrence }));
}

export async function deleteTaskEvent(
  settings: SettingsDocument,
  task: { outlookEventId?: string }
): Promise<void> {
  if (!task.outlookEventId) return;
  const ctx = await prepareSync(settings);
  if (!ctx) return;
  await deleteEvent(ctx, task.outlookEventId);
}

export interface RemoteOutlookEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

// Reads the user's default ("me") calendar — not the "i-Planner" calendar this
// file writes to, so the app's own events are excluded automatically.
// calendarView expands recurring events into individual instances, same as
// Google's singleEvents=true. The Prefer header returns start/end in UTC.
// Throws on failure so the import endpoint never prunes on a failed fetch.
export async function listPrimaryOutlookEvents(
  settings: SettingsDocument,
  timeMinIso: string,
  timeMaxIso: string
): Promise<RemoteOutlookEvent[]> {
  const accessToken = settings.outlookCalendarConnected ? await refreshAccessTokenIfNeeded(settings) : null;
  if (!accessToken) {
    if (settings.outlookReauthRequired || !settings.outlookCalendarConnected) throw new CalendarReauthRequiredError('outlook');
    throw new Error('Could not refresh Outlook access token.');
  }

  type GraphEvent = {
    id: string;
    subject?: string;
    start?: { dateTime?: string };
    end?: { dateTime?: string };
    isAllDay?: boolean;
    location?: { displayName?: string };
    isCancelled?: boolean;
  };

  const params = new URLSearchParams({
    startDateTime: timeMinIso,
    endDateTime: timeMaxIso,
    $top: '250',
    $orderby: 'start/dateTime',
    $select: 'id,subject,start,end,isAllDay,location,isCancelled',
  });
  let url: string | undefined = `${GRAPH_API}/me/calendarView?${params.toString()}`;
  const items: GraphEvent[] = [];
  for (let page = 0; url && page < MAX_LIST_PAGES; page++) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[microsoftCalendarSync] failed to list events', res.status, text);
      if (res.status === 401) throw new CalendarReauthRequiredError('outlook');
      throw new Error(`Outlook calendar list failed (${res.status}).`);
    }
    const data = (await res.json()) as { value?: GraphEvent[]; '@odata.nextLink'?: string };
    items.push(...(data.value ?? []));
    url = data['@odata.nextLink'];
  }

  const timeZone = settings.timeZone || 'UTC';
  return items
    .filter((e) => !e.isCancelled && e.start?.dateTime && e.end?.dateTime)
    .map((e) => {
      // Graph returns a floating "UTC" wall-clock string (per the Prefer header),
      // sometimes with 7-digit fractional seconds — trim and append "Z" so it
      // parses as a real UTC instant everywhere.
      const toUtc = (s: string) => `${s.replace(/\.\d+$/, '')}Z`;
      // All-day events are really "local midnight" in the user's zone; converting
      // them to UTC can land on the previous/next day, so resolve the date back
      // in the user's timeZone and keep them floating midnight like the Google path.
      const toLocalMidnight = (s: string) => `${localDatePart(toUtc(s), timeZone)}T00:00:00`;
      const allDay = !!e.isAllDay;
      return {
        id: e.id,
        title: e.subject || 'Untitled event',
        startAt: allDay ? toLocalMidnight(e.start!.dateTime!) : toUtc(e.start!.dateTime!),
        endAt: allDay ? toLocalMidnight(e.end!.dateTime!) : toUtc(e.end!.dateTime!),
        allDay,
        location: e.location?.displayName || undefined,
      };
    });
}
