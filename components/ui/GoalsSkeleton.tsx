import { View, StyleSheet } from 'react-native';
import { SkeletonBlock } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/theme';

// Approximates a couple of goal cards (tag/pct header, title, progress bar, a
// couple of milestone rows) so opening the Goals page doesn't flash "No goals
// yet" for a beat before the real list arrives.
export function GoalsSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.headerRow}>
            <SkeletonBlock width={70} height={11} />
            <SkeletonBlock width={28} height={11} />
          </View>
          <SkeletonBlock width="70%" height={16} style={{ marginTop: 10 }} />
          <SkeletonBlock height={7} borderRadius={999} style={{ marginTop: 12 }} />

          <View style={styles.milestoneList}>
            {[0, 1].map((j) => (
              <View key={j} style={styles.milestoneRow}>
                <SkeletonBlock width={18} height={18} borderRadius={5} />
                <SkeletonBlock width="60%" height={13} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 11,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  milestoneList: {
    marginTop: 14,
    gap: 10,
  },
  milestoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
