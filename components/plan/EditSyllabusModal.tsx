import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { Colors } from '@/constants/theme';
import { confirmDelete } from '@/utils/confirmDelete';
import type { Syllabus } from '@/types/syllabus.types';

interface EditSyllabusModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (courseName: string) => Promise<void>;
  onRemove: () => Promise<void>;
  editingSyllabus: Syllabus | null;
}

// Lightweight rename-only editor — a syllabus record's fileName is tied to the
// PDF that was actually uploaded (not user-editable) and classId is an internal
// link, so courseName is the only field that makes sense to change here. Not
// the heavier SyllabusUploadModal, which handles PDF pick/AI extraction — the
// wrong shape entirely for editing an existing record.
export function EditSyllabusModal({ visible, onClose, onSave, onRemove, editingSyllabus }: EditSyllabusModalProps) {
  const [courseName, setCourseName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) setCourseName(editingSyllabus?.courseName ?? '');
  }, [visible, editingSyllabus]);

  const handleClose = () => {
    onClose();
    setCourseName('');
  };

  const canSave = courseName.trim().length > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave(courseName.trim());
      handleClose();
    } catch (err) {
      console.error('[EditSyllabusModal] failed to save syllabus', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = () => {
    confirmDelete(editingSyllabus?.courseName || 'this syllabus', () => {
      onRemove()
        .then(handleClose)
        .catch((err) => console.error('[EditSyllabusModal] failed to remove syllabus', err));
    });
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Edit syllabus</Text>
        <ModalCloseButton onPress={handleClose} />
      </View>

      <Text style={styles.fieldLabel}>Course name</Text>
      <TextInput
        value={courseName}
        onChangeText={setCourseName}
        placeholder="Course name"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />

      <Pressable
        style={[styles.primaryBtn, !canSave && styles.primaryBtnDisabled]}
        onPress={handleSave}
        disabled={!canSave}
      >
        <Text style={[styles.primaryBtnText, !canSave && styles.primaryBtnTextDisabled]}>
          {submitting ? 'Saving…' : 'Save changes'}
        </Text>
      </Pressable>

      <Pressable style={styles.removeBtn} onPress={handleRemove}>
        <Text style={styles.removeBtnText}>Remove syllabus</Text>
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
  removeBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  removeBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.error,
  },
});
