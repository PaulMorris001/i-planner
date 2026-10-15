import { apiRequest } from '@/lib/api';
import type {
  AdminAnalytics,
  AdminUserPage,
  AnnouncementDraft,
  AnnouncementOutcome,
  AnnouncementsOverview,
  LeaderboardPage,
  LeaderboardScope,
  UserFilter,
} from '@/lib/types';

// Every call the dashboard makes. One place, so the endpoints are easy to find and to fake in tests.
export const adminApi = {
  // Resolves only for an account the server accepts as an admin.
  me: () => apiRequest<{ admin: true; email: string | null }>('/admin/me'),
  analytics: () => apiRequest<AdminAnalytics>('/admin/analytics'),

  users: (params: { search?: string; filter?: UserFilter; page?: number; pageSize?: number }) => {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    if (params.filter && params.filter !== 'all') query.set('filter', params.filter);
    query.set('page', String(params.page ?? 1));
    query.set('pageSize', String(params.pageSize ?? 25));
    return apiRequest<AdminUserPage>(`/admin/users?${query.toString()}`);
  },
  suspend: (uid: string, reason?: string) => apiRequest<void>(`/admin/users/${encodeURIComponent(uid)}/suspend`, { method: 'POST', body: { reason } }),
  restore: (uid: string) => apiRequest<void>(`/admin/users/${encodeURIComponent(uid)}/restore`, { method: 'POST' }),

  leaderboard: (scope: LeaderboardScope, page = 1, pageSize = 50) =>
    apiRequest<LeaderboardPage>(`/admin/leaderboard?scope=${scope}&page=${page}&pageSize=${pageSize}`),

  announcements: () => apiRequest<AnnouncementsOverview>('/admin/announcements'),
  sendAnnouncement: (draft: AnnouncementDraft) => apiRequest<AnnouncementOutcome>('/admin/announcements', { method: 'POST', body: draft }),
};
