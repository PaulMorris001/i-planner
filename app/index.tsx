import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboarding } from '@/hooks/useOnboarding';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';

export default function Index() {
  const { hasOnboarded } = useOnboarding();

  if (hasOnboarded === null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <Redirect href={hasOnboarded ? Routes.DASHBOARD : Routes.WELCOME} />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
});