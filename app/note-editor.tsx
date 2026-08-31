import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useNotes } from '@/hooks/useNotes';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate, formatTimeLabel } from '@/utils/date';

// Full page, not a sheet — a note deserves the whole screen to write in, unlike
// the short forms every other "New X" flow in this app uses. `id` (querystring,
// not a dynamic route segment) is absent when creating a new note.
export default function NoteEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { notes, createNote, updateNote, deleteNote } = useNotes();
  const editing = id ? notes.find((n) => n.id === id) ?? null : null;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setBody(editing.body);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const canSave = title.trim().length > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      if (editing) {
        await updateNote(editing.id, { title: title.trim(), body });
      } else {
        await createNote({ title: title.trim(), body });
      }
      router.back();
    } catch (err) {
      console.error('[NoteEditor] failed to save note', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    confirmDelete(editing.title, () => {
      deleteNote(editing.id)
        .then(() => router.back())
        .catch((err) => console.error('[NoteEditor] failed to delete note', err));
    });
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} edges={['top', 'right', 'left']}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" color={Colors.textPrimary} size={20} />
        </Pressable>

        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle} numberOfLines={1}>
            {editing ? 'Edit note' : 'New note'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {!!editing && (
            <Pressable hitSlop={10} onPress={handleDelete} style={styles.deleteBtn}>
              <IconSymbol name="trash" color={Colors.error} size={17} />
            </Pressable>
          )}
          <Pressable
            hitSlop={10}
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>Save</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.page}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={Colors.textMuted}
          style={styles.titleInput}
          multiline
          autoFocus={!editing}
        />

        <View style={styles.divider} />

        {!!editing && (
          <Text style={styles.metaText}>
            Edited {formatShortDate(editing.updatedAt)} · {formatTimeLabel(new Date(editing.updatedAt))}
          </Text>
        )}

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write something…"
          placeholderTextColor={Colors.textMuted}
          style={styles.bodyInput}
          multiline
          textAlignVertical="top"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    left: 50,
    right: 50,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.border,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  saveBtnTextDisabled: {
    color: Colors.textMuted,
  },
  page: {
    flex: 1,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  titleInput: {
    fontSize: 23,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 14,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 10,
  },
  bodyInput: {
    flex: 1,
    marginTop: 14,
    fontSize: 16,
    lineHeight: 23,
    color: Colors.textPrimary,
    padding: 0,
  },
});
