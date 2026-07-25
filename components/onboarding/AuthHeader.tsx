import type { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '@/constants/theme';

interface AuthHeaderProps {
  title: string;
  subtitle: string;
  // e.g. register.tsx's logo mark, rendered above the title.
  children?: ReactNode;
}

export function AuthHeader({ title, subtitle, children }: AuthHeaderProps) {
  return (
    <View style={styles.header}>
      {children}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});
