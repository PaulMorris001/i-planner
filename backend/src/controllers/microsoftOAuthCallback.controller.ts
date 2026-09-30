import { Request, Response } from 'express';
import { Settings } from '../models/Settings';
import { env } from '../config/env';
import { verifyState } from '../utils/googleOAuthState';
import { encryptToken } from '../utils/tokenCrypto';
import { GRAPH_SCOPE } from '../services/microsoftCalendarSync';
import { backfillCalendar } from '../services/calendarSync';

const APP_REDIRECT = 'iplanner://oauth2redirect';
const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

// Outlook counterpart to googleOAuthCallback.controller.ts — same
// plain-browser-redirect shape: no auth header, identity carried in the signed
// `state` param (the signer is shared, not provider-specific — see
// utils/googleOAuthState.ts).
export async function handleMicrosoftCalendarCallback(req: Request, res: Response) {
  const { code, state, error } = req.query;

  if (error || typeof code !== 'string' || typeof state !== 'string') {
    res.redirect(`${APP_REDIRECT}?status=error`);
    return;
  }

  const uid = verifyState(state);
  if (!uid || !env.microsoftOAuthClientId || !env.microsoftOAuthClientSecret) {
    res.redirect(`${APP_REDIRECT}?status=error`);
    return;
  }

  try {
    const redirectUri = `${env.backendPublicUrl}/api/oauth/microsoft/callback`;
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.microsoftOAuthClientId,
        client_secret: env.microsoftOAuthClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: GRAPH_SCOPE,
      }).toString(),
    });

    const tokenData = (await tokenRes.json()) as MicrosoftTokenResponse;
    if (!tokenRes.ok || !tokenData.access_token) {
      res.redirect(`${APP_REDIRECT}?status=error`);
      return;
    }

    await Settings.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          outlookCalendarConnected: true,
          outlookReauthRequired: false,
          outlookAccessToken: encryptToken(tokenData.access_token),
          ...(tokenData.refresh_token ? { outlookRefreshToken: encryptToken(tokenData.refresh_token) } : {}),
          outlookTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      },
      { upsert: true, new: true }
    );

    res.redirect(`${APP_REDIRECT}?status=success`);

    // After the redirect so the browser isn't held up — see the Google callback.
    void backfillCalendar(uid, 'outlook');
  } catch (err) {
    console.error('[microsoftOAuthCallback] token exchange failed', err);
    res.redirect(`${APP_REDIRECT}?status=error`);
  }
}
