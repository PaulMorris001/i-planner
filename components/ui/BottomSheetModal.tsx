import { ReactNode } from 'react';
import { Modal, View, Pressable, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOffset } from '@/hooks/useKeyboardOffset';
import { Colors, Spacing } from '@/constants/theme';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightPct?: number;
}

// Shared bottom-sheet shell for every "New X" modal in the app. Handles two things
// every one of them needs and previously handled inconsistently (or not at all):
//  1. Bottom safe-area clearance, so the save/create button doesn't sit behind
//     Android's gesture/nav bar — the sheet is content-sized, not screen-height, so a
//     flat hardcoded paddingBottom isn't enough on devices with a tall nav bar.
//  2. Keyboard avoidance — RN's Modal renders in its own native window, so a
//     KeyboardAvoidingView anywhere else in the app (e.g. ScreenWrapper) has no
//     effect on content inside a Modal; each sheet needs its own. RN's own
//     KeyboardAvoidingView doesn't reliably reset itself once the keyboard closes
//     inside a Modal on Android (the sheet is left "floating" instead of settling
//     back to the screen bottom) — useKeyboardOffset tracks the keyboard height
//     manually instead, so "hidden" always means exactly 0, not a stale value.
export function BottomSheetModal({ visible, onClose, children, maxHeightPct = 90 }: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardOffset();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.avoidingContainer} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { maxHeight: `${maxHeightPct}%`, paddingBottom: insets.bottom + 24, marginBottom: keyboardOffset },
            ]}
          >
            <View style={styles.handle} />
            {children}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(20,18,40,0.4)',
  },
  avoidingContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.offWhite,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md,
    paddingTop: 14,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 999,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
});
