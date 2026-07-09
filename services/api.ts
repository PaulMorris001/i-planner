// EXPO_PUBLIC_API_URL, if set, always wins (useful for pointing a dev build at
// staging/production, or production at a different host). Otherwise this falls
// back automatically based on __DEV__: localhost while running via `expo start`,
// the deployed Render backend in a production build.
const DEV_API_URL = 'http://localhost:4000/api';
const PRODUCTION_API_URL = 'https://i-planner.onrender.com/api';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? DEV_API_URL : PRODUCTION_API_URL);

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: Record<string, unknown>;
  token?: string;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();

  if (!response.ok) {
    throw {
      message: data?.message ?? 'Something went wrong.',
      field: data?.field ?? 'general',
      status: response.status,
    };
  }

  return data as T;
}