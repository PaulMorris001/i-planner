import { auth } from '@/lib/firebase';

const API_URL = (import.meta.env.VITE_API_URL ?? 'https://api.i-plannerapp.com/api').replace(/\/+$/, '');
const TIMEOUT_MS = 60_000;

export interface ApiError {
  message: string;
  field: string;
  status: number;
}

// Lets the app react when the server says the signed-in account is no longer allowed in (the admin
// role was removed, or the account was suspended): the auth provider signs out.
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

// One call to the backend with the signed-in admin's ID token. Failures are thrown as ApiError
// (message the person can read, HTTP status), including network problems and timeouts.
export async function apiRequest<T>(path: string, options: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw { message: 'Your session has ended. Please sign in again.', field: 'general', status: 401 } satisfies ApiError;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'AbortError';
    throw {
      message: timedOut ? 'The server took too long to respond. Try again in a moment.' : 'Could not reach the server. Check your connection.',
      field: 'general',
      status: 0,
    } satisfies ApiError;
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data: { message?: string; field?: string } | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    // The admin API answers 404 to anyone without the role, and 401/403 for a dead session.
    if (response.status === 401 || response.status === 403 || (response.status === 404 && path.startsWith('/admin/me'))) {
      unauthorizedHandler?.();
    }
    throw { message: data?.message ?? 'Something went wrong.', field: data?.field ?? 'general', status: response.status } satisfies ApiError;
  }
  return data as T;
}

export function errorMessage(err: unknown, fallback = 'Something went wrong. Try again.'): string {
  return (err as { message?: string } | null)?.message || fallback;
}
