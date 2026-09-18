import { useCallback, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotesBrowser } from '@/components/notes/NotesBrowser';
import { Colors } from '@/constants/theme';
import { useNotes } from '@/hooks/useNotes';
import { useFolders } from '@/hooks/useFolders';

export default function Notes() {
  const { notes, refetch: refetchNotes } = useNotes();
  const { refetch: refetchFolders } = useFolders();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchNotes(), refetchFolders()]);
    } catch (err) {
      console.error('[Notes] failed to refresh', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Refetches on real navigation back to this screen — e.g. importing a note
  // via a shared link and returning here, or switching tabs and back. Matches
  // app/import-calendar.tsx's own use of this same pattern. NotesContext's
  // own state is already correct the instant an import happens (shared-note.tsx
  // refetches before navigating away from it), so this is a belt-and-suspenders
  // guarantee against this screen simply having been off-screen/frozen through
  // that update rather than the actual fix for it.
  useFocusEffect(
    useCallback(() => {
      Promise.all([refetchNotes(), refetchFolders()]).catch((err) =>
        console.error('[Notes] failed to refetch on focus', err)
      );
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  return (
    <ScreenWrapper
      backgroundColor={Colors.offWhite}
      scroll
      style={styles.scrollContent}
      onRefresh={handleRefresh}
      refreshing={refreshing}
    >
      <BackButton />

      <PageHeader title="Notes" subtitle={`${notes.length} note${notes.length === 1 ? '' : 's'}`} />

      <NotesBrowser
        emptyNotesText="No notes outside a folder."
        searchPlaceholder="Search notes and folders"
        showIllustratedEmptyState
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
});
