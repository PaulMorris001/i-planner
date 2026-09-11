// A single, app-wide count of in-flight non-GET API requests (POST/PUT/
// PATCH/DELETE) — tracked centrally in services/api.ts, which every service
// in the app funnels through. Every mutating context (Tasks, Plan, Habits,
// etc.) applies its edit to local state optimistically, *then* persists it
// with one of these requests — so "a mutation is pending" means "some
// context's local state is currently ahead of the server."
//
// Consumed by RefetchOnForeground and ScreenWrapper's pull-to-refresh: both
// re-fetch from the server, and a GET landing *during* that window would
// return stale pre-edit data and stomp the correct optimistic state — the
// edit visually "reverts" until the next real refetch. Waiting here first
// closes that race instead of just accepting it.
let pending = 0;

export function beginMutation(): void {
  pending += 1;
}

export function endMutation(): void {
  pending = Math.max(0, pending - 1);
}

export function hasPendingMutations(): boolean {
  return pending > 0;
}

// Resolves once nothing is in flight, or after `timeoutMs` — whichever comes
// first. The timeout exists so one stuck/never-settling request (say, a
// network drop mid-request that somehow never reaches apiRequest's own
// timeout) can't permanently block every future refetch — refetching once
// against possibly-stale-but-eventually-consistent data beats refusing to
// ever refetch again.
export function waitForNoPendingMutations(timeoutMs = 4000): Promise<void> {
  if (!hasPendingMutations()) return Promise.resolve();
  return new Promise((resolve) => {
    const start = Date.now();
    const interval = setInterval(() => {
      if (!hasPendingMutations() || Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve();
      }
    }, 150);
  });
}
