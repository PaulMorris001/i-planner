import { Request, Response } from 'express';
import { Settings } from '../models/Settings';
import { env } from '../config/env';
import { verifyState } from '../utils/googleOAuthState';

const APP_REDIRECT = 'iplanner://oauth2redirect';

interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

// Google's redirect lands here as a plain browser navigation — no auth header, and
// the user's identity is only known via the signed `state` param minted by
// startGoogleCalendarConnect. Every path below ends in a redirect back into the app,
// never a JSON response, since there's no client-side code left to receive one.
export async function handleGoogleCalendarCallback(req: Request, res: Response) {
  const { code, state, error } = req.query;

  if (error || typeof code !== 'string' || typeof state !== 'string') {
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
      res.redirect(`${APP_REDIRECT}?status=error`);
      return;
    }

    await Settings.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          googleCalendarConnected: true,
          googleAccessToken: tokenData.access_token,
          // Google only returns a refresh_token on the first consent — don't
          // overwrite a previously-stored one with undefined on reconnect.
          ...(tokenData.refresh_token ? { googleRefreshToken: tokenData.refresh_token } : {}),
          googleTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      },
      { upsert: true, new: true }
    );

    res.redirect(`${APP_REDIRECT}?status=success`);
  } catch (err) {
    console.error('[googleOAuthCallback] token exchange failed', err);
    res.redirect(`${APP_REDIRECT}?status=error`);
  }
}
