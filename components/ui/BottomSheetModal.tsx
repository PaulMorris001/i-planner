import { ReactNode } from 'react';
import { Modal, View, Pressable, Animated, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOffset } from '@/hooks/useKeyboardOffset';
import { Colors, Spacing } from '@/constants/theme';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeightPct?: number;
}

// Shared bottom-sheet shell for every "New X" modal. Handles:
//  1. Bottom safe-area clearance — the sheet is content-sized, not screen-height, so a flat
//     hardcoded paddingBottom isn't enough to clear Android's gesture/nav bar.
//  2. Keyboard avoidance — RN's Modal renders in its own native window, unreachable by a
//     KeyboardAvoidingView elsewhere in the app. RN's own KeyboardAvoidingView also doesn't
//     reliably reset once the keyboard closes inside a Modal on Android (sheet stays "floating"),
//     so useKeyboardOffset tracks keyboard height manually instead.
export function BottomSheetModal({ visible, onClose, children, maxHeightPct = 90 }: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardOffset();
  const { height: windowHeight } = useWindowDimensions();

  // `marginBottom: keyboardOffset` below shifts the whole sheet up by the
  // keyboard's height to keep it clear of the keyboard — but maxHeight was a
  // flat percentage of the full screen, so on a tall keyboard (sheet height +
  // keyboard height > screen height) the top of the sheet got pushed above
  // the status bar. Shrinking maxHeight by the same keyboardOffset cancels
  // the upward shift exactly, so the sheet's top edge stays put and it just
  // gets shorter as the keyboard grows, instead of floating off-screen.
  // Clamped to [0, maxHeightPx] so it can't go negative on an extreme keyboard.
  const maxHeightPx = (maxHeightPct / 100) * windowHeight;
  const keyboardAdjustedMaxHeight = Animated.subtract(maxHeightPx, keyboardOffset).interpolate({
    inputRange: [0, maxHeightPx],
    outputRange: [0, maxHeightPx],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <View style={styles.avoidingContainer} pointerEvents="box-none">
          <Animated.View
            style={[
              styles.sheet,
              { maxHeight: keyboardAdjustedMaxHeight, paddingBottom: insets.bottom + 24, marginBottom: keyboardOffset },
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
