import type { Note } from './note.types';

// What an invited person may do with a note. (The owner is not a "role": the owner is the
// account the note belongs to.)
export type CollabRole = 'viewer' | 'editor';
// How the signed-in account relates to a note it has open.
export type NoteAccessRole = 'owner' | CollabRole;

export type MemberStatus = 'pending' | 'accepted' | 'declined';

// A note someone else shared with me (backend/src/controllers/collaboration.controller.ts).
export interface SharedWithMeNote {
  note: Note;
  role: CollabRole;
  // Who invited me, as shown in the invitation ("Sam" or an email address).
  ownerLabel: string;
}

// One person on a note's "People with access" list. Only the owner sees these.
export interface NoteMember {
  id: string;
  email: string;
  role: CollabRole;
  status: MemberStatus;
  // A pending invitation whose link has run out (it can be sent again).
  expired: boolean;
  createdAt: string;
  respondedAt: string | null;
}

export interface InvitePreview {
  noteTitle: string;
  role: CollabRole;
  inviterLabel: string;
  status: MemberStatus;
  expired: boolean;
  alreadyYours: boolean;
  isOwner: boolean;
}

// One line of a note's "People with access" list (GET /collab/notes/:id/people).
export interface NotePerson {
  // Only the owner gets these two (to manage the invitation).
  id?: string;
  email?: string;
  // A name, or for a person without one a masked address (collaborators never see addresses).
  label: string;
  role: CollabRole;
  status: MemberStatus;
  // A pending invitation whose link has run out.
  expired: boolean;
  isYou: boolean;
}

export interface NotePeople {
  // My own role in the note.
  role: NoteAccessRole;
  owner: { label: string; isYou: boolean };
  people: NotePerson[];
}
