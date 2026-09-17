import { beginMutation, endMutation } from '@/utils/pendingMutations';

const DEV_API_URL = 'http://localhost:4000/api';
const PRODUCTION_API_URL = 'https://i-planner-production.up.railway.app/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_API_URL : PRODUCTION_API_URL);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
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
      if (err instanceof Error && err.name === 'AbortError') {
        throw { message: 'The server took too long to respond. Try again in a moment.', field: 'general', status: 0 };
      }
      throw { message: 'Could not reach the server. Check your connection and try again.', field: 'general', status: 0 };
    } finally {
      clearTimeout(timeout);
    }

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