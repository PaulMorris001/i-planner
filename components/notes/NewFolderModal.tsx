import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { Colors } from '@/constants/theme';
import type { Folder } from '@/types/folder.types';

// Keep in sync with backend/src/constants/noteLimits.ts's FOLDER_NAME_MAX_LENGTH.
const FOLDER_NAME_MAX_LENGTH = 100;

interface NewFolderModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
  // Present for a rename, absent for creating a new folder — same
  // editingX?-prop convention AddClassModal/AddBillModal etc. already use.
  // Deletion isn't handled here (unlike EditSyllabusModal, which bundles
  // rename+delete) — it lives in the same ItemActionSheet notes/classes
  // already use, at the call site.
  editingFolder?: Folder | null;
}

export function NewFolderModal({ visible, onClose, onSave, editingFolder }: NewFolderModalProps) {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setName(editingFolder?.name ?? '');
  }, [visible, editingFolder]);

  const handleClose = () => {
    onClose();
    setName('');
  };

  const canSave = name.trim().length > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave(name.trim());
      handleClose();
    } catch (err) {
      console.error('[NewFolderModal] failed to save folder', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{editingFolder ? 'Rename folder' : 'New folder'}</Text>
        <ModalCloseButton onPress={handleClose} />
      </View>

      <Text style={styles.fieldLabel}>Folder name</Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="e.g. Lecture notes"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
        autoFocus
        maxLength={FOLDER_NAME_MAX_LENGTH}
      />

      <Pressable
        style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={[styles.primaryBtnText, !canSave && styles.primaryBtnTextDisabled]}>
          {submitting ? 'Saving…' : editingFolder ? 'Save changes' : 'Create folder'}
        </Text>
      </Pressable>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    flex: 1,
    marginRight: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.border,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  primaryBtnTextDisabled: {
    color: Colors.textMuted,
  },
});
