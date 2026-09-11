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

  // First-launch entry point is the path-intro carousel now, not Welcome
  // directly — Welcome (Get started / I already have an account) comes after
  // it. See path-intro.tsx's Skip/final-CTA and welcome.tsx's own buttons for
  // the rest of this chain.
  if (!hasOnboarded) {
    return <Redirect href={Routes.PATH_INTRO} />;
  }

  // Logged out but already onboarded (e.g. closed the app after logging out) —
  // Welcome, not Login directly, so a cold start always lands on the same
  // hero/CTA screen; "I already have an account" from there reaches Login.
  return <Redirect href={user ? Routes.DASHBOARD : Routes.WELCOME} />;
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