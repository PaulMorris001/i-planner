import type { StudySession } from '@/types/study.types';
import { DAY_SHORT } from '@/utils/date';

// 90 min -> "1 h 30 min", 50 h -> "50 h", 20 min -> "20 min", 0 -> "0 h".
export function formatStudyDuration(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0 && minutes === 0) return '0 h';
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

// The running timer: 3725000 -> "01:02:05".
export function formatClock(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// 1020 -> "5:00 PM".
export function formatMinuteOfDay(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function scheduleLabel(session: Pick<StudySession, 'days' | 'startMinute' | 'endMinute'>): string {
  if (session.startMinute === null || session.endMinute === null) return 'No schedule. Start it any time.';
  const days = session.days.length === 7 ? 'Every day' : session.days.map((d) => DAY_SHORT[d]).join(', ');
  const time = `${formatMinuteOfDay(session.startMinute)} to ${formatMinuteOfDay(session.endMinute)}`;
  return days ? `${days} · ${time}` : time;
}

// Monday 00:00 of the current week in the device's own time zone, as an ISO string.
export function localWeekStartIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// When a scheduled session should stop by itself: today's end time, if the session
// is scheduled for today and that time is still ahead. Otherwise null (it runs until stopped).
export function todaysAutoStop(
  session: Pick<StudySession, 'days' | 'endMinute'>,
  now: Date = new Date()
): string | null {
  if (session.endMinute === null) return null;
  const todayIdx = (now.getDay() + 6) % 7;
  if (!session.days.includes(todayIdx)) return null;
  const end = new Date(now);
  end.setHours(Math.floor(session.endMinute / 60), session.endMinute % 60, 0, 0);
  return end.getTime() > now.getTime() ? end.toISOString() : null;
}
