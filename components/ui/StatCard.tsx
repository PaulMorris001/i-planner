import type { ReactNode } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface StatCardProps {
  label: string;
  // Dashboard's student/exam stat rows split 1.3/0.7 instead of an even
  // split — everything else (Professional's row, cert-tracker) uses the
  // default even flex.
  flex?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}

// Just the label + card shell — callers supply their own value/title/date
// content as children, since that shape varies (a big number, a title+date
// pair, a title with no date, a value + action button) more than it's worth
// forcing into one rigid layout.
export function StatCard({ label, flex, style, children }: StatCardProps) {
  return (
    <View style={[styles.card, flex !== undefined && { flex }, style]}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 12,
  },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
