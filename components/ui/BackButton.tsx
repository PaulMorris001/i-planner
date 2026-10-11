import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { Routes, type AppRoute } from '@/constants/routes';
import { goBackOr } from '@/utils/navigation';

interface BackButtonProps {
  // Only the surrounding space differs: 'icon' sits flush with the page edge (list/detail
  // screens), 'text' sits inside a screen's own side padding (auth screens). Both look the same.
  variant?: 'icon' | 'text';
  onPress?: () => void;
  // Where Back goes when there is no screen behind this one (the app was opened straight onto it by a link).
  fallbackRoute?: AppRoute;
  style?: StyleProp<ViewStyle>;
}

// The one Back control in the app: a chevron and the word "Back" in a single tap target, so tapping
// either the arrow or the text goes back. The touch area extends beyond the drawn row.
export function BackButton({ variant = 'icon', onPress, fallbackRoute = Routes.DASHBOARD, style }: BackButtonProps) {
  const handlePress = onPress ?? (() => goBackOr(fallbackRoute));

  return (
    <Pressable
      style={({ pressed }) => [variant === 'text' ? styles.textRow : styles.iconRow, pressed && styles.pressed, style]}
      onPress={handlePress}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 20 }}
      accessibilityRole="button"
      accessibilityLabel="Back"
    >
      <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
      <Text style={styles.label}>Back</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },
});
