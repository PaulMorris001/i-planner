import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { weekdayIndexMonday } from '@/utils/date';
import { parseTimeToMinutes } from '@/utils/time';
import type { ClassItem } from '@/types/plan.types';
import type { TaskFrequency } from '@/types/task.types';

// expo-calendar is a native module — there's no server-reachable "Apple Calendar
// API," so this sync runs client-side, unlike the Google side which is entirely
// backend-driven. Every function checks permission itself and no-ops cleanly when
// not granted, so callers never need their own connected-check.

async function hasPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}

async function getWritableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    try {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar?.allowsModifications) return defaultCalendar.id;
    } catch {
      // No default calendar available — fall through to the generic lookup below.
    }
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  return writable?.id ?? null;
}

function eventWindow(dateIso: string, time: string | undefined, durationMinutes: number) {
  const minutes = parseTimeToMinutes(time || '9:00 AM');
  const start = new Date(dateIso);
  start.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

// The first occurrence of `weekdayIdx` (Monday-start, 0=Mon..6=Sun) on or after
// startDate — a WEEKLY recurrence rule repeats on whatever weekday its own start
// date falls on, so each dayIdxs entry needs its own correctly-seeded start date.
function nextOccurrenceOnWeekday(startDate: Date, weekdayIdx: number): Date {
  const startWd = weekdayIndexMonday(startDate);
  const diff = (weekdayIdx - startWd + 7) % 7;
  const d = new Date(startDate);
  d.setDate(d.getDate() + diff);
  return d;
}

interface RecurrenceInput {
  title: string;
  baseDateIso: string;
  time: string | undefined;
  durationMinutes: number;
  recurring: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily' | 'monthly';
  dayIdxs?: number[];
  notes?: string;
}

// Shared by classes and tasks — expo-calendar's recurrenceRule doesn't reliably
// support multi-weekday rules cross-platform, so weekly/weekdays entries get one
// event per dayIdxs occurrence (hence the array return) rather than one event
// with a compound rule. daily/monthly get a single event with a simple rule.
async function createRecurringEvents(calendarId: string, input: RecurrenceInput): Promise<string[]> {
  const { title, baseDateIso, time, durationMinutes, recurring, freq, dayIdxs, notes } = input;

  if (!recurring || !freq) {
    const { start, end } = eventWindow(baseDateIso, time, durationMinutes);
    return [await Calendar.createEventAsync(calendarId, { title, startDate: start, endDate: end, notes })];
  }

  const eventIds: string[] = [];

  if (freq === 'weekly' || freq === 'weekdays') {
    for (const wd of dayIdxs ?? []) {
      const occurrence = nextOccurrenceOnWeekday(new Date(baseDateIso), wd);
      const { start, end } = eventWindow(occurrence.toISOString(), time, durationMinutes);
      eventIds.push(
        await Calendar.createEventAsync(calendarId, {
          title,
          startDate: start,
          endDate: end,
          notes,
          recurrenceRule: { frequency: Calendar.Frequency.WEEKLY },
        })
      );
    }
  } else {
    const { start, end } = eventWindow(baseDateIso, time, durationMinutes);
    const frequency = freq === 'daily' ? Calendar.Frequency.DAILY : Calendar.Frequency.MONTHLY;
    eventIds.push(
      await Calendar.createEventAsync(calendarId, { title, startDate: start, endDate: end, notes, recurrenceRule: { frequency } })
    );
  }

  return eventIds;
}

export async function syncClassToAppleCalendar(item: ClassItem): Promise<string[]> {
  if (!(await hasPermission())) return [];
  const calendarId = await getWritableCalendarId();
  if (!calendarId) return [];

  try {
    return await createRecurringEvents(calendarId, {
      title: item.courseName,
      baseDateIso: item.startDate,
      time: item.time,
      durationMinutes: 60,
      recurring: item.recurring,
      freq: item.freq,
      dayIdxs: item.dayIdxs,
    });
  } catch (err) {
    console.error('[appleCalendarSync] failed to sync class', err);
    return [];
  }
}

export async function deleteAppleEvents(eventIds: string[] | undefined): Promise<void> {
  if (!eventIds?.length) return;
  if (!(await hasPermission())) return;
  for (const id of eventIds) {
    try {
      await Calendar.deleteEventAsync(id);
    } catch {
      // Already deleted / not found — safe to ignore, same reconnect-safety
      // reasoning as the Google side's 404-on-update fallback.
    }
  }
}

export async function syncTaskToAppleCalendar(task: {
  title: string;
  dueDate: string;
  time?: string;
  notes?: string;
  recurring?: boolean;
  freq?: TaskFrequency;
  dayIdxs?: number[];
}): Promise<string[]> {
  if (!task.dueDate) return [];
  if (!(await hasPermission())) return [];
  const calendarId = await getWritableCalendarId();
  if (!calendarId) return [];

  try {
    return await createRecurringEvents(calendarId, {
      title: task.title,
      baseDateIso: task.dueDate,
      time: task.time,
      durationMinutes: 30,
      recurring: !!task.recurring,
      freq: task.freq,
      dayIdxs: task.dayIdxs,
      notes: task.notes,
    });
  } catch (err) {
    console.error('[appleCalendarSync] failed to sync task', err);
    return [];
  }
}
