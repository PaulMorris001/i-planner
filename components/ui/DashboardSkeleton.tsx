import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { Colors, Spacing } from '@/constants/theme';

// Approximates the general shape/rhythm of the real Dashboard (stat row, a couple
// of full-width cards, the Coach/Habits cards, quick links) without needing to
// match any one of the three path variants (student/exam/professional) exactly —
// just enough to avoid the sharp "content pops in from nothing" glitch while
// plan/tasks/habits are still loading.
export function DashboardSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <SkeletonBlock width={70} height={11} />
          <SkeletonBlock width={50} height={24} style={{ marginTop: 10 }} />
        </View>
        <View style={styles.statCard}>
          <SkeletonBlock width={70} height={11} />
          <SkeletonBlock width={100} height={16} style={{ marginTop: 12 }} />
        </View>
      </View>

      <View style={styles.card}>
        <SkeletonBlock width={120} height={13} />
        <SkeletonBlock height={44} borderRadius={12} style={{ marginTop: 12 }} />
        <SkeletonBlock height={44} borderRadius={12} style={{ marginTop: 8 }} />
      </View>

      <View style={styles.card}>
        <SkeletonBlock width={100} height={13} />
        <SkeletonBlock height={44} borderRadius={12} style={{ marginTop: 12 }} />
        <SkeletonBlock height={44} borderRadius={12} style={{ marginTop: 8 }} />
        <SkeletonBlock height={44} borderRadius={12} style={{ marginTop: 8 }} />
      </View>

      <SkeletonBlock height={70} borderRadius={17} />
      <SkeletonBlock height={70} borderRadius={17} />

      <View style={styles.quickLinksRow}>
        <SkeletonBlock height={100} borderRadius={16} style={{ flex: 1 }} />
        <SkeletonBlock height={100} borderRadius={16} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 11,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 15,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 18,
    padding: 17,
  },
  quickLinksRow: {
    flexDirection: 'row',
    gap: 11,
  },
});
