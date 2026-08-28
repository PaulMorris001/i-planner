import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Card } from '@/components/ui/Card';
import { Colors, Spacing } from '@/constants/theme';
import { useNotes } from '@/hooks/useNotes';
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate } from '@/utils/date';
import type { Note } from '@/types/note.types';

export default function Notes() {
  const { notes, createNote, updateNote, deleteNote } = useNotes();

  const sheet = useEditableSheet<Note>();
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSave = noteTitle.trim().length > 0 && !submitting;

  const openSheet = () => {
    setNoteTitle('');
    setNoteBody('');
    sheet.openNew();
  };

  const openSheetForEdit = (note: Note) => {
    setNoteTitle(note.title);
    setNoteBody(note.body);
    sheet.openEdit(note);
  };

  const handleCreate = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (sheet.editing) {
        await updateNote(sheet.editing.id, { title: noteTitle.trim(), body: noteBody });
      } else {
        await createNote({ title: noteTitle.trim(), body: noteBody });
      }
      sheet.close();
    } catch (err) {
      console.error('[Notes] failed to save note', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteNote = (note: Note) => {
    confirmDelete(note.title, () => {
      deleteNote(note.id).catch((err) => {
        console.error('[Notes] failed to delete note', err);
      });
    });
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title="Notes" subtitle={`${notes.length} note${notes.length === 1 ? '' : 's'}`} />

      <View style={styles.topActionRow}>
        <DashedAddButton label="New note" onPress={openSheet} />
      </View>

      <View style={styles.list}>
        {notes.map((note) => (
          <Card
            key={note.id}
            style={styles.card}
            onPress={() => openSheetForEdit(note)}
            onLongPress={() => sheet.setActionTarget(note)}
          >
            <View style={styles.cardHeaderRow}>
              <Text style={styles.noteTitle} numberOfLines={1}>
                {note.title}
              </Text>
              <Text style={styles.noteDate}>{formatShortDate(note.updatedAt)}</Text>
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => sheet.setActionTarget(note)}
              >
                <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
              </Pressable>
            </View>
            {note.body.trim() ? (
              <Text style={styles.noteBody} numberOfLines={2}>
                {note.body.trim()}
              </Text>
            ) : (
              <Text style={[styles.noteBody, styles.noteBodyEmpty]}>No additional text</Text>
            )}
          </Card>
        ))}

        {notes.length === 0 && (
          <Text style={styles.emptyText}>No notes yet — tap &quot;New note&quot; to add one.</Text>
        )}
      </View>

      <BottomSheetModal visible={sheet.open} onClose={sheet.close}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>{sheet.editing ? 'Edit note' : 'New note'}</Text>

          <TextInput
            value={noteTitle}
            onChangeText={setNoteTitle}
            placeholder="Note title"
            placeholderTextColor={Colors.textMuted}
            style={styles.input}
          />

          <TextInput
            value={noteBody}
            onChangeText={setNoteBody}
            placeholder="Write something…"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.bodyInput]}
            multiline
            textAlignVertical="top"
          />

          <Pressable
            style={[styles.createButton, !canSave && styles.createButtonDisabled]}
            disabled={!canSave}
            onPress={handleCreate}
          >
            <Text style={[styles.createButtonText, !canSave && styles.createButtonTextDisabled]}>
              {sheet.editing ? 'Save changes' : 'Create note'}
            </Text>
          </Pressable>
          </ScrollView>
      </BottomSheetModal>

      <ItemActionSheet
        visible={!!sheet.actionTarget}
        onClose={() => sheet.setActionTarget(null)}
        onEdit={() => sheet.actionTarget && openSheetForEdit(sheet.actionTarget)}
        onDelete={() => sheet.actionTarget && handleDeleteNote(sheet.actionTarget)}
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
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  sheetTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  input: {
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  bodyInput: {
    minHeight: 140,
  },
  createButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  createButtonDisabled: {
    backgroundColor: Colors.border,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  createButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
