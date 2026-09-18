import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

interface ShareOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onSharePdf: () => void;
  onShareLink: () => void;
}

// Local to note-editor.tsx — the only place a note offers two different ways
// to share. Same row shape as ItemActionSheet, but that component's API is
// fixed to Edit/extras/Delete, which doesn't fit a plain "pick one of two"
// choice with no edit/delete semantics at all.
export function ShareOptionsModal({ visible, onClose, onSharePdf, onShareLink }: ShareOptionsModalProps) {
  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={40}>
      <Text style={styles.title}>Share note</Text>
      <View style={styles.list}>
        <Pressable
          style={styles.row}
          onPress={() => {
            onClose();
            onSharePdf();
          }}
        >
          <IconSymbol name="doc.fill" color={Colors.textPrimary} size={19} />
          <Text style={styles.rowText}>Share as PDF</Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => {
            onClose();
            onShareLink();
          }}
        >
          <IconSymbol name="link" color={Colors.textPrimary} size={19} />
          <Text style={styles.rowText}>Share link</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 14,
  },
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
});
