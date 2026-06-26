import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Colors, Radius, Typography } from '@/constants/theme';

type BadgeVariant = 'accent' | 'primary' | 'success' | 'muted';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'muted', style }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      <Text style={[styles.label, styles[`${variant}Label`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  label: {
    ...Typography.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Variants
  accent: {
    backgroundColor: Colors.accentLight,
    borderColor: 'rgba(93, 202, 165, 0.3)',
  },
  accentLabel: { color: Colors.success },

  primary: {
    backgroundColor: 'rgba(26, 20, 99, 0.08)',
    borderColor: 'rgba(26, 20, 99, 0.15)',
  },
  primaryLabel: { color: Colors.primary },

  success: {
    backgroundColor: 'rgba(29, 158, 117, 0.1)',
    borderColor: 'rgba(29, 158, 117, 0.2)',
  },
  successLabel: { color: Colors.success },

  muted: {
    backgroundColor: Colors.offWhite,
    borderColor: Colors.border,
  },
  mutedLabel: { color: Colors.textSecondary },
});