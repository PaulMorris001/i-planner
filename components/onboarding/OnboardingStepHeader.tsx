import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface OnboardingStepHeaderProps {
  stepLabel: string; // e.g. "Step 2 of 3"
  progress: number; // 0-1
  onBack?: () => void;
}

// Sticky header shared by the three onboarding path screens.
export function OnboardingStepHeader({ stepLabel, progress, onBack }: OnboardingStepHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.stickyHeader, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack ?? (() => router.back())} activeOpacity={0.7}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>{stepLabel}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <AnimatedProgressBar pct={progress * 100} color={Colors.primary} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { fontSize: 18, color: Colors.textSecondary, lineHeight: 22 },
  backLabel: { ...Typography.body, fontWeight: '500', color: Colors.textSecondary },
  stepBadge: { backgroundColor: Colors.overlay, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  stepText: { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary },
  progressTrack: { height: 5, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
});
