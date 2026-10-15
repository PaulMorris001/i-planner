export function formatCount(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

// "5 min ago", "3 d ago"; older than a month becomes a date.
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'never';
  const ms = now - Date.parse(iso);
  if (!Number.isFinite(ms)) return 'never';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// "Resets in 3d 4h" for the weekly leaderboard.
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

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function initials(name: string): string {
  return (
    (name.trim() || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}
