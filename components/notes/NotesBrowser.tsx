import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { ListRow } from '@/components/ui/ListRow';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { ViewModeToggle } from '@/components/ui/ViewModeToggle';
import { SearchBar } from '@/components/ui/SearchBar';
import { NoteListSection } from '@/components/notes/NoteListSection';
import { NoteGridSection } from '@/components/notes/NoteGridSection';
import { NewFolderModal } from '@/components/notes/NewFolderModal';
import { GridTile } from '@/components/notes/GridTile';
import { useGridTileWidth } from '@/components/notes/gridLayout';
import { getDescendantFolderIds } from '@/components/notes/folderTree';
import { Colors, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useNotes } from '@/hooks/useNotes';
import { useFolders } from '@/hooks/useFolders';
import { useNotesViewMode } from '@/hooks/useNotesViewMode';
import { confirmDelete } from '@/utils/confirmDelete';
import { shareNote } from '@/utils/exportNote';
import type { Note } from '@/types/note.types';
import type { Folder } from '@/types/folder.types';

function openEditor(id?: string, parentId?: string) {
  if (id) {
    router.push(`${Routes.NOTE_EDITOR}?id=${id}`);
  } else {
    router.push(parentId ? `${Routes.NOTE_EDITOR}?folderId=${parentId}` : Routes.NOTE_EDITOR);
  }
}

function openFolder(id: string) {
  router.push(`${Routes.NOTES_FOLDER}?id=${id}`);
}

interface NotesBrowserProps {
  // undefined = root (unfiled notes + top-level folders).
  parentId?: string;
  emptyNotesText: string;
  searchPlaceholder: string;
  // Root shows a big "No notes yet" illustration instead of the Notes
  // section when there's nothing at all; folder screens just show the
  // Notes section's own small empty-state text unconditionally.
  showIllustratedEmptyState?: boolean;
}

