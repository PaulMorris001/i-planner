import { Response } from 'express';
import { ImportedCalendarEvent, toPublicImportedCalendarEvent } from '../models/ImportedCalendarEvent';
import { Settings, SettingsDocument } from '../models/Settings';
import { Task } from '../models/Task';
import { Plan } from '../models/Plan';
import { AuthedRequest } from '../middleware/requireAuth';
import { ApiError } from '../utils/ApiError';
import { listPrimaryGoogleEvents } from '../services/googleCalendarSync';
import { listPrimaryOutlookEvents } from '../services/microsoftCalendarSync';
import { CalendarReauthRequiredError } from '../services/calendarEventTime';

interface RemoteEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  location?: string;
}

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

// Shared by the Google and Outlook imports. Fetches the provider's default
// calendar, then makes the stored rows for that source match it exactly:
// upserts what's there, and prunes rows whose event was deleted/moved out of
// the window upstream (so the review list never shows ghosts). The provider
// fetch throws on failure, so a failed fetch can never wipe the list.
async function importFromProvider(
  req: AuthedRequest,
  source: 'google' | 'outlook',
  fetchEvents: (settings: SettingsDocument, startIso: string, endIso: string) => Promise<RemoteEvent[]>
) {
  const label = source === 'google' ? 'Google Calendar' : 'Outlook Calendar';
  const settings = await Settings.findOne({ firebaseUid: req.userId });
  const connected = source === 'google' ? settings?.googleCalendarConnected : settings?.outlookCalendarConnected;
  if (!settings || !connected) {
    const reauth = source === 'google' ? settings?.googleReauthRequired : settings?.outlookReauthRequired;
    throw new ApiError(400, reauth ? `${label} access expired — reconnect it in Profile → Calendar Sync.` : `${label} is not connected.`, 'general');
  }

  const { start, end } = importWindow();
  let remoteEvents: RemoteEvent[];
  try {
    remoteEvents = await fetchEvents(settings, start.toISOString(), end.toISOString());
  } catch (err) {
    if (err instanceof CalendarReauthRequiredError) {
      throw new ApiError(401, `${label} access expired — reconnect it in Profile → Calendar Sync.`, 'general');
    }
    console.error(`[calendarImport] ${source} fetch failed`, err);
    throw new ApiError(502, `Couldn't reach ${label}. Try again in a moment.`, 'general');
  }

  // Events the user already converted to a task — converting deletes the
  // ImportedCalendarEvent row (see NewTaskModal), so without this a re-import
  // would fetch the same event again and resurrect it. (The app's own synced
  // events live in the separate "i-Planner" calendar, so they never show up here.)
  const idField = source === 'google' ? 'googleEventId' : 'outlookEventId';
  const ownedTasks = await Task.find({ firebaseUid: req.userId, [idField]: { $exists: true, $ne: null } }, idField);
  const ownedIds = new Set(
    (ownedTasks as unknown as Record<string, string | undefined>[]).map((t) => t[idField]).filter((id): id is string => !!id)
  );
  const incoming = remoteEvents.filter((e) => !ownedIds.has(e.id));

  await Promise.all(
    incoming.map((e) =>
      ImportedCalendarEvent.findOneAndUpdate(
        { firebaseUid: req.userId, source, externalId: e.id },
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
  await ImportedCalendarEvent.deleteMany({
    firebaseUid: req.userId,
    source,
    externalId: { $nin: incoming.map((e) => e.id) },
  });

  const events = await ImportedCalendarEvent.find({ firebaseUid: req.userId }).sort({ startAt: 1 });
  return events.map(toPublicImportedCalendarEvent);
}

export async function importGoogleEvents(req: AuthedRequest, res: Response) {
  res.json(await importFromProvider(req, 'google', listPrimaryGoogleEvents));
}

export async function importOutlookEvents(req: AuthedRequest, res: Response) {
  res.json(await importFromProvider(req, 'outlook', listPrimaryOutlookEvents));
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
