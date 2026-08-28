import { Response } from 'express';
import { ImportedCalendarEvent, toPublicImportedCalendarEvent } from '../models/ImportedCalendarEvent';
import { Settings } from '../models/Settings';
import { Task } from '../models/Task';
import { Plan } from '../models/Plan';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { listPrimaryGoogleEvents } from '../services/googleCalendarSync';

// How far ahead to pull events on each import — keeps both the Google API call and
// the Apple-side local read bounded.
const IMPORT_WINDOW_DAYS = 60;

function importWindow(): { start: Date; end: Date } {
  const start = new Date();
  const end = new Date(start.getTime() + IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function listImportedEvents(req: AuthedRequest, res: Response) {
  const events = await ImportedCalendarEvent.find({ firebaseUid: req.userId }).sort({ startAt: 1 });
  res.json(events.map(toPublicImportedCalendarEvent));
}

export async function importGoogleEvents(req: AuthedRequest, res: Response) {
  const settings = await Settings.findOne({ firebaseUid: req.userId });
  if (!settings?.googleCalendarConnected) {
    throw new ApiError(400, 'Google Calendar is not connected.', 'general');
  }

  const { start, end } = importWindow();
  // Reads the user's "primary" calendar, not the dedicated "i-Planner" secondary
  // calendar this app syncs its own tasks/classes to, so those are excluded
  // automatically. A task created by CONVERTING an imported event is the exception —
  // createTaskDoc skips syncing it to the secondary calendar since it already points
  // at a real primary-calendar event — so it's filtered out below instead.
  const remoteEvents = await listPrimaryGoogleEvents(settings, start.toISOString(), end.toISOString());

  const ownedTasks = await Task.find(
    { firebaseUid: req.userId, googleEventId: { $exists: true, $ne: null } },
    'googleEventId'
  );
  const ownedGoogleEventIds = new Set(
    (ownedTasks as unknown as { googleEventId?: string }[]).map((t) => t.googleEventId).filter((id): id is string => !!id)
  );
  const incoming = remoteEvents.filter((e) => !ownedGoogleEventIds.has(e.id));

  await Promise.all(
    incoming.map((e) =>
      ImportedCalendarEvent.findOneAndUpdate(
        { firebaseUid: req.userId, source: 'google', externalId: e.id },
        {
          $set: {
            title: e.title,
            startAt: e.startAt,
            endAt: e.endAt,
            allDay: e.allDay,
            location: e.location,
          },
        },
        { upsert: true }
      )
    )
  );

  const events = await ImportedCalendarEvent.find({ firebaseUid: req.userId }).sort({ startAt: 1 });
  res.json(events.map(toPublicImportedCalendarEvent));
}

interface IncomingAppleEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

// Minimal shape to check whether an Apple event id is one this app already wrote —
// only appleEventIds matters here, Task/class schemas have more fields.
interface HasAppleEventIds {
  appleEventIds?: string[];
}

export async function importAppleEvents(req: AuthedRequest, res: Response) {
  const { events } = req.body ?? {};
  if (!Array.isArray(events)) {
    throw new ApiError(400, 'events must be an array.', 'general');
  }

  // Apple writes land in the same default device calendar as the user's real
  // appointments (no dedicated sync calendar like the Google side), so this can't
  // exclude the app's own output by calendar alone — filter by recorded ids instead.
  const [tasks, studentPlan] = await Promise.all([
    Task.find({ firebaseUid: req.userId, appleEventIds: { $exists: true, $ne: [] } }, 'appleEventIds'),
    Plan.findOne({ firebaseUid: req.userId, pathType: 'student' }),
  ]);
  const ownedAppleEventIds = new Set<string>();
  for (const t of tasks as unknown as HasAppleEventIds[]) {
    for (const id of t.appleEventIds ?? []) ownedAppleEventIds.add(id);
  }
  const classes = (studentPlan?.data as { classes?: HasAppleEventIds[] } | undefined)?.classes ?? [];
  for (const c of classes) {
    for (const id of c.appleEventIds ?? []) ownedAppleEventIds.add(id);
  }

  const incoming = (events as IncomingAppleEvent[]).filter((e) => e?.id && !ownedAppleEventIds.has(e.id));

  await Promise.all(
    incoming.map((e) =>
      ImportedCalendarEvent.findOneAndUpdate(
        { firebaseUid: req.userId, source: 'apple', externalId: e.id },
        {
          $set: {
            title: e.title,
            startAt: e.startAt,
            endAt: e.endAt,
            allDay: !!e.allDay,
            location: e.location,
          },
        },
        { upsert: true }
      )
    )
  );

  const stored = await ImportedCalendarEvent.find({ firebaseUid: req.userId }).sort({ startAt: 1 });
  res.json(stored.map(toPublicImportedCalendarEvent));
}

// Also used by the client right after converting an event to a task — there's no
// separate "convert" endpoint; conversion is just create-task-then-delete-this-row.
export async function deleteImportedEvent(req: AuthedRequest, res: Response) {
  const { id } = req.params;
  await ImportedCalendarEvent.deleteOne({ _id: id, firebaseUid: req.userId });
  res.status(204).send();
}
