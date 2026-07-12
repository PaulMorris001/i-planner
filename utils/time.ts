// Parses "9:30 AM"-style strings into minutes-since-midnight for sorting.
// Unparseable/empty times sort last rather than to the top.
export function parseTimeToMinutes(time: string): number {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 24 * 60;
  let hour = parseInt(match[1], 10) % 12;
  if (match[3]?.toUpperCase() === 'PM') hour += 12;
  return hour * 60 + parseInt(match[2], 10);
}
