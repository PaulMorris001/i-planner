import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { Routes, type AppRoute } from '@/constants/routes';
import { goBackOr } from '@/utils/navigation';

interface BackButtonProps {
  // 'icon' = chevron + "Back" (list/detail screens). 'text' = inline "← Back" (auth screens).
  variant?: 'icon' | 'text';
  onPress?: () => void;
  // Where Back goes when there is no screen behind this one (the app was opened straight onto it by a link).
  fallbackRoute?: AppRoute;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ variant = 'icon', onPress, fallbackRoute = Routes.DASHBOARD, style }: BackButtonProps) {
  const handlePress = onPress ?? (() => goBackOr(fallbackRoute));

  if (variant === 'text') {
    return (
      <Pressable style={[styles.textRow, style]} onPress={handlePress}>
        <Text style={styles.textLabel}>← Back</Text>
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.iconRow, style]} onPress={handlePress}>
      <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
      <Text style={styles.iconLabel}>Back</Text>
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
  iconLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  textRow: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    alignSelf: 'flex-start',
  },
  textLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
