import { Request, Response } from 'express';
import { Settings } from '../models/Settings';
import { env } from '../config/env';
import { verifyState } from '../utils/googleOAuthState';
import { encryptToken } from '../utils/tokenCrypto';
import { backfillCalendar } from '../services/calendarSync';

const APP_REDIRECT = 'iplanner://oauth2redirect';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

// Plain browser navigation — no auth header; identity comes only from the signed
// `state` param minted by startGoogleCalendarConnect. Every path redirects back into
// the app rather than returning JSON, since there's no client code left to receive one.
export async function handleGoogleCalendarCallback(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;

  if (error || typeof code !== 'string' || typeof state !== 'string') {
    // The provider's own explanation (e.g. "unauthorized_client: The client
    // does not exist...") - otherwise the app only ever sees status=error.
    console.error('[googleOAuthCallback] provider returned an error', { error, error_description });
    res.redirect(`${APP_REDIRECT}?status=error`);
    return;
  }

  const uid = verifyState(state);
  if (!uid) {
    res.redirect(`${APP_REDIRECT}?status=error`);
    return;
  }

  try {
    const redirectUri = `${env.backendPublicUrl}/api/oauth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleOAuthClientId,
        client_secret: env.googleOAuthClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('[googleOAuthCallback] token exchange rejected', tokenRes.status, tokenData.error, tokenData.error_description);
      res.redirect(`${APP_REDIRECT}?status=error`);
      return;
    }

    await Settings.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          googleCalendarConnected: true,
          googleReauthRequired: false,
          googleAccessToken: encryptToken(tokenData.access_token),
          // Google only returns a refresh_token on the first consent — don't
          // overwrite a previously-stored one with undefined on reconnect.
          ...(tokenData.refresh_token ? { googleRefreshToken: encryptToken(tokenData.refresh_token) } : {}),
          googleTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      },
      { upsert: true, new: true }
    );

    res.redirect(`${APP_REDIRECT}?status=success`);

    // After the redirect, not before — pushing every existing class/task can
    // take a while, and the browser shouldn't sit on a spinner for it.
    void backfillCalendar(uid, 'google');
  } catch (err) {
    console.error('[googleOAuthCallback] token exchange failed', err);
    res.redirect(`${APP_REDIRECT}?status=error`);
  }
}
