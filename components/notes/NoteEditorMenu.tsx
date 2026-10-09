import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export interface NoteMenuItem {
  label: string;
  icon: IconSymbolName;
  onPress: () => void;
  // Shown in red, for the actions that remove or leave something.
  destructive?: boolean;
}

interface NoteEditorMenuProps {
  visible: boolean;
  onClose: () => void;
  items: NoteMenuItem[];
}

// The "⋮" menu in the note editor's header: everything that isn't writing or saving (share, who has
// access, delete or leave) lives here, so the header stays uncluttered. Same row look as the
// notes list's action menu. The menu closes before the chosen action runs, because that action
// usually opens a sheet or a confirmation of its own.
export function NoteEditorMenu({ visible, onClose, items }: NoteEditorMenuProps) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={45}>
      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.label}
            style={styles.row}
            onPress={() => {
              onClose();
              item.onPress();
            }}
          >
            <IconSymbol name={item.icon} color={item.destructive ? Colors.error : Colors.textPrimary} size={19} />
            <Text style={[styles.rowText, item.destructive && styles.rowTextDestructive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 15, paddingHorizontal: 4 },
  rowText: { fontSize: 15.5, fontWeight: '600', color: Colors.textPrimary },
  rowTextDestructive: { color: Colors.error },
});
