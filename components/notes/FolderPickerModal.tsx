import { View, ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getFolderPath } from './folderTree';
import { Colors } from '@/constants/theme';
import type { Folder } from '@/types/folder.types';

interface FolderPickerModalProps {
  visible: boolean;
  onClose: () => void;
  folders: Folder[];
  selectedId?: string;
  // `null` means "No folder" was picked — distinct from a real folder id.
  onSelect: (folderId: string | null) => void;
}

// Local to note-editor.tsx — nothing else in the app needs to pick a folder.
export function FolderPickerModal({ visible, onClose, folders, selectedId, onSelect }: FolderPickerModalProps) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={70}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Move to folder</Text>
        <ModalCloseButton onPress={onClose} />
      </View>

      <ScrollView>
        <PickerRow
          label="No folder"
          selected={!selectedId}
          onPress={() => onSelect(null)}
        />
        {folders.map((folder) => (
          <PickerRow
            key={folder.id}
            label={getFolderPath(folders, folder.id)}
            selected={selectedId === folder.id}
            onPress={() => onSelect(folder.id)}
          />
        ))}
      </ScrollView>
    </BottomSheetModal>
  );
}

function PickerRow({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {selected && <IconSymbol name="checkmark" color={Colors.primaryLight} size={18} />}
    </Pressable>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 10,
  },
});
