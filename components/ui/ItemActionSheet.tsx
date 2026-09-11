import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol, IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

interface ExtraAction {
  label: string;
  icon: IconSymbolName;
  onPress: () => void;
}

interface ItemActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  editLabel?: string;
  deleteLabel?: string;
  // Extra rows between Edit and Delete — e.g. Notes' "Share" export. Optional,
  // so every other caller (goals, tasks, classes, exams, habits) is unaffected.
  extraActions?: ExtraAction[];
}

// Shared "⋮" / long-press menu for every editable-and-deletable list row (goals, tasks,
// classes, exams, habits) — one consistent Edit/Delete surface.
export function ItemActionSheet({
  visible,
  onClose,
  onEdit,
  onDelete,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  extraActions,
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
        {extraActions?.map((action) => (
          <Pressable
            key={action.label}
            style={styles.row}
            onPress={() => {
              onClose();
              action.onPress();
            }}
          >
            <IconSymbol name={action.icon} color={Colors.textPrimary} size={19} />
            <Text style={styles.rowText}>{action.label}</Text>
          </Pressable>
        ))}
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
