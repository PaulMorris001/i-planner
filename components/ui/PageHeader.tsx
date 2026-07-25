import { Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  // Two of the six screens using this header (cert-tracker, plans) use 25
  // instead of the usual 26 — preserved as a prop rather than picking one.
  titleSize?: number;
  // plans.tsx's subtitle is 13.5 instead of the usual 14 — same reasoning.
  subtitleSize?: number;
}

export function PageHeader({ title, subtitle, titleSize = 26, subtitleSize = 14 }: PageHeaderProps) {
  return (
    <>
      <Text style={[styles.title, { fontSize: titleSize }]}>{title}</Text>
      {!!subtitle && <Text style={[styles.subtitle, { fontSize: subtitleSize }]}>{subtitle}</Text>}
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 12,
    paddingHorizontal: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
    paddingHorizontal: Spacing.md,
  },
});
