import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { formatShortDate } from '@/utils/date';
import type { Note } from '@/types/note.types';

// Cap what ever reaches <Text numberOfLines={1}> below, not just what's
// visually shown. numberOfLines only truncates the rendered layout — Fabric
// still builds the full AttributedString/text-fragment tree for the entire
// string first, one Fragment per run. A note with a very large body (a big
// paste, or one grown over many edits — nothing bounds body length before
// this) built a pathologically deep tree that way, and when that tree was
// later torn down on a background GC sweep, recursive C++ destructor
// chaining through it overflowed the thread stack — a confirmed real crash
// (SIGBUS, "excessive recursion"). Truncating the JS string itself first
// means this never builds more than a few hundred characters' worth of
// fragments, regardless of how large the actual note is.
const PREVIEW_CHARS = 200;
function previewText(body: string): string {
  const trimmed = body.trim();
  return trimmed.length > PREVIEW_CHARS ? `${trimmed.slice(0, PREVIEW_CHARS)}…` : trimmed;
}

interface NoteListSectionProps {
  notes: Note[];
  onOpenNote: (id: string) => void;
  onShowActions: (note: Note) => void;
  emptyText: string;
}

// The note-card list itself, extracted out of app/notes.tsx so it can be
// reused unmodified by app/notes-folder.tsx (a folder's notes) — same card
// layout, same preview truncation, same empty-state slot, just fed a
// different, already-filtered `notes` array and empty-state copy by each
// caller.
export function NoteListSection({ notes, onOpenNote, onShowActions, emptyText }: NoteListSectionProps) {
  return (
    <View style={styles.list}>
      {notes.map((note) => (
        <Card
          key={note.id}
          style={styles.card}
          onPress={() => onOpenNote(note.id)}
          onLongPress={() => onShowActions(note)}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.noteTitle} numberOfLines={1}>
              {note.title}
            </Text>
            <Text style={styles.noteDate}>{formatShortDate(note.updatedAt)}</Text>
            <Pressable hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => onShowActions(note)}>
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

      {notes.length === 0 && <Text style={styles.emptyText}>{emptyText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
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
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
