import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { PurchasesProvider } from '@/contexts/PurchasesContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { HabitsProvider } from '@/contexts/HabitsContext';
import { PlanProvider } from '@/contexts/PlanContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GoalsProvider } from '@/contexts/GoalsContext';
import { TasksProvider } from '@/contexts/TasksContext';
import { SyllabiProvider } from '@/contexts/SyllabiContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PurchasesProvider>
        <OnboardingProvider>
          <PlanProvider>
            <SettingsProvider>
              <HabitsProvider>
                <GoalsProvider>
                  <TasksProvider>
                    <SyllabiProvider>
                      <StatusBar style="light" />
                      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
                    </SyllabiProvider>
                  </TasksProvider>
                </GoalsProvider>
              </HabitsProvider>
            </SettingsProvider>
          </PlanProvider>
        </OnboardingProvider>
      </PurchasesProvider>
    </AuthProvider>
  );
}
