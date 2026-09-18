import { useEffect, useRef, useState } from 'react';
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
  // True once the user has explicitly toggled — guards against the initial
  // AsyncStorage read (in flight since mount) resolving *after* that toggle
  // and clobbering it back to whatever was stored last session.
  const userSetRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (userSetRef.current) return;
        if (stored === 'grid' || stored === 'list') setViewModeState(stored);
      })
      .catch((err) => console.error('[useNotesViewMode] failed to load view mode', err));
  }, []);

  const setViewMode = (mode: NotesViewMode) => {
    userSetRef.current = true;
    setViewModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch((err) =>
      console.error('[useNotesViewMode] failed to persist view mode', err)
    );
  };

  return { viewMode, setViewMode };
}
