import { View, Text, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Colors, Spacing, Typography } from '@/constants/theme';

const focusLabelMap = {
  student: 'Student',
  exam_candidate: 'Exam candidate',
  professional: 'Professional',
} as const;

export default function Dashboard() {
  const { focusProfile } = useOnboarding();
  const focusLabel = focusProfile ? focusLabelMap[focusProfile] : null;

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <View style={styles.root}>
        <Text style={styles.title}>Dashboard</Text>
        {focusLabel ? (
          <Text style={styles.sub}>You're planning as a {focusLabel}.</Text>
        ) : (
          <Text style={styles.sub}>Your overview goes here.</Text>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sub: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
});