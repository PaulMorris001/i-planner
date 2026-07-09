import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { HabitsProvider } from '@/contexts/HabitsContext';

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <HabitsProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </HabitsProvider>
    </OnboardingProvider>
  );
}
