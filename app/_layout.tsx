import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { HabitsProvider } from '@/contexts/HabitsContext';
import { PlanProvider } from '@/contexts/PlanContext';
import { SettingsProvider } from '@/contexts/SettingsContext';

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <PlanProvider>
        <SettingsProvider>
          <HabitsProvider>
            <StatusBar style="light" />
            <Stack screenOptions={{ headerShown: false }} />
          </HabitsProvider>
        </SettingsProvider>
      </PlanProvider>
    </OnboardingProvider>
  );
}
