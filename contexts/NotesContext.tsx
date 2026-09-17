import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { noteService } from '@/services/note.service';
import type { Note, NewNoteInput } from '@/types/note.types';

interface NotesContextValue {
  notes: Note[];
  loading: boolean;
  // Returns the created note — note-editor.tsx's autosave needs the real id
  // back immediately, to switch a not-yet-saved draft over to updateNote calls.
  createNote: (input: NewNoteInput) => Promise<Note>;
  updateNote: (id: string, patch: Partial<NewNoteInput>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const NotesContext = createContext<NotesContextValue | null>(null);

// Most-recently-edited first — matches the backend's own `.sort({ updatedAt: -1 })`,
// so results read the same whether they just came from the server or were patched
// optimistically here.
function sortByUpdated(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = async () => {
    try {
      setNotes(sortByUpdated(await noteService.list()));
    } catch (err) {
      console.error('[NotesProvider] failed to load notes', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setNotes([]);
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
    const prevNotes = notes;
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
      const updated = await noteService.update(id, patch);
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

  return (
    <NotesContext.Provider value={{ notes, loading, createNote, updateNote, deleteNote, refetch: fetchNotes }}>
      {children}
    </NotesContext.Provider>
  );
}

export function useNotes() {
  const ctx = useContext(NotesContext);
  if (!ctx) throw new Error('useNotes must be used within a NotesProvider');
  return ctx;
}
