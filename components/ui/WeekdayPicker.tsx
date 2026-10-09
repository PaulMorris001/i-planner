import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';
import { DAY_SHORT } from '@/utils/date';

interface WeekdayPickerProps {
  selected: number[]; // Monday-start weekday indices (0=Mon..6=Sun)
  onChange: (days: number[]) => void;
  activeColor?: string;
  // Lay the days out as a row of fixed-size pills you can swipe sideways, lined up with the
  // text above it, instead of squeezing all seven into the width.
  carousel?: boolean;
}

// Multi-select day-of-week row — lets a "weekly" recurrence land on more than
// one day (e.g. every Wednesday and Thursday) instead of just the start date's.
export function WeekdayPicker({ selected, onChange, activeColor = Colors.primary, carousel = false }: WeekdayPickerProps) {
  const toggle = (idx: number) => {
    onChange(
      selected.includes(idx) ? selected.filter((d) => d !== idx) : [...selected, idx].sort((a, b) => a - b)
    );
  };

  const days = (
    <>
      {DAY_SHORT.map((label, idx) => {
        const active = selected.includes(idx);
        return (
          <TouchableOpacity
            key={idx}
            style={[styles.day, carousel && styles.dayFixed, active && { backgroundColor: activeColor, borderColor: activeColor }]}
            onPress={() => toggle(idx)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  if (!carousel) return <View style={styles.row}>{days}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.carousel} contentContainerStyle={styles.carouselContent}>
      {days}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 6, marginTop: 12 },
  carousel: { marginTop: 12 },
  carouselContent: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md },
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
  dayFixed: { flex: 0, width: 58 },
  dayText: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary },
  dayTextActive: { color: Colors.white },
});
