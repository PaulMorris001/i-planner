import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { noteService } from '@/services/note.service';
import type { Note, NewNoteInput } from '@/types/note.types';

interface NotesContextValue {
  notes: Note[];
  loading: boolean;
  createNote: (input: NewNoteInput) => Promise<void>;
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
    setNotes((prev) => sortByUpdated([...prev, { ...input, id: tempId, createdAt: now, updatedAt: now }]));
    try {
      const created = await noteService.create(input);
      setNotes((prev) => sortByUpdated(prev.map((n) => (n.id === tempId ? created : n))));
    } catch (err) {
      setNotes((prev) => prev.filter((n) => n.id !== tempId));
      throw err;
    }
  };

  const updateNote = async (id: string, patch: Partial<NewNoteInput>) => {
    const prevNotes = notes;
    // Bumps updatedAt locally so the list re-sorts immediately, ahead of the server
    // round trip — list order is derived from updatedAt, unlike Habit.
    setNotes((prev) =>
      sortByUpdated(prev.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)))
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
