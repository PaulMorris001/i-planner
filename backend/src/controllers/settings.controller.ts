import { Response } from 'express';
import { Settings, toPublicSettings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';
import { env } from '../config/env';
import { signState } from '../utils/googleOAuthState';

// Write scope — needed to create the sync calendar and write events, not just read.
// Users connected under the old readonly scope will need to reconnect once.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

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
    savingsDisclosureAcknowledged,
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
