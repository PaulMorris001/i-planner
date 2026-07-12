import { Response } from 'express';
import { Settings, toPublicSettings } from '../models/Settings';
import { AuthedRequest } from '../middleware/requireAuth';

export async function getSettings(req: AuthedRequest, res: Response) {
  const settings = await Settings.findOne({ firebaseUid: req.userId });
  res.json(toPublicSettings(settings));
}

export async function updateSettings(req: AuthedRequest, res: Response) {
  const { appleCalendarConnected, googleCalendarConnected, calendarGateDismissed } = req.body ?? {};

  const update: Record<string, boolean> = {};
  if (appleCalendarConnected !== undefined) update.appleCalendarConnected = !!appleCalendarConnected;
  if (googleCalendarConnected !== undefined) update.googleCalendarConnected = !!googleCalendarConnected;
  if (calendarGateDismissed !== undefined) update.calendarGateDismissed = !!calendarGateDismissed;

  const settings = await Settings.findOneAndUpdate(
    { firebaseUid: req.userId },
    { $set: update },
    { upsert: true, new: true }
  );

  res.json(toPublicSettings(settings));
}