// The folders + notes belonging to one location (root, or a given folder id),
// with create/rename/delete for both and a location-scoped search — shared by
// app/notes.tsx and app/notes-folder.tsx so the same folder/note browsing and
// management logic isn't duplicated across both screens. Managing the
// location *itself* (renaming/deleting the current folder) stays with each
// screen's own page chrome — this only manages what's inside it.
export function NotesBrowser({ parentId, emptyNotesText, searchPlaceholder, showIllustratedEmptyState }: NotesBrowserProps) {
  const { notes, deleteNote, refetch: refetchNotes } = useNotes();
  const { folders, createFolder, updateFolder, deleteFolder, refetch: refetchFolders } = useFolders();
  const { viewMode, setViewMode } = useNotesViewMode();
  const { tileWidth, gap } = useGridTileWidth();
  const [query, setQuery] = useState('');
  const [actionTarget, setActionTarget] = useState<Note | null>(null);
  const [folderActionTarget, setFolderActionTarget] = useState<Folder | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);

  // Note.folderId/Folder.parentId are both undefined for "lives at root," so
  // this one comparison correctly picks out either a folder's direct children
  // or root's top-level folders/unfiled notes, without a separate branch.
  const childFolders = folders.filter((f) => f.parentId === parentId);
  const directNotes = notes.filter((n) => n.folderId === parentId);

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  // Root search covers everything; a folder's search covers its whole
  // subtree (itself plus every nested descendant), not just direct children —
  // with nesting, "search this folder" should find things buried deeper in it.
  const searchScope = parentId ? getDescendantFolderIds(folders, parentId) : null;

  const matchingFolders = isSearching
    ? folders.filter((f) => {
        if (searchScope && (f.id === parentId || !searchScope.has(f.id))) return false;
        return f.name.toLowerCase().includes(trimmedQuery);
      })
    : [];
  const matchingNotes = isSearching
    ? notes.filter((n) => {
        if (searchScope && (!n.folderId || !searchScope.has(n.folderId))) return false;
        return n.title.toLowerCase().includes(trimmedQuery) || n.body.toLowerCase().includes(trimmedQuery);
      })
    : [];

  const noCards = childFolders.length === 0 && directNotes.length === 0;

  const handleDeleteNote = (note: Note) => {
    confirmDelete(note.title, () => {
      deleteNote(note.id).catch((err) => console.error('[NotesBrowser] failed to delete note', err));
    });
  };

  const handleDeleteFolder = (folder: Folder) => {
    confirmDelete(
      folder.name,
      async () => {
        try {
          await deleteFolder(folder.id);
          // The backend unfiles this folder's notes and promotes its direct
          // subfolders up a level as part of deleting it — refetch both so
          // local state picks up those corrections immediately, instead of
          // notes/subfolders briefly pointing at a folder that no longer
          // exists until the next foreground refetch or pull-to-refresh.
          await Promise.all([refetchNotes(), refetchFolders()]);
        } catch (err) {
          console.error('[NotesBrowser] failed to delete folder', err);
        }
      },
      "Notes inside will be moved to “No folder,” and subfolders will move up a level — nothing is deleted."
    );
  };

  const handleSaveFolder = async (name: string) => {
    if (editingFolder) {
      await updateFolder(editingFolder.id, { name });
    } else {
      await createFolder({ name, parentId });
    }
  };

  const renderFolders = (list: Folder[]) =>
    viewMode === 'list' ? (
      <View style={styles.folderList}>
        {list.map((folder) => {
          const count = notes.filter((n) => n.folderId === folder.id).length;
          return (
            <ListRow
              key={folder.id}
              leading={{ type: 'icon', name: 'folder.fill', color: Colors.primaryLight, background: Colors.infoSoft }}
              title={folder.name}
              meta={`${count} note${count === 1 ? '' : 's'}`}
              onPress={() => openFolder(folder.id)}
              onLongPress={() => setFolderActionTarget(folder)}
              onMenuPress={() => setFolderActionTarget(folder)}
            />
          );
        })}
      </View>
    ) : (
      <View style={[styles.grid, { columnGap: gap, rowGap: gap + 10 }]}>
        {list.map((folder) => (
          <GridTile
            key={folder.id}
            label={folder.name}
            iconName="folder.fill"
            width={tileWidth}
            onPress={() => openFolder(folder.id)}
            onLongPress={() => setFolderActionTarget(folder)}
          />
        ))}
      </View>
    );

  const renderNotes = (list: Note[], text: string) =>
    viewMode === 'list' ? (
      <NoteListSection notes={list} onOpenNote={(id) => openEditor(id)} onShowActions={setActionTarget} emptyText={text} />
    ) : (
      <NoteGridSection notes={list} onOpenNote={(id) => openEditor(id)} onShowActions={setActionTarget} emptyText={text} />
    );

  return (
    <>
      <View style={styles.controlsRow}>
        <SearchBar value={query} onChangeText={setQuery} placeholder={searchPlaceholder} />
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </View>

      {!isSearching && (
        <View style={styles.topActionRow}>
          <DashedAddButton label="New note" onPress={() => openEditor(undefined, parentId)} style={styles.topActionButton} />
          <DashedAddButton
            label="New folder"
            onPress={() => {
              setEditingFolder(null);
              setFolderModalOpen(true);
            }}
            style={styles.topActionButton}
          />
        </View>
      )}

      {isSearching ? (
        <>
          {matchingFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Folders</Text>
              {renderFolders(matchingFolders)}
            </View>
          )}
          <View style={[styles.section, matchingFolders.length > 0 && styles.sectionSpaced]}>
            {matchingFolders.length > 0 && <Text style={styles.sectionLabel}>Notes</Text>}
            {renderNotes(
              matchingNotes,
              matchingFolders.length > 0 ? 'No matching notes.' : `No results for “${query.trim()}.”`
            )}
          </View>
        </>
      ) : (
        <>
          {childFolders.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Folders</Text>
              {renderFolders(childFolders)}
            </View>
          )}

          {showIllustratedEmptyState ? (
            <>
              {!noCards && (
                <View style={[styles.section, childFolders.length > 0 && styles.sectionSpaced]}>
                  {childFolders.length > 0 && <Text style={styles.sectionLabel}>Notes</Text>}
                  {renderNotes(directNotes, emptyNotesText)}
                </View>
              )}
              {noCards && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconBadge}>
                    <IconSymbol name="doc.fill" color={Colors.primaryLight} size={26} />
                  </View>
                  <Text style={styles.emptyStateTitle}>No notes yet</Text>
                  <Text style={styles.emptyStateSub}>Create your first note to get started.</Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.section, childFolders.length > 0 && styles.sectionSpaced]}>
              {childFolders.length > 0 && <Text style={styles.sectionLabel}>Notes</Text>}
              {renderNotes(directNotes, emptyNotesText)}
            </View>
          )}
        </>
      )}

      <ItemActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        onEdit={() => actionTarget && openEditor(actionTarget.id)}
        onDelete={() => actionTarget && handleDeleteNote(actionTarget)}
        extraActions={
          actionTarget
            ? [{ label: 'Share', icon: 'square.and.arrow.up', onPress: () => shareNote(actionTarget) }]
            : undefined
        }
      />

      <ItemActionSheet
        visible={!!folderActionTarget}
        onClose={() => setFolderActionTarget(null)}
        editLabel="Rename"
        onEdit={() => {
          if (!folderActionTarget) return;
          setEditingFolder(folderActionTarget);
          setFolderModalOpen(true);
        }}
        onDelete={() => folderActionTarget && handleDeleteFolder(folderActionTarget)}
      />

      <NewFolderModal
        visible={folderModalOpen}
        onClose={() => setFolderModalOpen(false)}
        onSave={handleSaveFolder}
        editingFolder={editingFolder}
      />
    </>
  );
}

const styles = StyleSheet.create({
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: Spacing.md,
  },
  topActionRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  topActionButton: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: Spacing.md,
  },
  sectionSpaced: {
    marginTop: 22,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  folderList: {
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyState: {
    marginTop: 16,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptyStateSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
});
