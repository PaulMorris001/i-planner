import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useNotes } from '@/hooks/useNotes';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate } from '@/utils/date';
import { shareNote } from '@/utils/exportNote';
import type { Note } from '@/types/note.types';

function openEditor(id?: string) {
  router.push(id ? `${Routes.NOTE_EDITOR}?id=${id}` : Routes.NOTE_EDITOR);
}

// Cap what ever reaches <Text numberOfLines={1}> below, not just what's
// visually shown. numberOfLines only truncates the rendered layout — Fabric
// still builds the full AttributedString/text-fragment tree for the entire
// string first, one Fragment per run. A note with a very large body (a big
// paste, or one grown over many edits — nothing bounds body length before
// this) built a pathologically deep tree that way, and when that tree was
// later torn down on a background GC sweep, recursive C++ destructor
// chaining through it overflowed the thread stack — a confirmed real crash
// (SIGBUS, "excessive recursion"). Truncating the JS string itself first
// means this screen never builds more than a few hundred characters' worth
// of fragments, regardless of how large the actual note is.
const PREVIEW_CHARS = 200;
function previewText(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > PREVIEW_CHARS ? `${trimmed.slice(0, PREVIEW_CHARS)}…` : trimmed;
}

export default function Notes() {
  const { notes, deleteNote, refetch } = useNotes();
  const [actionTarget, setActionTarget] = useState<Note | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleDeleteNote = (note: Note) => {
    confirmDelete(note.title, () => {
      deleteNote(note.id).catch((err) => {
        console.error('[Notes] failed to delete note', err);
      });
    });
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('[Notes] failed to refresh', err);
    } finally {
      setRefreshing(false);
    }
  };

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

      <View style={styles.topActionRow}>
        <DashedAddButton label="New note" onPress={() => openEditor()} />
      </View>

      <View style={styles.list}>
        {notes.map((note) => (
          <Card
            key={note.id}
            style={styles.card}
            onPress={() => openEditor(note.id)}
            onLongPress={() => setActionTarget(note)}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.noteTitle} numberOfLines={1}>
                {note.title}
              </Text>
              <Text style={styles.noteDate}>{formatShortDate(note.updatedAt)}</Text>
              <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => setActionTarget(note)}>
                <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
              </Pressable>
            </View>
            {note.body.trim() ? (
              <Text style={styles.noteBody} numberOfLines={1}>
                {previewText(note.body)}
              </Text>
            ) : (
              <Text style={[styles.noteBody, styles.noteBodyEmpty]}>No additional text</Text>
            )}
          </Card>
        ))}

        {notes.length === 0 && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBadge}>
              <IconSymbol name="doc.fill" color={Colors.primaryLight} size={26} />
            </View>
            <Text style={styles.emptyStateTitle}>No notes yet</Text>
            <Text style={styles.emptyStateSub}>Create your first note to get started.</Text>
          </View>
        )}
      </View>

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
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  topActionRow: {
    marginTop: 16,
    paddingHorizontal: Spacing.md,
  },
  list: {
    marginTop: 16,
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  noteTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  noteDate: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  noteBody: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginTop: 6,
  },
  noteBodyEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  emptyState: {
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
