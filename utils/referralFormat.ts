// Points as shown next to the flame in the header: "950", "1.2k", "12k", "1.2M".
// Compact so even huge totals stay a few characters wide.
export function formatPoints(points: number): string {
  const n = Math.max(0, Math.floor(points));
  const short = (value: number, unit: string) => `${(Math.floor(value * 10) / 10).toString().replace(/\.0$/, '')}${unit}`;
  if (n < 1000) return String(n);
  if (n < 10_000) return short(n / 1000, 'k');
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`;
  if (n < 10_000_000) return short(n / 1_000_000, 'M');
  if (n < 1_000_000_000) return `${Math.floor(n / 1_000_000)}M`;
  return short(n / 1_000_000_000, 'B');
}

// "ABCD2345" -> "ABCD 2345" for reading and reading aloud. The copied/shared
// value is always the plain code.
export function formatReferralCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)} ${code.slice(4)}` : code;
}

export function friendsLabel(count: number): string {
  return count === 1 ? '1 friend joined' : `${count} friends joined`;
}

// "Resets in 3d 4h" / "Resets in 5h" / "Resets in 20m" for the weekly leaderboard.
export function formatResetsIn(weekEndIso: string, now: number = Date.now()): string {
  const ms = Date.parse(weekEndIso) - now;
  if (!Number.isFinite(ms) || ms <= 0) return 'Resetting now';
  const minutes = Math.floor(ms / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) return `Resets in ${days}d ${hours}h`;
  if (hours > 0) return `Resets in ${hours}h`;
  return `Resets in ${Math.max(1, minutes)}m`;
}
