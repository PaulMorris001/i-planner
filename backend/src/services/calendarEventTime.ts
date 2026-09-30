// Provider-agnostic event-time math shared by googleCalendarSync.ts and
// microsoftCalendarSync.ts, so a task/class lands at the same local wall-clock
// time, on the same days, on both calendars.

export type SyncFreq = 'weekly' | 'weekdays' | 'daily' | 'monthly';

// Minimal shapes the sync services need — Classes are a schemaless blob
// (Plan.data.classes) and this backend doesn't share a types package with the app.
export interface SyncableClassItem {
  courseName: string;
  startDate: string;
  // Recurrence cutoff (e.g. last day of semester) — absent means recur forever.
  endDate?: string;
  recurring: boolean;
  freq: SyncFreq;
  dayIdxs: number[]; // Monday-start, 0=Mon..6=Sun
  time: string;
  professor?: string;
  venue?: string;
  googleEventId?: string;
  outlookEventId?: string;
}

export interface SyncableTaskItem {
  title: string;
  dueDate: string;
  time?: string;
  notes?: string;
  recurring?: boolean;
  freq?: 'weekly' | 'weekdays' | 'daily';
  dayIdxs?: number[];
  googleEventId?: string;
  outlookEventId?: string;
}

// Thrown when a provider rejects the stored refresh token (revoked access,
// password change, Google "Testing"-mode 7-day expiry, ...). Callers mark the
// connection as needing reconnect instead of silently failing forever.
export class CalendarReauthRequiredError extends Error {
  constructor(public provider: 'google' | 'outlook') {
    super(`${provider} calendar access was revoked or expired.`);
  }
}

// Parses "9:00 AM"-style strings; unparseable/empty falls back to 9:00 AM.
export function parseTime(time: string | undefined): { hour: number; minute: number } {
  const match = time?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return { hour: 9, minute: 0 };
  let hour = parseInt(match[1], 10);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem) {
    hour %= 12;
    if (meridiem === 'PM') hour += 12;
  }
  return { hour: Math.min(hour, 23), minute: parseInt(match[2], 10) };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

// Formats a UTC-arithmetic instant back into a floating "wall clock" string with no
// offset — Date.UTC/getUTC* here is just deterministic minute arithmetic, not a real
// instant, so this is unaffected by the server's own TZ.
function formatFloating(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00`;
}

// dueDate/startDate is either a plain "YYYY-MM-DD" (digits ARE the calendar day)
// or a full timestamp from a date picker (an arbitrary real moment). Naive
// slicing only works for the first case — for the second, those digits are the
// instant's UTC day, which can differ from the user's local day (e.g. a
// late-evening pick rolls into the next UTC day). Resolve via stored timeZone.
export function localDatePart(dateIso: string, timeZone: string): string {
  if (!dateIso.includes('T')) return dateIso.slice(0, 10);
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso.slice(0, 10);
  // en-CA formats as YYYY-MM-DD, exactly what this needs.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function dateOnlyToUtcMs(datePart: string): number {
  return Date.UTC(Number(datePart.slice(0, 4)), Number(datePart.slice(5, 7)) - 1, Number(datePart.slice(8, 10)));
}

// Monday-start weekday index (0=Mon..6=Sun) of a floating date.
function weekdayIdx(ms: number): number {
  return (new Date(ms).getUTCDay() + 6) % 7;
}

// A weekly rule's first instance is its DTSTART even when that day isn't one
// of the rule's weekdays — so a class starting on a Wednesday that meets Mon/Tue
// would get a stray Wednesday occurrence. Advance to the first matching day.
function alignToWeekdays(dayMs: number, freq: SyncFreq | undefined, dayIdxs: number[] | undefined): number {
  if ((freq !== 'weekly' && freq !== 'weekdays') || !dayIdxs?.length) return dayMs;
  const start = weekdayIdx(dayMs);
  const offset = Math.min(...dayIdxs.map((d) => (d - start + 7) % 7));
  return dayMs + offset * 86_400_000;
}

export interface EventWindow {
  start: string; // floating "YYYY-MM-DDTHH:mm:00", interpreted in timeZone
  end: string;
  startDate: string; // "YYYY-MM-DD" of start
  dayOfMonth: number;
}

// Builds floating (no-offset) local datetime strings. Paired with an explicit IANA
// timeZone by each provider, the hour/minute is interpreted literally in the
// user's timezone rather than as a UTC instant — "9:00 AM" lands at 9 AM local.
export function buildEventWindow(
  dateIso: string,
  time: string | undefined,
  durationMinutes: number,
  timeZone: string,
  recurrence?: { freq?: SyncFreq; dayIdxs?: number[] }
): EventWindow {
  const { hour, minute } = parseTime(time);
  const dayMs = alignToWeekdays(dateOnlyToUtcMs(localDatePart(dateIso, timeZone)), recurrence?.freq, recurrence?.dayIdxs);
  const startMs = dayMs + (hour * 60 + minute) * 60_000;
  const endMs = startMs + durationMinutes * 60_000;
  const start = formatFloating(startMs);
  return { start, end: formatFloating(endMs), startDate: start.slice(0, 10), dayOfMonth: new Date(dayMs).getUTCDate() };
}

// Offset (ms) of timeZone from UTC at a given instant.
function tzOffsetMs(utcMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utcMs;
}

// The real UTC instant of 23:59:59 local time on a "YYYY-MM-DD" date — used as
// a recurrence's inclusive UNTIL so the last class on endDate still happens.
export function endOfLocalDayUtc(dateIso: string, timeZone: string): Date | undefined {
  const datePart = localDatePart(dateIso, timeZone);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return undefined;
  const wallMs = dateOnlyToUtcMs(datePart) + 86_399_000;
  try {
    // Two passes settle the offset correctly across a DST boundary.
    let utcMs = wallMs - tzOffsetMs(wallMs, timeZone);
    utcMs = wallMs - tzOffsetMs(utcMs, timeZone);
    return new Date(utcMs);
  } catch {
    return new Date(wallMs);
  }
}

// Recurrence end as a plain local "YYYY-MM-DD" (Outlook's range.endDate format).
export function recurrenceEndDate(endDate: string | undefined, timeZone: string): string | undefined {
  if (!endDate) return undefined;
  const datePart = localDatePart(endDate, timeZone);
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : undefined;
}
