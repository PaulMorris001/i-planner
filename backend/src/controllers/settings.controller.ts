import { Response } from 'express';
import { Settings, toPublicSettings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { env } from '../config/env';
import { signState } from '../utils/googleOAuthState';

// Write scope — needed to create the sync calendar and write events, not just read.
// Users connected under the old readonly scope will need to reconnect once.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
// Read-only — Outlook import never writes back, unlike Google above.
const MICROSOFT_CALENDAR_SCOPE = 'offline_access https://graph.microsoft.com/Calendars.Read';

export async function getSettings(req: AuthedRequest, res: Response) {
  const settings = await Settings.findOne({ firebaseUid: req.userId });
  res.json(toPublicSettings(settings));
}

export async function updateSettings(req: AuthedRequest, res: Response) {
  // googleCalendarConnected is intentionally not settable here — only the OAuth
  // callback sets it, after a real token exchange.
  const {
    appleCalendarConnected, calendarGateDismissed, remindersEnabled, timeZone,
    aiAccessTasks, aiAccessGoals, aiAccessCalendar, aiDisclosureAcknowledged,
    savingsDisclosureAcknowledged, focusProfile,
  } = req.body ?? {};

  const update: Record<string, unknown> = {};
  if (appleCalendarConnected !== undefined) update.appleCalendarConnected = !!appleCalendarConnected;
  if (calendarGateDismissed !== undefined) update.calendarGateDismissed = !!calendarGateDismissed;
  if (remindersEnabled !== undefined) update.remindersEnabled = !!remindersEnabled;
  if (typeof timeZone === 'string' && timeZone) update.timeZone = timeZone;
  if (aiAccessTasks !== undefined) update.aiAccessTasks = !!aiAccessTasks;
  if (aiAccessGoals !== undefined) update.aiAccessGoals = !!aiAccessGoals;
  if (aiAccessCalendar !== undefined) update.aiAccessCalendar = !!aiAccessCalendar;
  if (aiDisclosureAcknowledged !== undefined) update.aiDisclosureAcknowledged = !!aiDisclosureAcknowledged;
  if (savingsDisclosureAcknowledged !== undefined) update.savingsDisclosureAcknowledged = !!savingsDisclosureAcknowledged;
  if (typeof focusProfile === 'string' && focusProfile) update.focusProfile = focusProfile;

  const settings = await Settings.findOneAndUpdate(
    { firebaseUid: req.userId },
    { $set: update },
    { upsert: true, new: true }
  );

  res.json(toPublicSettings(settings));
}

// Backend-relay OAuth flow — the app never sees a Google client ID/secret/code,
// it just opens this URL externally and waits for the iplanner:// deep link back.
export async function startGoogleCalendarConnect(req: AuthedRequest, res: Response) {
  const redirectUri = `${env.backendPublicUrl}/api/oauth/google/callback`;
  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', env.googleOAuthClientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', GOOGLE_CALENDAR_SCOPE);
  authorizeUrl.searchParams.set('access_type', 'offline');
  authorizeUrl.searchParams.set('prompt', 'consent');
  authorizeUrl.searchParams.set('state', signState(req.userId!));

  res.json({ url: authorizeUrl.toString() });
}

export async function disconnectGoogleCalendar(req: AuthedRequest, res: Response) {
  const settings = await Settings.findOneAndUpdate(
    { firebaseUid: req.userId },
    {
      $set: { googleCalendarConnected: false },
      $unset: {
        googleAccessToken: '',
        googleRefreshToken: '',
        googleTokenExpiresAt: '',
        googleCalendarId: '',
      },
    },
    { upsert: true, new: true }
  );
  res.json(toPublicSettings(settings));
}

// Same backend-relay shape as startGoogleCalendarConnect above, read-only scope.
// Throws instead of silently returning a broken URL when the Azure app
// registration hasn't been set up yet (microsoftOAuthClientId is optional at
// startup — see config/env.ts — unlike Google's, which crashes at boot instead).
export async function startMicrosoftCalendarConnect(req: AuthedRequest, res: Response) {
  // Both, not just clientId — a partially-configured deployment (id set,
  // secret missing) would otherwise hand back a working-looking authorize
  // URL, let the user sit through Microsoft's consent screen, and only then
  // fail in the callback (which does check both) with a generic error and
  // no clue why.
  if (!env.microsoftOAuthClientId || !env.microsoftOAuthClientSecret) {
    throw new ApiError(503, 'Outlook Calendar is not configured yet.', 'general');
  }

  const redirectUri = `${env.backendPublicUrl}/api/oauth/microsoft/callback`;
  const authorizeUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  authorizeUrl.searchParams.set('client_id', env.microsoftOAuthClientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('response_mode', 'query');
  authorizeUrl.searchParams.set('scope', MICROSOFT_CALENDAR_SCOPE);
  authorizeUrl.searchParams.set('state', signState(req.userId!));

  res.json({ url: authorizeUrl.toString() });
}

export async function disconnectOutlookCalendar(req: AuthedRequest, res: Response) {
  const settings = await Settings.findOneAndUpdate(
    { firebaseUid: req.userId },
    {
      $set: { outlookCalendarConnected: false },
      $unset: {
        outlookAccessToken: '',
        outlookRefreshToken: '',
        outlookTokenExpiresAt: '',
      },
    },
    { upsert: true, new: true }
  );
  res.json(toPublicSettings(settings));
}
