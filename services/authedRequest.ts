import { auth } from '@/config/firebase';
import { apiRequest } from './api';

type ApiRequestOptions = Parameters<typeof apiRequest>[1];

export async function authedRequest<T>(
  endpoint: string,
  options: Omit<ApiRequestOptions, 'token'> = {}
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  return apiRequest<T>(endpoint, { ...options, token });
}
