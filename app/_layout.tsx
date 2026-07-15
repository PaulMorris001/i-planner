import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { HabitsProvider } from '@/contexts/HabitsContext';
import { PlanProvider } from '@/contexts/PlanContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GoalsProvider } from '@/contexts/GoalsContext';

export default function RootLayout() {
  return (
    <OnboardingProvider>
      <PlanProvider>
        <SettingsProvider>
          <HabitsProvider>
            <GoalsProvider>
              <StatusBar style="light" />
              <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
            </GoalsProvider>
          </HabitsProvider>
        </SettingsProvider>
      </PlanProvider>
    </OnboardingProvider>
  );
}
