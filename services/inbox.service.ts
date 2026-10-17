import { authedRequest } from "./authedRequest";

// One server-sent message (an announcement, an invitation answer, an access change). Reminders the
// phone schedules for itself are not part of this.
export interface InboxItem {
  id: string;
  kind: string;
  title: string;
  body: string;
  // In-app screen to open when tapped, e.g. "/notes".
  route: string | null;
  read: boolean;
  createdAt: string;
}

export interface InboxResponse {
  unreadCount: number;
  items: InboxItem[];
}

export const inboxService = {
  list: () => authedRequest<InboxResponse>("/notifications"),
  markRead: (id: string) => authedRequest<void>(`/notifications/${id}/read`, { method: "POST" }),
  markAllRead: () => authedRequest<void>("/notifications/read-all", { method: "POST" }),
};
