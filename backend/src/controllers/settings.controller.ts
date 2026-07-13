import { Response } from 'express';
import { Settings, toPublicSettings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';
import { env } from '../config/env';
import { signState } from '../utils/googleOAuthState';

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

export async function getSettings(req: AuthedRequest, res: Response) {
  const settings = await Settings.findOne({ firebaseUid: req.userId });
  res.json(toPublicSettings(settings));
}

export async function updateSettings(req: AuthedRequest, res: Response) {
  // googleCalendarConnected is intentionally not settable here — it's only ever
  // set by the OAuth callback (googleOAuthCallback.controller.ts), which verifies a
  // real token exchange first.
  const { appleCalendarConnected, calendarGateDismissed } = req.body ?? {};

  const update: Record<string, boolean> = {};
  if (appleCalendarConnected !== undefined) update.appleCalendarConnected = !!appleCalendarConnected;
  if (calendarGateDismissed !== undefined) update.calendarGateDismissed = !!calendarGateDismissed;

  const settings = await Settings.findOneAndUpdate(
    { firebaseUid: req.userId },
    { $set: update },
    { upsert: true, new: true }
  );

  res.json(toPublicSettings(settings));
}

// Kicks off the backend-relay OAuth flow (see routes/googleOAuth.routes.ts for the
// callback half). The app never sees a Google client ID/secret/code — it just opens
// this URL in an external browser and waits for the iplanner:// deep link back.
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
      $unset: { googleAccessToken: '', googleRefreshToken: '', googleTokenExpiresAt: '' },
    },
    { upsert: true, new: true }
  );
  res.json(toPublicSettings(settings));
}
