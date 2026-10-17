// Shapes returned by the admin API (backend/src/controllers/admin.controller.ts).

export interface AdminAnalytics {
  generatedAt: string;
  users: { total: number; newLast7Days: number; newLast30Days: number; suspended: number };
  activity: { activeNow: number; last24Hours: number; last7Days: number };
  plans: { free: number; student: number; professional: number; premium: number; paid: number; comped: number };
  devices: { ios: number; android: number; noDevice: number };
  signupsByDay: { date: string; count: number }[];
}

export type UserFilter = 'all' | 'paid' | 'free' | 'suspended' | 'admins' | 'updates_on' | 'updates_off' | 'no_push';

export interface AdminUserRow {
  uid: string;
  name: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  lastActiveAt: string | null;
  tier: 'free' | 'student' | 'professional' | 'premium';
  suspended: boolean;
  suspendedReason?: string;
  isAdmin: boolean;
  providers: string[];
  productUpdates: boolean;
  pushDevices: number;
}

export interface AdminUserPage {
  users: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
}

export type LeaderboardScope = 'week' | 'all';

export interface LeaderboardRow {
  rank: number;
  uid: string;
  name: string;
  email: string;
  handle: string | null;
  points: number;
}

export interface LeaderboardPage {
  rows: LeaderboardRow[];
  total: number;
  page: number;
  pageSize: number;
  weekStart?: string;
  weekEnd?: string;
}

export interface AnnouncementDraft {
  title: string;
  body: string;
  route?: string;
  segment: AnnouncementSegment;
  push: boolean;
  email: boolean;
  test: boolean;
}

export type AnnouncementSegment = 'all' | 'no_push';

export interface AnnouncementOutcome {
  id: string;
  pushDevices: number;
  pushAccepted: number;
  emailRecipients: number;
  emailSent: number;
  test: boolean;
}

export interface AnnouncementRecord {
  id: string;
  title: string;
  body: string;
  route: string | null;
  channels: { push: boolean; email: boolean };
  test: boolean;
  pushDevices: number;
  pushAccepted: number;
  emailRecipients: number;
  emailSent: number;
  sentByEmail: string | null;
  createdAt: string;
}

export interface AnnouncementsOverview {
  audience: { pushDevices: number; emailRecipients: number; noPushRecipients: number };
  history: AnnouncementRecord[];
}
