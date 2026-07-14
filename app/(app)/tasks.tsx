import { View, Text, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Colors, Spacing, Typography } from '@/constants/theme';

export default function Tasks() {
  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} edges={['top', 'right', 'left']}>
      <View style={styles.root}>
        <Text style={styles.title}>Tasks</Text>
        <Text style={styles.sub}>Your task list goes here.</Text>
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