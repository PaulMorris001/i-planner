import { beginMutation, endMutation } from '@/utils/pendingMutations';

// EXPO_PUBLIC_API_URL, if set, always wins (useful for pointing a dev build at
// staging/production, or production at a different host). Otherwise this falls
// back automatically based on __DEV__: localhost while running via `expo start`,
// the deployed Railway backend in a production build.
const DEV_API_URL = 'http://localhost:4000/api';
const PRODUCTION_API_URL = 'https://i-planner-planner-env.up.railway.app/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_API_URL : PRODUCTION_API_URL);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string;
  // A hung/unreachable backend (e.g. mid-migration, cold-starting, or just
  // down) previously left every caller's `await` unresolved forever with no
  // error and no way to recover short of restarting the app — this bounds
  // that. 60s default covers slower calls (AI generation) without making a
  // fast endpoint wait a full minute to report a real outage.
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  // Tracked for the whole round trip (not just the fetch itself) — a mutating
  // context's local state stays ahead of the server until this resolves or
  // throws, and RefetchOnForeground/pull-to-refresh need to know that so they
  // don't GET stale data mid-write and stomp a correct optimistic update.
  // See utils/pendingMutations.ts.
  const isMutation = method !== 'GET';
  if (isMutation) beginMutation();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      // AbortError specifically means the timeout fired, not a real network
      // failure — worth a distinct message so it doesn't read as "check your
      // internet" when the actual problem is a slow/unreachable backend.
      if (err instanceof Error && err.name === 'AbortError') {
        throw { message: 'The server took too long to respond. Try again in a moment.', field: 'general', status: 0 };
      }
      throw { message: 'Could not reach the server. Check your connection and try again.', field: 'general', status: 0 };
    } finally {
      clearTimeout(timeout);
    }

    // Delete endpoints reply 204 with an empty body — response.json() throws on
    // that ("Unexpected end of input"), so parse manually and treat empty as null.
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      throw {
        message: data?.message ?? 'Something went wrong.',
        field: data?.field ?? 'general',
        status: response.status,
      };
    }

    return data as T;
  } finally {
    if (isMutation) endMutation();
  }
}