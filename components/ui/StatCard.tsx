import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface StatCardProps {
  label: string;
  // Dashboard's student/exam stat rows split 1.3/0.7 instead of an even split.
  flex?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  // Optional — most stat cards are display-only. When given, the whole card
  // becomes a Pressable (with a subtle press state) instead of a plain View.
  onPress?: () => void;
}

// Just the label + card shell — callers supply their own value/title/date content as children,
// since that shape varies more than it's worth forcing into one rigid layout.
export function StatCard({ label, flex, style, children, onPress }: StatCardProps) {
  const content = (
    <>
      <Text style={styles.label}>{label}</Text>
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, flex !== undefined && { flex }, pressed && styles.cardPressed, style]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.card, flex !== undefined && { flex }, style]}>{content}</View>;
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
  cardPressed: {
    opacity: 0.6,
  },
  label: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '600',
  },
});
