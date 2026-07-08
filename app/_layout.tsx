import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingProvider } from '@/contexts/OnboardingContext';

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
