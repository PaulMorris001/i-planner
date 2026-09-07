import { View, Image, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/hooks/useAuth';
import { Routes } from '@/constants/routes';
import { Colors } from '@/constants/theme';

export default function Index() {
  const { hasOnboarded } = useOnboarding();
  const { user, initializing } = useAuth();

  // hasOnboarded (AsyncStorage) and user (Firebase session) are independent and both
  // async — wait for both, or an onboarded device with no live session lands on
  // Dashboard unauthenticated and every backend call silently 401s. Shows the app's
  // own logo (same artwork as the native splash screen) instead of a bare spinner,
  // so this reads as a continuation of the splash rather than a generic loading state.
  if (hasOnboarded === null || initializing) {
    return (
      <View style={styles.loading}>
        <StatusBar style="light" />
        <Image
          source={require('@/assets/images/splash-icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
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
  logo: {
    width: 140,
    height: 140,
  },
});