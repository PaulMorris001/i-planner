import { View, Text, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function Planner() {
  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <View style={styles.root}>
        <Text style={styles.title}>Planner</Text>
        <Text style={styles.sub}>Your AI planner goes here.</Text>
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