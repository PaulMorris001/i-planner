import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { folderService } from '@/services/folder.service';
import type { Folder, NewFolderInput } from '@/types/folder.types';

interface FoldersContextValue {
  folders: Folder[];
  loading: boolean;
  createFolder: (input: NewFolderInput) => Promise<Folder>;
  updateFolder: (id: string, patch: Partial<NewFolderInput>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

const FoldersContext = createContext<FoldersContextValue | null>(null);

// Alphabetical, unlike NotesContext's recency sort — matches the backend's
// own `.sort({ name: 1 })`, and reads better for a small, human-curated list
// of folders than "most recently touched" would.
function sortByName(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.name.localeCompare(b.name));
}

// Mirrors contexts/NotesContext.tsx's exact shape (optimistic create/update/
// delete with temp-id swap and rollback-on-failure, onAuthStateChanged-driven
// fetch) — deliberately not nested inside NotesProvider in app/_layout.tsx,
// since neither context needs to call into the other's hook: a folder's note
// count/contents are computed by whichever screen already calls both
// useNotes() and useFolders() directly.
export function FoldersProvider({ children }: { children: ReactNode }) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = async () => {
    try {
      setFolders(sortByName(await folderService.list()));
    } catch (err) {
      console.error('[FoldersProvider] failed to load folders', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setFolders([]);
        setLoading(false);
        return;
      }
      await fetchFolders();
      setLoading(false);
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Returns the created Folder (unlike Notes' createNote) — the "New folder"
  // modal needs the real id back immediately so it can offer to jump straight
  // into the new folder, without waiting on a separate lookup.
  const createFolder = async (input: NewFolderInput): Promise<Folder> => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    setFolders((prev) => sortByName([...prev, { ...input, id: tempId, createdAt: now, updatedAt: now }]));
    try {
      const created = await folderService.create(input);
      setFolders((prev) => sortByName(prev.map((f) => (f.id === tempId ? created : f))));
      return created;
    } catch (err) {
      setFolders((prev) => prev.filter((f) => f.id !== tempId));
      throw err;
    }
  };

  const updateFolder = async (id: string, patch: Partial<NewFolderInput>) => {
    const prevFolders = folders;
    setFolders((prev) =>
      sortByName(prev.map((f) => (f.id === id ? { ...f, ...patch, updatedAt: new Date().toISOString() } : f)))
    );
    try {
      const updated = await folderService.update(id, patch);
      setFolders((prev) => sortByName(prev.map((f) => (f.id === id ? updated : f))));
    } catch (err) {
      setFolders(prevFolders);
      throw err;
    }
  };

  const deleteFolder = async (id: string) => {
    const prevFolders = folders;
    setFolders((prev) => prev.filter((f) => f.id !== id));
    try {
      await folderService.remove(id);
    } catch (err) {
      setFolders(prevFolders);
      throw err;
    }
  };

  return (
    <FoldersContext.Provider value={{ folders, loading, createFolder, updateFolder, deleteFolder, refetch: fetchFolders }}>
      {children}
    </FoldersContext.Provider>
  );
}

export function useFolders() {
  const ctx = useContext(FoldersContext);
  if (!ctx) throw new Error('useFolders must be used within a FoldersProvider');
  return ctx;
}
