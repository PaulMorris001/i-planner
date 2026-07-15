import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { weekdayIndexMonday } from '@/utils/date';
import { parseTimeToMinutes } from '@/utils/time';
import type { ClassItem } from '@/types/plan.types';

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

// expo-calendar's recurrenceRule doesn't reliably support multi-weekday rules
// cross-platform, so weekly/weekdays classes get one event per dayIdxs entry
// (hence the array return) rather than one event with a compound rule.
export async function syncClassToAppleCalendar(item: ClassItem): Promise<string[]> {
  if (!(await hasPermission())) return [];
  const calendarId = await getWritableCalendarId();
  if (!calendarId) return [];

  const baseDate = new Date(item.startDate);
  const eventIds: string[] = [];

  try {
    if (!item.recurring) {
      const { start, end } = eventWindow(item.startDate, item.time, 60);
      eventIds.push(await Calendar.createEventAsync(calendarId, { title: item.courseName, startDate: start, endDate: end }));
      return eventIds;
    }

    if (item.freq === 'weekly' || item.freq === 'weekdays') {
      for (const wd of item.dayIdxs) {
        const occurrence = nextOccurrenceOnWeekday(baseDate, wd);
        const { start, end } = eventWindow(occurrence.toISOString(), item.time, 60);
        eventIds.push(
          await Calendar.createEventAsync(calendarId, {
            title: item.courseName,
            startDate: start,
            endDate: end,
            recurrenceRule: { frequency: Calendar.Frequency.WEEKLY },
          })
        );
      }
    } else {
      const { start, end } = eventWindow(item.startDate, item.time, 60);
      const frequency = item.freq === 'daily' ? Calendar.Frequency.DAILY : Calendar.Frequency.MONTHLY;
      eventIds.push(
        await Calendar.createEventAsync(calendarId, { title: item.courseName, startDate: start, endDate: end, recurrenceRule: { frequency } })
      );
    }
  } catch (err) {
    console.error('[appleCalendarSync] failed to sync class', err);
  }

  return eventIds;
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
}): Promise<string | null> {
  if (!task.dueDate) return null;
  if (!(await hasPermission())) return null;
  const calendarId = await getWritableCalendarId();
  if (!calendarId) return null;

  try {
    const { start, end } = eventWindow(task.dueDate, task.time, 30);
    return await Calendar.createEventAsync(calendarId, {
      title: task.title,
      startDate: start,
      endDate: end,
      notes: task.notes || undefined,
    });
  } catch (err) {
    console.error('[appleCalendarSync] failed to sync task', err);
    return null;
  }
}
