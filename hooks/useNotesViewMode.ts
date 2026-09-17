import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type NotesViewMode = 'list' | 'grid';

const STORAGE_KEY = 'notes_view_mode';

// Shared by both app/notes.tsx and app/notes-folder.tsx, so switching to grid
// on one carries over to the other — and across app launches. Not lifted into
// a Context: the two screens are never mounted at once, and AsyncStorage
// already persists it, so each screen just re-reads it on its own mount
// (matching OnboardingContext's own read-once-at-mount pattern elsewhere).
export function useNotesViewMode() {
  const [viewMode, setViewModeState] = useState<NotesViewMode>('list');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'grid' || stored === 'list') setViewModeState(stored);
      })
      .catch((err) => console.error('[useNotesViewMode] failed to load view mode', err));
  }, []);

  const setViewMode = (mode: NotesViewMode) => {
    setViewModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch((err) =>
      console.error('[useNotesViewMode] failed to persist view mode', err)
    );
  };

  return { viewMode, setViewMode };
}
