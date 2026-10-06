// Tells the points total (ReferralContext) that something which can earn points was
// just saved, so it re-reads the total from the server and the flame badge updates
// right away instead of on the next app open.

// Endpoints whose writes can award points (see backend/src/constants/points.ts).
const POINT_EARNING_PREFIXES = ['/tasks', '/habits', '/goals', '/bills', '/savings-goals'];

type Listener = () => void;
const listeners = new Set<Listener>();

export function onPointsMayHaveChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function signalPointsMayHaveChanged(): void {
  listeners.forEach((listener) => listener());
}

// Called by the request helper after a request succeeds.
export function signalIfPointEarning(endpoint: string, method: string | undefined): void {
  if (!method || method === 'GET') return;
  if (POINT_EARNING_PREFIXES.some((prefix) => endpoint === prefix || endpoint.startsWith(`${prefix}/`) || endpoint.startsWith(`${prefix}?`))) {
    signalPointsMayHaveChanged();
  }
}
