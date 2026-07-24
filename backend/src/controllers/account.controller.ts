import { Response } from 'express';
import { Task } from '../models/Task';
import { Goal } from '../models/Goal';
import { Habit } from '../models/Habit';
import { Settings } from '../models/Settings';
import { Plan } from '../models/Plan';
import { CoachMessage } from '../models/CoachMessage';
import { AuthedRequest } from '../middleware/requireAuth';

// Wipes every piece of app data owned by this user. The Firebase Auth account
// itself is deleted client-side afterward (firebase/auth's deleteUser can
// self-delete the currently signed-in user without admin privileges) — this
// endpoint must run first, while the caller's token is still valid.
export async function deleteAccount(req: AuthedRequest, res: Response) {
  const firebaseUid = req.userId;

  await Promise.all([
    Task.deleteMany({ firebaseUid }),
    Goal.deleteMany({ firebaseUid }),
    Habit.deleteMany({ firebaseUid }),
    Settings.deleteMany({ firebaseUid }),
    Plan.deleteMany({ firebaseUid }),
    CoachMessage.deleteMany({ firebaseUid }),
  ]);

  res.status(204).send();
}
