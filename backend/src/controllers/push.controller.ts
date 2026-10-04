import { Response } from 'express';
import { Expo } from 'expo-server-sdk';
import { PushToken } from '../models/PushToken';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';

function readToken(body: unknown): string {
  const token = (body as { token?: unknown })?.token;
  if (typeof token !== 'string' || !Expo.isExpoPushToken(token)) {
    throw new ApiError(400, 'A valid Expo push token is required.', 'general');
  }
  return token;
}

// Called by the app after sign-in (and whenever the token changes). Upsert by
// token: the same phone signing into another account moves to that account.
export async function registerPushToken(req: AuthedRequest, res: Response) {
  const token = readToken(req.body);
  const platform = req.body?.platform === 'ios' ? 'ios' : 'android';
  await PushToken.findOneAndUpdate(
    { token },
    { $set: { firebaseUid: req.userId, platform } },
    { upsert: true }
  );
  res.status(204).end();
}

// Called on sign-out, so a shared phone stops getting the old account's pushes.
export async function unregisterPushToken(req: AuthedRequest, res: Response) {
  const token = readToken(req.body);
  await PushToken.deleteOne({ token, firebaseUid: req.userId });
  res.status(204).end();
}
