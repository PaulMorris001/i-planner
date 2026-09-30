import { Settings, SettingsDocument } from '../models/Settings';
import { Plan } from '../models/Plan';
import { Task } from '../models/Task';
import * as google from './googleCalendarSync';
import * as outlook from './microsoftCalendarSync';
import { SyncableClassItem, SyncableTaskItem } from './calendarEventTime';

// Single entry point for write-syncing tasks/classes to every connected cloud
// calendar (Google + Outlook). Apple sync is separate — it runs on-device.
// Every function here is best-effort: a calendar API failure is logged, never
// thrown, so it can't break saving the task/class itself.

export type CalendarProvider = 'google' | 'outlook';

const PROVIDERS = {
  google: {
    idField: 'googleEventId',
    isConnected: (s: SettingsDocument) => !!s.googleCalendarConnected,
    upsertTask: google.upsertTaskEvent,
    deleteTask: google.deleteTaskEvent,
    upsertClass: google.upsertClassEvent,
    deleteClass: google.deleteClassEvent,
  },
  outlook: {
    idField: 'outlookEventId',
    isConnected: (s: SettingsDocument) => !!s.outlookCalendarConnected,
    upsertTask: outlook.upsertTaskEvent,
    deleteTask: outlook.deleteTaskEvent,
    upsertClass: outlook.upsertClassEvent,
    deleteClass: outlook.deleteClassEvent,
  },
} as const;

const ALL_PROVIDERS: CalendarProvider[] = ['google', 'outlook'];

function connectedProviders(settings: SettingsDocument | null): CalendarProvider[] {
  return settings ? ALL_PROVIDERS.filter((p) => PROVIDERS[p].isConnected(settings)) : [];
}

export interface SyncableTask extends SyncableTaskItem {
  calendarLinkExternal?: boolean;
}

export interface ClassRecord extends SyncableClassItem {
  id: string;
}

async function syncTaskWith(settings: SettingsDocument, task: SyncableTask, providers: CalendarProvider[]) {
  for (const provider of providers) {
    const p = PROVIDERS[provider];
    try {
      if (!task.dueDate) {
        // An edit that cleared dueDate leaves nothing to show — remove the
        // event rather than leaving it orphaned on the calendar.
        if (task[p.idField]) await p.deleteTask(settings, task);
        task[p.idField] = undefined;
      } else {
        task[p.idField] = await p.upsertTask(settings, task);
      }
    } catch (err) {
      console.error(`[calendarSync] ${provider} task sync failed`, err);
    }
  }
}

// Mutates task.googleEventId / task.outlookEventId in place; caller saves.
// A task converted from an imported event (calendarLinkExternal) points at an
// event the app doesn't own, so it's never written to any calendar.
export async function syncTaskToCalendars(firebaseUid: string, task: SyncableTask): Promise<void> {
  if (task.calendarLinkExternal) return;
  const settings = await Settings.findOne({ firebaseUid });
  await syncTaskWith(settings!, task, connectedProviders(settings));
}

export async function unsyncTaskFromCalendars(firebaseUid: string, task: SyncableTask): Promise<void> {
  if (task.calendarLinkExternal) return;
  if (!task.googleEventId && !task.outlookEventId) return;
  const settings = await Settings.findOne({ firebaseUid });
  for (const provider of connectedProviders(settings)) {
    try {
      await PROVIDERS[provider].deleteTask(settings!, task);
    } catch (err) {
      console.error(`[calendarSync] ${provider} task delete failed`, err);
    }
  }
}

function classChanged(old: ClassRecord, item: ClassRecord): boolean {
  return (
    old.courseName !== item.courseName ||
    old.startDate !== item.startDate ||
    old.endDate !== item.endDate ||
    old.recurring !== item.recurring ||
    old.freq !== item.freq ||
    old.time !== item.time ||
    old.professor !== item.professor ||
    old.venue !== item.venue ||
    JSON.stringify(old.dayIdxs) !== JSON.stringify(item.dayIdxs)
  );
}

// All frontend class call sites funnel through savePlan, so this is the single
// choke point for class sync. Mutates newClasses' event ids in place, before
// the plan is persisted. Event ids are server-authoritative — always carried
// over from the stored plan, never trusted from the client body.
export async function syncClassesToCalendars(firebaseUid: string, newClasses: ClassRecord[]): Promise<void> {
  const settings = await Settings.findOne({ firebaseUid });
  const providers = connectedProviders(settings);
  if (!providers.length) return;

  const existingPlan = await Plan.findOne({ firebaseUid, pathType: 'student' });
  const existingData = existingPlan?.data as { classes?: ClassRecord[] } | undefined;
  const oldClasses: ClassRecord[] = Array.isArray(existingData?.classes) ? existingData.classes : [];
  const oldById = new Map(oldClasses.map((c) => [c.id, c]));
  const newIds = new Set(newClasses.map((c) => c.id));

  for (const old of oldClasses) {
    if (newIds.has(old.id)) continue;
    for (const provider of providers) {
      try {
        await PROVIDERS[provider].deleteClass(settings!, old);
      } catch (err) {
        console.error(`[calendarSync] ${provider} class delete failed`, err);
      }
    }
  }

  for (const item of newClasses) {
    const old = oldById.get(item.id);
    item.googleEventId = old?.googleEventId;
    item.outlookEventId = old?.outlookEventId;
    const changed = !old || classChanged(old, item);
    for (const provider of providers) {
      const p = PROVIDERS[provider];
      // Also retries a class whose earlier sync failed (no event id yet).
      if (!changed && item[p.idField]) continue;
      try {
        item[p.idField] = await p.upsertClass(settings!, item);
      } catch (err) {
        console.error(`[calendarSync] ${provider} class sync failed`, err);
      }
    }
  }
}

// Pushes every existing class and task to a just-connected calendar. Runs in
// the background after the OAuth redirect, so it re-reads the plan before
// writing ids back and only $sets the id field on tasks — a concurrent edit by
// the user in the meantime is never clobbered.
export async function backfillCalendar(firebaseUid: string, provider: CalendarProvider): Promise<void> {
  const p = PROVIDERS[provider];
  try {
    const settings = await Settings.findOne({ firebaseUid });
    if (!settings || !p.isConnected(settings)) return;

    const plan = await Plan.findOne({ firebaseUid, pathType: 'student' });
    const classes = (plan?.data as { classes?: ClassRecord[] } | undefined)?.classes;
    const classIds = new Map<string, string | undefined>();
    for (const item of Array.isArray(classes) ? classes : []) {
      const eventId = await p.upsertClass(settings, item);
      if (eventId !== item[p.idField]) classIds.set(item.id, eventId);
    }
    if (classIds.size) {
      const fresh = await Plan.findOne({ firebaseUid, pathType: 'student' });
      const freshClasses = (fresh?.data as { classes?: ClassRecord[] } | undefined)?.classes;
      if (fresh && Array.isArray(freshClasses)) {
        for (const c of freshClasses) {
          if (classIds.has(c.id)) c[p.idField] = classIds.get(c.id);
        }
        fresh.markModified('data');
        await fresh.save();
      }
    }

    const tasks = await Task.find({ firebaseUid, dueDate: { $ne: '' }, calendarLinkExternal: { $ne: true } });
    for (const task of tasks) {
      const eventId = await p.upsertTask(settings, task);
      if (eventId !== task[p.idField]) {
        await Task.updateOne({ _id: task._id }, eventId ? { $set: { [p.idField]: eventId } } : { $unset: { [p.idField]: '' } });
      }
    }
  } catch (err) {
    console.error(`[calendarSync] ${provider} backfill failed`, err);
  }
}
