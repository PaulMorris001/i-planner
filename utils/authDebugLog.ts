// Temporary diagnostic aid for the "session doesn't survive an app restart"
// bug (Aug 2026) — there's no way to read device console output without a
// Mac, so this collects a timeline of the session-restore path in memory and
// login.tsx renders it directly on screen. Delete this file, its call sites,
// and the debug panel in login.tsx once that bug is confirmed fixed.
interface LogEntry {
  t: number;
  msg: string;
}

const entries: LogEntry[] = [];
const startedAt = Date.now();

export function logAuthDebug(msg: string): void {
  entries.push({ t: Date.now() - startedAt, msg });
}

export function getAuthDebugLog(): string[] {
  return entries.map((e) => `+${e.t}ms  ${e.msg}`);
}
