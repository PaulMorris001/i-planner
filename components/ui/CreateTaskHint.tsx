import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '@/constants/theme';
import { useNewTaskModal } from '@/contexts/NewTaskModalContext';

interface CreateTaskHintProps {
  // Distance from the bottom of the screen to the top of the + button.
  bottomOffset: number;
}

// Floating "Tap here to create tasks" bubble pointing down at the tab bar's
// center + button (TabBarFAB). Rendered by app/(app)/_layout.tsx as an overlay
// above the tab bar rather than inside the button, where Android would clip it.
// Always visible; tapping it does the same as tapping the + button.
export function CreateTaskHint({ bottomOffset }: CreateTaskHintProps) {
  const { open } = useNewTaskModal();
  const appear = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, { toValue: 1, duration: 280, delay: 500, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [appear, bob]);

  const translateY = Animated.add(
    appear.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] })
  );

  return (
    // box-none: only the bubble itself catches taps, never the screen behind it.
    <View pointerEvents="box-none" style={[styles.container, { bottom: bottomOffset }]}>
      <Animated.View style={{ opacity: appear, transform: [{ translateY }] }}>
        <Pressable
          style={styles.bubble}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel="Create a task"
        >
          <Text style={styles.text}>Tap here to create tasks</Text>
        </Pressable>
        <View style={styles.arrow} />
      </Animated.View>
    </View>
  );
}

const ARROW_SIZE = 8;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bubble: {
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.full,
    paddingVertical: 9,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  // CSS-style triangle: transparent side borders, colored top border.
  arrow: {
    alignSelf: 'center',
    width: 0,
    height: 0,
    borderLeftWidth: ARROW_SIZE,
    borderRightWidth: ARROW_SIZE,
    borderTopWidth: ARROW_SIZE,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.textPrimary,
  },
});
