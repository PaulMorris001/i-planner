import { useCallback, useState } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { NotesBrowser } from '@/components/notes/NotesBrowser';
import { NewFolderModal } from '@/components/notes/NewFolderModal';
import { Colors, Spacing } from '@/constants/theme';
import { useNotes } from '@/hooks/useNotes';
import { useFolders } from '@/hooks/useFolders';
import { confirmDelete } from '@/utils/confirmDelete';

// `id` is a querystring param, not a dynamic route segment — same convention
// note-editor.tsx already uses for its own `id`. Folders can nest, so this
// same screen is reused at any depth — its own `id` is just "this folder,"
// regardless of how many ancestors it has.
export default function NotesFolder() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { notes, refetch: refetchNotes } = useNotes();
  const { folders, updateFolder, deleteFolder, refetch: refetchFolders } = useFolders();
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const folder = id ? folders.find((f) => f.id === id) ?? null : null;
  const directNoteCount = id ? notes.filter((n) => n.folderId === id).length : 0;

  // Managing this folder's own name/existence stays here (the header's ⋮
  // menu) — NotesBrowser below only manages what's inside it (subfolders and
  // notes), never the folder it's rendered for.
  const handleDeleteFolder = () => {
    if (!folder) return;
    confirmDelete(
      folder.name,
      () => {
        deleteFolder(folder.id)
          .then(() => Promise.all([refetchNotes(), refetchFolders()]))
          .then(() => router.back())
          .catch((err) => console.error('[NotesFolder] failed to delete folder', err));
      },
      "Notes inside will be moved to “No folder,” and subfolders will move up a level — nothing is deleted."
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchNotes(), refetchFolders()]);
    } catch (err) {
      console.error('[NotesFolder] failed to refresh', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Same reasoning as app/notes.tsx's own useFocusEffect — a belt-and-suspenders
  // guarantee that returning here always shows current data, not just relying
  // on NotesContext's state already being correct by the time this refocuses.
  useFocusEffect(
    useCallback(() => {
      Promise.all([refetchNotes(), refetchFolders()]).catch((err) =>
        console.error('[NotesFolder] failed to refetch on focus', err)
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
      <View style={styles.headerBar}>
        <BackButton style={styles.backButtonOverride} />
        <Pressable
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setFolderMenuOpen(true)}
          style={styles.menuBtn}
        >
          <IconSymbol name="ellipsis" color={Colors.textMuted} size={20} />
        </Pressable>
      </View>

      <PageHeader
        title={folder?.name ?? 'Folder'}
        subtitle={`${directNoteCount} note${directNoteCount === 1 ? '' : 's'}`}
      />

      {id && (
        <NotesBrowser
          parentId={id}
          emptyNotesText="No notes in this folder yet — add one above."
          searchPlaceholder="Search this folder"
        />
      )}

      {/* Reused directly as a small "rename/delete this folder" sheet, same
          shape as NotesBrowser's own per-folder ItemActionSheet — just always
          targeting this one folder instead of a selected one. */}
      <ItemActionSheet
        visible={folderMenuOpen}
        onClose={() => setFolderMenuOpen(false)}
        editLabel="Rename"
        onEdit={() => setRenameModalOpen(true)}
        onDelete={handleDeleteFolder}
      />

      <NewFolderModal
        visible={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        onSave={(name) => (folder ? updateFolder(folder.id, { name }) : Promise.resolve())}
        editingFolder={folder}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  backButtonOverride: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  menuBtn: {
    padding: 4,
  },
});
