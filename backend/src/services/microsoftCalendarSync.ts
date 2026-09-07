import { SettingsDocument } from '../models/Settings';
import { env } from '../config/env';
import { encryptToken, decryptToken } from '../utils/tokenCrypto';

// Read-only counterpart to googleCalendarSync.ts — imports the user's Outlook
// events for review in Import Calendar. Deliberately has no write-side (no
// dedicated secondary calendar, no upsert/delete): unlike Google Calendar,
// this app never writes anything into the user's Outlook account.

const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
// Must be sent on every token request (both the initial exchange and refreshes) —
// unlike Google's token endpoint, Microsoft's wants the scope repeated here too.
const GRAPH_SCOPE = 'offline_access https://graph.microsoft.com/Calendars.Read';

async function refreshAccessTokenIfNeeded(settings: SettingsDocument): Promise<string | null> {
  const expiresAt = settings.outlookTokenExpiresAt?.getTime() ?? 0;
  const currentAccessToken = decryptToken(settings.outlookAccessToken);
  if (currentAccessToken && expiresAt > Date.now() + 60_000) {
    return currentAccessToken;
  }
  const refreshToken = decryptToken(settings.outlookRefreshToken);
  if (!refreshToken || !env.microsoftOAuthClientId || !env.microsoftOAuthClientSecret) return null;

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

  const data = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  if (!res.ok || !data.access_token) {
    console.error('[microsoftCalendarSync] token refresh failed', data);
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

export interface RemoteOutlookEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

// Reads the user's default ("me") calendar. calendarView expands recurring
// events into individual instances, same as Google's singleEvents=true. The
// Prefer header returns start/end already in UTC so no per-event timezone
// math is needed, unlike the Apple/Google write paths which build floating
// local times — this is read-only, so a plain UTC instant is all that's needed.
export async function listPrimaryOutlookEvents(
  settings: SettingsDocument,
  timeMinIso: string,
  timeMaxIso: string
): Promise<RemoteOutlookEvent[]> {
  if (!settings.outlookCalendarConnected) return [];
  const accessToken = await refreshAccessTokenIfNeeded(settings);
  if (!accessToken) return [];

  const params = new URLSearchParams({
    startDateTime: timeMinIso,
    endDateTime: timeMaxIso,
    $top: '250',
    $orderby: 'start/dateTime',
  });
  const res = await fetch(`${GRAPH_API}/me/calendarView?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: 'outlook.timezone="UTC"',
    },
  });
  if (!res.ok) {
    console.error('[microsoftCalendarSync] failed to list events', res.status, await res.text());
    return [];
  }

  const data = (await res.json()) as {
    value?: {
      id: string;
      subject?: string;
      start?: { dateTime?: string };
      end?: { dateTime?: string };
      isAllDay?: boolean;
      location?: { displayName?: string };
      isCancelled?: boolean;
    }[];
  };

  return (data.value ?? [])
    .filter((e) => !e.isCancelled && e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      id: e.id,
      title: e.subject || 'Untitled event',
      // Graph returns a floating "UTC" wall-clock string with no offset (per the
      // Prefer header above) — appending "Z" makes it a real parseable UTC instant.
      startAt: `${e.start!.dateTime}Z`,
      endAt: `${e.end!.dateTime}Z`,
      allDay: !!e.isAllDay,
      location: e.location?.displayName,
    }));
}
