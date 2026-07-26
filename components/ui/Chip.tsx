import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  // Background/border when selected — each caller's chips select a different
  // color (a category's own color, a fixed brand color, etc), so there's no
  // sensible single default.
  activeColor: string;
  // 'pill' (borderWidth 1.5, fontWeight 700) is the more common shape —
  // habits.tsx's category/frequency chips, NewTaskModal's category chips,
  // NewGoalModal's type chip. 'compact' (fixed height 34, borderWidth 1,
  // fontWeight 600) is AddClassModal's and NewTaskModal's frequency chips.
  size?: 'pill' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected, onPress, activeColor, size = 'pill', style }: ChipProps) {
  return (
    <Pressable
      style={[
        styles.base,
        size === 'pill' ? styles.pill : styles.compact,
        selected && { backgroundColor: activeColor, borderColor: activeColor },
        style,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.text,
          { fontWeight: size === 'pill' ? '700' : '600' },
          selected ? styles.textActive : styles.textInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: Colors.white,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderWidth: 1.5,
    paddingVertical: 9,
  },
  compact: {
    borderWidth: 1,
    height: 34,
  },
  text: {
    fontSize: 13,
  },
  textInactive: {
    color: Colors.textSecondary,
  },
  textActive: {
    color: Colors.white,
  },
});
