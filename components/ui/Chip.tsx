import { Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  // Background/border when selected — no sensible single default since each caller uses a
  // different color (category color, fixed brand color, etc).
  activeColor: string;
  // 'pill' (borderWidth 1.5, fontWeight 700) is the more common shape. 'compact' (fixed height
  // 34, borderWidth 1, fontWeight 600) is used for frequency chips.
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
