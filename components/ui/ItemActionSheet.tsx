import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

interface ItemActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
}

// Shared "⋮" / long-press menu used by every editable-and-deletable list row in the
// app (goals, tasks, classes, exams, habits) — one consistent Edit/Delete surface
// instead of five slightly different ones.
export function ItemActionSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: ItemActionSheetProps) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={40}>
      <View style={styles.list}>
        <Pressable
          style={styles.row}
          onPress={() => {
            onClose();
            onEdit();
          }}
        >
          <IconSymbol name="pencil" color={Colors.textPrimary} size={19} />
          <Text style={styles.rowText}>{editLabel}</Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => {
            onClose();
            onDelete();
          }}
        >
          <IconSymbol name="trash" color={Colors.error} size={19} />
          <Text style={[styles.rowText, styles.deleteText]}>{deleteLabel}</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 4,
  },
  rowText: {
    fontSize: 15.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  deleteText: {
    color: Colors.error,
  },
});
