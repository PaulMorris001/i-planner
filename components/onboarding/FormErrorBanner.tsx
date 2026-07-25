import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius, Typography } from '@/constants/theme';

interface FormErrorBannerProps {
  message?: string;
}

export function FormErrorBanner({ message }: FormErrorBannerProps) {
  if (!message) return null;
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorBoxText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorBoxText: {
    ...Typography.caption,
    color: Colors.error,
  },
});
