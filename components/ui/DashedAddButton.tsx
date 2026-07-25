import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors } from '@/constants/theme';

interface DashedAddButtonProps {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function DashedAddButton({ label, onPress, style }: DashedAddButtonProps) {
  return (
    <Pressable style={[styles.button, style]} onPress={onPress}>
      <IconSymbol name="plus" color={Colors.primaryLight} size={18} />
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  text: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
