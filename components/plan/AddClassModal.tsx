import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import {
  ClassFieldsEditor,
  isClassFieldsValid,
  defaultClassFields,
  buildClassItem,
  type ClassFieldsValue,
} from '@/components/plan/ClassFieldsEditor';
import { Colors } from '@/constants/theme';
import { parseISODateLocal, parseTimeToDate } from '@/utils/date';
import type { ClassItem } from '@/types/plan.types';

interface AddClassModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: ClassItem) => void;
  editingClass?: ClassItem | null;
}

export function AddClassModal({ visible, onClose, onAdd, editingClass }: AddClassModalProps) {
  const [fields, setFields] = useState<ClassFieldsValue>(defaultClassFields);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const canSave = isClassFieldsValid(fields);

  const patchFields = (patch: Partial<ClassFieldsValue>) => setFields((prev) => ({ ...prev, ...patch }));

  const reset = () => setFields(defaultClassFields());

  useEffect(() => {
    if (!visible) return;
    if (editingClass) {
      setFields({
        className: editingClass.courseName,
        startDate: parseISODateLocal(editingClass.startDate),
        endDate: editingClass.endDate ? parseISODateLocal(editingClass.endDate) : null,
        recurring: editingClass.recurring,
        freq: editingClass.freq,
        selectedDays: editingClass.freq === 'weekly' ? editingClass.dayIdxs : [],
        time: editingClass.time ? parseTimeToDate(editingClass.time) : null,
        professor: editingClass.professor ?? '',
        venue: editingClass.venue ?? '',
        alarmEnabled: !!editingClass.alarmEnabled,
      });
    } else {
      reset();
    }
  }, [visible, editingClass]);

  const handleClose = () => {
    onClose();
    reset();
  };

  const handleAdd = () => {
    if (!canSave) return;
    const item = buildClassItem(fields, editingClass?.id ?? Date.now().toString());
    onAdd(item);
    handleClose();
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={88}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>{editingClass ? 'Edit class' : 'Add a class'}</Text>
            <ModalCloseButton onPress={handleClose} />
          </View>

          <ClassFieldsEditor
            value={fields}
            onChange={patchFields}
            datePickerVisible={showDatePicker}
            onOpenDatePicker={() => setShowDatePicker(true)}
            onCloseDatePicker={() => setShowDatePicker(false)}
            endDatePickerVisible={showEndDatePicker}
            onOpenEndDatePicker={() => setShowEndDatePicker(true)}
            onCloseEndDatePicker={() => setShowEndDatePicker(false)}
            timePickerVisible={showTimePicker}
            onOpenTimePicker={() => setShowTimePicker(true)}
            onCloseTimePicker={() => setShowTimePicker(false)}
          />

          <TouchableOpacity
            style={[styles.sheetSaveBtn, !canSave && styles.sheetSaveBtnDisabled]}
            onPress={handleAdd}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Text style={[styles.sheetSaveBtnText, !canSave && styles.sheetSaveBtnTextDisabled]}>
              {editingClass ? 'Save changes' : 'Add class'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, flex: 1, marginRight: 10 },
  sheetSaveBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  sheetSaveBtnDisabled: { backgroundColor: Colors.border },
  sheetSaveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
  sheetSaveBtnTextDisabled: { color: Colors.textMuted },
});
