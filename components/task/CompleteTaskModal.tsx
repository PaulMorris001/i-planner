import { useEffect, useRef } from 'react';
import { Modal, View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import { ModalCloseButton } from '@/components/ui/ModalCloseButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { Task } from '@/types/task.types';

interface CompleteTaskModalProps {
  visible: boolean;
  task: Task | null;
  onClose: () => void;
  onConfirm: () => void;
}

// Angle (degrees, 0 = right, clockwise) + distance the sparkle travels from
// the badge's center, plus its color — purely decorative, no meaning to the
// values beyond "spread evenly around the badge."
const SPARKLES: { angle: number; distance: number; color: string }[] = [
  { angle: -75, distance: 44, color: '#FBBF24' },
  { angle: -25, distance: 52, color: '#34D399' },
  { angle: 25, distance: 52, color: '#60A5FA' },
  { angle: 75, distance: 44, color: '#F472B6' },
  { angle: 155, distance: 48, color: '#A78BFA' },
  { angle: -155, distance: 48, color: '#FBBF24' },
];

// Tapping a task to complete it opens this instead of toggling immediately —
// gives the user a beat to confirm (un-completing an already-done task still
// toggles instantly; only the positive "mark complete" direction pauses
// here), framed as a small celebration rather than a plain yes/no prompt.
// Reused across every place a task can be completed — see
// hooks/useTaskCompleteConfirm.ts.
//
// A centered dialog, not the app's usual BottomSheetModal — animationType is
// deliberately 'none' and every bit of motion (overlay fade, card pop, badge
// bounce, sparkle burst) is driven by this component's own Animated values
// instead. That's not just style: RN's built-in Modal transitions are
// native/OS-driven with no completion callback exposed, so the earlier
// bottom-sheet version of this had to guess at when that finished before
// starting the celebration. Owning the whole sequence means the badge/sparkle
// burst can instead key off the card's entrance actually finishing — exact,
// not a timing guess.
export function CompleteTaskModal({ visible, task, onClose, onConfirm }: CompleteTaskModalProps) {
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.9)).current;
  const badgeScale = useRef(new Animated.Value(0)).current;
  const sparkleProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    overlayOpacity.setValue(0);
    cardScale.setValue(0.9);
    badgeScale.setValue(0);
    sparkleProgress.setValue(0);

    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, friction: 8, tension: 70, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      // Staggered, not sequenced — the sparkles start while the badge is
      // still mid-bounce, not only once it's fully settled, so the burst
      // reads as one continuous "pop" instead of two separate steps.
      Animated.stagger(90, [
        Animated.spring(badgeScale, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
        Animated.timing(sparkleProgress, { toValue: 1, duration: 480, useNativeDriver: true }),
      ]).start();
    });
  }, [visible, overlayOpacity, cardScale, badgeScale, sparkleProgress]);

  if (!task) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <View style={styles.centerWrap} pointerEvents="box-none">
          <Animated.View
            style={[styles.card, { opacity: overlayOpacity, transform: [{ scale: cardScale }] }]}
          >
            <View style={styles.headerRow}>
              <View style={{ width: 34 }} />
              <ModalCloseButton onPress={onClose} />
            </View>

            <View style={styles.stage}>
              {SPARKLES.map((s, i) => {
                const rad = (s.angle * Math.PI) / 180;
                const translateX = sparkleProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.cos(rad) * s.distance],
                });
                const translateY = sparkleProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, Math.sin(rad) * s.distance],
                });
                // Fades in, holds, then fades back out — a burst, not a static ring.
                const opacity = sparkleProgress.interpolate({
                  inputRange: [0, 0.25, 0.75, 1],
                  outputRange: [0, 1, 1, 0],
                });
                const scale = sparkleProgress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.3, 1, 0.7] });
                return (
                  <Animated.View
                    key={i}
                    style={[
                      styles.sparkle,
                      { backgroundColor: s.color, opacity, transform: [{ translateX }, { translateY }, { scale }] },
                    ]}
                  />
                );
              })}
              <Animated.View style={[styles.iconBadge, { transform: [{ scale: badgeScale }] }]}>
                <IconSymbol name="checkmark" color={Colors.success} size={30} />
              </Animated.View>
            </View>

            <Text style={styles.title}>Nice work! 🎉</Text>
            <Text style={styles.subtitle}>Mark “{task.title}” as complete?</Text>

            <Pressable style={styles.primaryBtn} onPress={handleConfirm}>
              <Text style={styles.primaryBtnText}>Mark complete</Text>
            </Pressable>

            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Not yet</Text>
            </Pressable>
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,18,40,0.4)',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.offWhite,
    borderRadius: 24,
    padding: Spacing.md,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  stage: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: Spacing.md,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
    backgroundColor: Colors.success,
    borderRadius: 14,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  cancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 6,
  },
  cancelBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
