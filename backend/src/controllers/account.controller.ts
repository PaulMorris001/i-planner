import { Response } from 'express';
import { Task } from '../models/Task';
import { Goal } from '../models/Goal';
import { Habit } from '../models/Habit';
import { Settings } from '../models/Settings';
import { Plan } from '../models/Plan';
import { CoachMessage } from '../models/CoachMessage';
import { Subscription } from '../models/Subscription';
import { Syllabus } from '../models/Syllabus';
import { AiUsage } from '../models/AiUsage';
import { Bill } from '../models/Bill';
import { SavingsGoal } from '../models/SavingsGoal';
import { Note } from '../models/Note';
import { Folder } from '../models/Folder';
import { SharedNote } from '../models/SharedNote';
import { SharedNoteImport } from '../models/SharedNoteImport';
import { SharedFolder } from '../models/SharedFolder';
import { SharedFolderImport } from '../models/SharedFolderImport';
import { ImportedCalendarEvent } from '../models/ImportedCalendarEvent';
import { KnownDevice } from '../models/KnownDevice';
import { PushToken } from '../models/PushToken';
import { ReferralProfile } from '../models/ReferralProfile';
import { Referral } from '../models/Referral';
import { PointEvent } from '../models/PointEvent';
import { NoteMember } from '../models/NoteMember';
import { StudySession } from '../models/StudySession';
import { StudyRun } from '../models/StudyRun';
import { AuthedRequest } from '../middleware/requireAuth';

// Wipes every piece of app data owned by this user. Firebase Auth account deletion
// happens client-side afterward — must run first, while the caller's token is still valid.
export async function deleteAccount(req: AuthedRequest, res: Response) {
  const firebaseUid = req.userId;

  await Promise.all([
    Task.deleteMany({ firebaseUid }),
    Goal.deleteMany({ firebaseUid }),
    Habit.deleteMany({ firebaseUid }),
    Settings.deleteMany({ firebaseUid }),
    Plan.deleteMany({ firebaseUid }),
    CoachMessage.deleteMany({ firebaseUid }),
    Subscription.deleteMany({ firebaseUid }),
    Syllabus.deleteMany({ firebaseUid }),
    AiUsage.deleteMany({ firebaseUid }),
    Bill.deleteMany({ firebaseUid }),
    SavingsGoal.deleteMany({ firebaseUid }),
    Note.deleteMany({ firebaseUid }),
    Folder.deleteMany({ firebaseUid }),
    SharedNote.deleteMany({ firebaseUid }),
    SharedNoteImport.deleteMany({ firebaseUid }),
    SharedFolder.deleteMany({ firebaseUid }),
    SharedFolderImport.deleteMany({ firebaseUid }),
    ImportedCalendarEvent.deleteMany({ firebaseUid }),
    KnownDevice.deleteMany({ firebaseUid }),
    PushToken.deleteMany({ firebaseUid }),
    // Their own code and points, and the records of referrals they made or came from.
    // Points already paid to the other side of a referral stay with that person.
    ReferralProfile.deleteMany({ firebaseUid }),
    PointEvent.deleteMany({ firebaseUid }),
    // Their notes' collaborators lose access with the notes, and any note shared with them stops listing them.
    NoteMember.deleteMany({ $or: [{ ownerUid: firebaseUid }, { memberUid: firebaseUid }] }),
    StudySession.deleteMany({ firebaseUid }),
    StudyRun.deleteMany({ firebaseUid }),
    Referral.deleteMany({ $or: [{ referrerUid: firebaseUid }, { referredUid: firebaseUid }] }),
  ]);

  res.status(204).send();
}
