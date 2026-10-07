import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { noteService } from '@/services/note.service';
import { collaborationService } from '@/services/collaboration.service';
import type { Note, NewNoteInput, NoteUpdate } from '@/types/note.types';
import type { SharedWithMeNote } from '@/types/collaboration.types';

interface NotesContextValue {
  notes: Note[];
  // Notes other people shared with this account (accepted invitations), with my role in each.
  sharedNotes: SharedWithMeNote[];
  loading: boolean;
  // Returns the created note — note-editor.tsx's autosave needs the real id
  // back immediately, to switch a not-yet-saved draft over to updateNote calls.
  createNote: (input: NewNoteInput) => Promise<Note>;
  updateNote: (id: string, patch: Partial<NewNoteInput>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  // Stop having access to a note someone shared with me.
  leaveSharedNote: (id: string) => Promise<void>;
  // Replaces this note's local copy with a newer one from the server (someone else edited it).
  applyServerNote: (note: Note) => void;
  // The owner changed my role on a note shared with me (view <-> edit): reflect it right away.
  setSharedRole: (noteId: string, role: SharedWithMeNote['role']) => void;
  refetch: () => Promise<void>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

// Most-recently-edited first — matches the backend's own `.sort({ updatedAt: -1 })`,
// so results read the same whether they just came from the server or were patched
// optimistically here.
function sortByUpdated(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function sortSharedByUpdated(list: SharedWithMeNote[]): SharedWithMeNote[] {
  return [...list].sort((a, b) => b.note.updatedAt.localeCompare(a.note.updatedAt));
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sharedNotes, setSharedNotes] = useState<SharedWithMeNote[]>([]);
  const [loading, setLoading] = useState(true);

  // Both lists together: the account's own notes and the ones shared with it. They are
  // fetched independently so a failure of one never blanks the other.
  const fetchNotes = async () => {
    const [own, shared] = await Promise.allSettled([noteService.list(), collaborationService.listShared()]);
    if (own.status === 'fulfilled') setNotes(sortByUpdated(own.value));
    else console.error('[NotesProvider] failed to load notes', own.reason);
    if (shared.status === 'fulfilled') setSharedNotes(sortSharedByUpdated(shared.value));
    else console.error('[NotesProvider] failed to load shared notes', shared.reason);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setNotes([]);
        setSharedNotes([]);
        setLoading(false);
        return;
      }
      await fetchNotes();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createNote = async (input: NewNoteInput) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    // Same null->undefined normalization as updateNote below — a brand-new
    // note is never created directly into "explicitly no folder," so this
    // only ever narrows `string | null | undefined` down to `string | undefined`.
    const { folderId, ...rest } = input;
    const localNote: Note = { ...rest, id: tempId, createdAt: now, updatedAt: now, folderId: folderId ?? undefined };
    setNotes((prev) => sortByUpdated([...prev, localNote]));
    try {
      const created = await noteService.create(input);
      setNotes((prev) => sortByUpdated(prev.map((n) => (n.id === tempId ? created : n))));
      return created;
    } catch (err) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      throw err;
    }
  };

  const updateNote = async (id: string, patch: Partial<NewNoteInput>) => {
    // A note someone else shared with me: no optimistic copy. The save is checked by the server
    // against the version this screen holds, and a refusal (409) carries the latest note.
    const shared = sharedNotes.find((s) => s.note.id === id);
    if (shared) {
      const updated = await noteService.update(id, { ...patch, baseVersion: shared.note.version ?? 0 });
      setSharedNotes((prev) => sortSharedByUpdated(prev.map((s) => (s.note.id === id ? { ...s, note: updated } : s))));
      return;
    }

    const prevNotes = notes;
    // The owner's text/title saves carry the version too, so an edit made while an invited editor
    // changed the note is caught instead of silently erasing their work. (A note this app has not
    // seen a version for yet is saved as before.)
    const current = notes.find((n) => n.id === id);
    const carriesText = patch.title !== undefined || patch.body !== undefined;
    const request: NoteUpdate = carriesText && current?.version !== undefined ? { ...patch, baseVersion: current.version } : patch;
    // Note.folderId is never literally `null` (a note is either filed under a
    // real folder id, or the key is absent entirely — see toPublicNote's
    // projection) — only NewNoteInput's patch shape allows explicit null, to
    // express "un-file this note" distinctly from "leave its folder alone."
    // Normalized here so the optimistic local copy matches what the server
    // will actually send back, rather than briefly holding a `folderId: null`
    // that Note's own type says can't happen.
    const { folderId, ...rest } = patch;
    const localPatch = folderId === undefined ? rest : { ...rest, folderId: folderId ?? undefined };
    setNotes((prev) =>
      sortByUpdated(prev.map((n) => (n.id === id ? { ...n, ...localPatch, updatedAt: new Date().toISOString() } : n)))
    );
    try {
      const updated = await noteService.update(id, request);
      setNotes((prev) => sortByUpdated(prev.map((n) => (n.id === id ? updated : n))));
    } catch (err) {
      setNotes(prevNotes);
      throw err;
    }
  };

  const deleteNote = async (id: string) => {
    const prevNotes = notes;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    try {
      await noteService.remove(id);
    } catch (err) {
      setNotes(prevNotes);
      throw err;
    }
  };

  const leaveSharedNote = async (id: string) => {
    await collaborationService.leave(id);
    setSharedNotes((prev) => prev.filter((s) => s.note.id !== id));
  };

  const setSharedRole = (noteId: string, role: SharedWithMeNote['role']) => {
    setSharedNotes((prev) => prev.map((s) => (s.note.id === noteId ? { ...s, role } : s)));
  };

  const applyServerNote = (note: Note) => {
    if (sharedNotes.some((s) => s.note.id === note.id)) {
      setSharedNotes((prev) => sortSharedByUpdated(prev.map((s) => (s.note.id === note.id ? { ...s, note } : s))));
    } else {
      setNotes((prev) => sortByUpdated(prev.map((n) => (n.id === note.id ? note : n))));
    }
  };

  return (
    <NotesContext.Provider
      value={{ notes, sharedNotes, loading, createNote, updateNote, deleteNote, leaveSharedNote, applyServerNote, setSharedRole, refetch: fetchNotes }}
    >
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within a NotesProvider');
  return ctx;
}
