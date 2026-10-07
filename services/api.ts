import { beginMutation, endMutation } from '@/utils/pendingMutations';

const DEV_API_URL = 'http://localhost:4000/api';
const PRODUCTION_API_URL = 'https://api.i-plannerapp.com/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_API_URL : PRODUCTION_API_URL);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string;
  timeoutMs?: number;
  // Called with 0..1 as the request body uploads — for file uploads that show a
  // real progress bar. Setting it switches the request to XMLHttpRequest,
  // since React Native's fetch can't report upload progress.
  onUploadProgress?: (fraction: number) => void;
}

const TIMEOUT_ERROR = { message: 'The server took too long to respond. Try again in a moment.', field: 'general', status: 0 };
const NETWORK_ERROR = { message: 'Could not reach the server. Check your connection and try again.', field: 'general', status: 0 };

// Same contract as the fetch path below (resolves with status + raw body text,
// throws the same error shapes), plus upload progress events.
function xhrRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
  onUploadProgress: (fraction: number) => void
): Promise<{ ok: boolean; status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.timeout = timeoutMs;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onUploadProgress(Math.min(1, event.loaded / event.total));
    };
    xhr.onload = () => {
      onUploadProgress(1);
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, text: xhr.responseText ?? '' });
    };
    xhr.ontimeout = () => reject(TIMEOUT_ERROR);
    xhr.onerror = () => reject(NETWORK_ERROR);
    onUploadProgress(0);
    xhr.send(body ?? null);
  });
}

const DEFAULT_TIMEOUT_MS = 60_000;

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS, onUploadProgress } = options;
  const isMutation = method !== 'GET';
  if (isMutation) beginMutation();

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${BASE_URL}${endpoint}`;
    const payload = body ? JSON.stringify(body) : undefined;
    let response: { ok: boolean; status: number; text: string };

    if (onUploadProgress) {
      response = await xhrRequest(url, method, headers, payload, timeoutMs, onUploadProgress);
    } else {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { method, headers, body: payload, signal: controller.signal });
        response = { ok: res.ok, status: res.status, text: await res.text() };
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw TIMEOUT_ERROR;
        throw NETWORK_ERROR;
      } finally {
        clearTimeout(timeout);
      }
    }

    const raw = response.text;
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      throw {
        message: data?.message ?? 'Something went wrong.',
        field: data?.field ?? 'general',
        status: response.status,
        // The whole error body, for the few responses that carry more than a message
        // (a note save refused because someone else changed it returns the latest note).
        data,
      };
    }

    return data as T;
  } finally {
    if (isMutation) endMutation();
  }
}