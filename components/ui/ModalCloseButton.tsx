import { Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors } from '@/constants/theme';

interface ModalCloseButtonProps {
  onPress: () => void;
  // 'text' = "✕" glyph (AddClassModal/AddExamModal), 'icon' = IconSymbol
  // xmark (NewTaskModal) — same circular button shell, two established looks.
  variant?: 'text' | 'icon';
}

export function ModalCloseButton({ onPress, variant = 'text' }: ModalCloseButtonProps) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      {variant === 'icon' ? (
        <IconSymbol name="xmark" color={Colors.textSecondary} size={17} />
      ) : (
        <Text style={styles.text}>✕</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
