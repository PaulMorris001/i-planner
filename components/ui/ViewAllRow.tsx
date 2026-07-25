import { Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors } from '@/constants/theme';

interface ViewAllRowProps {
  label: string; // e.g. "View all 5 classes"
  onPress: () => void;
}

export function ViewAllRow({ label, onPress }: ViewAllRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
      <IconSymbol name="chevron.right" color={Colors.primaryLight} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
  },
  text: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
