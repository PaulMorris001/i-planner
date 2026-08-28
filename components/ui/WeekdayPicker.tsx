import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '@/constants/theme';
import { DAY_SHORT } from '@/utils/date';

interface WeekdayPickerProps {
  selected: number[]; // Monday-start weekday indices (0=Mon..6=Sun)
  onChange: (days: number[]) => void;
  activeColor?: string;
}

// Multi-select day-of-week row — lets a "weekly" recurrence land on more than
// one day (e.g. every Wednesday and Thursday) instead of just the start date's.
export function WeekdayPicker({ selected, onChange, activeColor = Colors.primary }: WeekdayPickerProps) {
  const toggle = (idx: number) => {
    onChange(
      selected.includes(idx) ? selected.filter((d) => d !== idx) : [...selected, idx].sort((a, b) => a - b)
    );
  };

  return (
    <View style={styles.row}>
      {DAY_SHORT.map((label, idx) => {
        const active = selected.includes(idx);
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.day, active && { backgroundColor: activeColor, borderColor: activeColor }]}
            onPress={() => toggle(idx)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayText, active && styles.dayTextActive]}>{label[0]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 12 },
  day: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  dayTextActive: { color: Colors.white },
});
