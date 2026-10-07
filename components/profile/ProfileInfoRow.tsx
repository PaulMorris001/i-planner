import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';

interface ProfileInfoRowProps {
  label: string;
  value: string;
  // When set the row can be tapped (and its value is drawn in the app's blue).
  onPress?: () => void;
}

// One "label ........ value" line in the Profile info card's details list.
export function ProfileInfoRow({ label, value, onPress }: ProfileInfoRowProps) {
  const content = (
    <>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, !!onPress && styles.valueLink]} numberOfLines={1}>
        {value}
      </Text>
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" hitSlop={4}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 7 },
  label: { fontSize: 13, color: Colors.textMuted },
  value: { flexShrink: 1, fontSize: 14.5, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  valueLink: { color: Colors.primaryLight },
});
