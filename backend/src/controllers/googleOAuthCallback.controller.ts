import { Request, Response } from 'express';
import { Settings, SettingsDocument } from '../models/Settings';
import { Plan } from '../models/Plan';
import { Task } from '../models/Task';
import { env } from '../config/env';
import { verifyState } from '../utils/googleOAuthState';
import { encryptToken } from '../utils/tokenCrypto';
import { upsertClassEvent, upsertTaskEvent, SyncableClassItem } from '../services/googleCalendarSync';

const APP_REDIRECT = 'iplanner://oauth2redirect';

interface ClassRecord extends SyncableClassItem {
  id: string;
}

// Runs the same upsert used by live sync across existing classes/tasks so they end
// up on the calendar too. Best-effort: a failure here shouldn't break the OAuth flow.
async function backfillGoogleSync(firebaseUid: string, settings: SettingsDocument) {
  try {
    const plan = await Plan.findOne({ firebaseUid, pathType: 'student' });
    const data = plan?.data as { classes?: ClassRecord[] } | undefined;
    const classes = Array.isArray(data?.classes) ? data.classes : [];

    let classesChanged = false;
    for (const item of classes) {
      const eventId = await upsertClassEvent(settings, item);
      if (eventId !== item.googleEventId) {
        item.googleEventId = eventId;
        classesChanged = true;
      }
    }
    if (classesChanged && plan) {
      plan.markModified('data');
      await plan.save();
    }

    const tasks = await Task.find({ firebaseUid, dueDate: { $ne: '' } });
    for (const task of tasks) {
      const eventId = await upsertTaskEvent(settings, task);
      if (eventId !== task.googleEventId) {
        task.googleEventId = eventId;
        await task.save();
      }
    }
  } catch (err) {
    console.error('[googleOAuthCallback] backfill failed', err);
  }
}

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

    const settings = await Settings.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $set: {
          googleCalendarConnected: true,
          googleAccessToken: encryptToken(tokenData.access_token),
          // Google only returns a refresh_token on the first consent — don't
          // overwrite a previously-stored one with undefined on reconnect.
          ...(tokenData.refresh_token ? { googleRefreshToken: encryptToken(tokenData.refresh_token) } : {}),
          googleTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        },
      },
      { upsert: true, new: true }
    );

    await backfillGoogleSync(uid, settings);

    res.redirect(`${APP_REDIRECT}?status=success`);
  } catch (err) {
    console.error('[googleOAuthCallback] token exchange failed', err);
    res.redirect(`${APP_REDIRECT}?status=error`);
  }
}
