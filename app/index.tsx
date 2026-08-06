import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/hooks/useAuth';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';

export default function Index() {
  const { hasOnboarded } = useOnboarding();
  const { user, initializing } = useAuth();

  // hasOnboarded (device-local, AsyncStorage) and user (Firebase session) are
  // independent and both async — wait for both before routing. Without this,
  // a device that finished onboarding but has no live session (expired
  // token, or — as happened here — every earlier build had broken Firebase
  // config so no session was ever established) lands straight on the
  // Dashboard with no auth, where every backend call silently 401s.
  if (hasOnboarded === null || initializing) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  if (!hasOnboarded) {
    return <Redirect href={Routes.WELCOME} />;
  }

  return <Redirect href={user ? Routes.DASHBOARD : Routes.LOGIN} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
});