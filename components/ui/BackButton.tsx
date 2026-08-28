import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from './icon-symbol';
import { Colors, Spacing, Typography } from '@/constants/theme';

interface BackButtonProps {
  // 'icon' = chevron + "Back" (list/detail screens). 'text' = inline "← Back" (auth screens).
  variant?: 'icon' | 'text';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function BackButton({ variant = 'icon', onPress, style }: BackButtonProps) {
  const handlePress = onPress ?? (() => router.back());

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
