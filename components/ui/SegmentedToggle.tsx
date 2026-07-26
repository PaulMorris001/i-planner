import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface SegmentedToggleProps<T extends string> {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  style?: StyleProp<ViewStyle>;
  // coach.tsx's mode toggle uses 12.5 instead of planner.tsx's 13.
  textSize?: number;
}

// 2-3 option pill toggle — planner.tsx's Day/Week view switch and coach.tsx's
// mode switch, independently hand-rolled with identical structure/styles.
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  style,
  textSize = 13,
}: SegmentedToggleProps<T>) {
  return (
    <View style={[styles.segmented, style]}>
      {options.map((opt) => {
        const active = value === opt.key;
        return (
          <Pressable
            key={opt.key}
            style={[styles.segment, active && styles.segmentActive]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[active ? styles.segmentTextActive : styles.segmentText, { fontSize: textSize }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    gap: 5,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 4,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  segmentActive: {
    backgroundColor: Colors.white,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  segmentText: {
    fontWeight: '700',
    color: Colors.textMuted,
  },
  segmentTextActive: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
