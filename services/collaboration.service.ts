import type { CollabRole, InvitePreview, NoteMember, NotePeople, SharedWithMeNote } from "@/types/collaboration.types";
import type { Note } from "@/types/note.types";
import { authedRequest } from "./authedRequest";

export const collaborationService = {
  // ---- notes shared WITH me
  listShared: () => authedRequest<SharedWithMeNote[]>("/collab/notes"),

  // One note, fresh from the server, with my role. The editor polls this to pick up other people's edits.
  getNote: (noteId: string) =>
    authedRequest<{ note: Note; role: "owner" | CollabRole }>(`/collab/notes/${noteId}`),

  // Stop having access to a note someone shared with me.
  leave: (noteId: string) => authedRequest<void>(`/collab/notes/${noteId}/leave`, { method: "DELETE" }),

  // Who has access to a note: the owner and the collaborators with their roles. Anyone with access can ask.
  // The owner also gets pending/declined invitations, addresses and ids to manage them.
  people: (noteId: string) => authedRequest<NotePeople>(`/collab/notes/${noteId}/people`),

  // ---- the owner managing who is invited
  listMembers: (noteId: string) => authedRequest<NoteMember[]>(`/collab/notes/${noteId}/members`),

  invite: (noteId: string, email: string, role: CollabRole) =>
    authedRequest<NoteMember>(`/collab/notes/${noteId}/members`, { method: "POST", body: { email, role } }),

  resend: (noteId: string, memberId: string) =>
    authedRequest<NoteMember>(`/collab/notes/${noteId}/members/${memberId}/resend`, { method: "POST" }),

  changeRole: (noteId: string, memberId: string, role: CollabRole) =>
    authedRequest<NoteMember>(`/collab/notes/${noteId}/members/${memberId}`, { method: "PATCH", body: { role } }),

  remove: (noteId: string, memberId: string) =>
    authedRequest<void>(`/collab/notes/${noteId}/members/${memberId}`, { method: "DELETE" }),

  // ---- the invitation behind the emailed link
  previewInvite: (token: string) => authedRequest<InvitePreview>(`/collab/invites/${encodeURIComponent(token)}`),

  acceptInvite: (token: string) =>
    authedRequest<{ noteId: string; role: CollabRole }>(`/collab/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }),

  declineInvite: (token: string) =>
    authedRequest<void>(`/collab/invites/${encodeURIComponent(token)}/decline`, { method: "POST" }),
};
