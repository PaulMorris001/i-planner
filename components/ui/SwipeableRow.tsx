import { useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

export interface SwipeAction {
  label: string;
  icon: IconSymbolName;
  // Background of the action's button.
  color: string;
  onPress: () => void;
}

interface SwipeableRowProps {
  children: ReactNode;
  // Revealed, left to right, when the row is swiped to the left.
  actions: SwipeAction[];
  // Must match the row's own corner radius, so the revealed buttons are clipped to the same shape.
  borderRadius: number;
}

const ACTION_WIDTH = 74;

// Only one row stays open at a time: opening another closes the previous one.
let openRow: SwipeableMethods | null = null;

// Swipe a row to the left to reveal action buttons (for example Edit, Share, Delete). Tapping the
// row itself still works as before, and a long-press menu remains the alternative for people who
// can't swipe (screen readers, for example). Needs the app to be wrapped in a
// GestureHandlerRootView (see app/_layout.tsx), which Android requires for any gesture.
export function SwipeableRow({ children, actions, borderRadius }: SwipeableRowProps) {
  const rowRef = useRef<SwipeableMethods | null>(null);

  return (
    <ReanimatedSwipeable
      ref={rowRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      containerStyle={{ borderRadius, overflow: 'hidden' }}
      onSwipeableWillOpen={() => {
        if (openRow && openRow !== rowRef.current) openRow.close();
        openRow = rowRef.current;
      }}
      onSwipeableClose={() => {
        if (openRow === rowRef.current) openRow = null;
      }}
      renderRightActions={(_progress, _translation, swipeable) => (
        <View style={[styles.actions, { width: ACTION_WIDTH * actions.length }]}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              style={[styles.action, { backgroundColor: action.color }]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => {
                // Close first so the row isn't left hanging open behind a dialog or a new screen.
                swipeable.close();
                action.onPress();
              }}
            >
              <IconSymbol name={action.icon} color={Colors.white} size={19} />
              <Text style={styles.actionLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: Colors.white },
});
