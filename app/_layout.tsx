import { useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/contexts/AuthContext';
import { PurchasesProvider } from '@/contexts/PurchasesContext';
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { HabitsProvider } from '@/contexts/HabitsContext';
import { NotesProvider } from '@/contexts/NotesContext';
import { BillsProvider } from '@/contexts/BillsContext';
import { SavingsGoalsProvider } from '@/contexts/SavingsGoalsContext';
import { PlanProvider } from '@/contexts/PlanContext';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { GoalsProvider } from '@/contexts/GoalsContext';
import { TasksProvider } from '@/contexts/TasksContext';
import { SyllabiProvider } from '@/contexts/SyllabiContext';
import { initNotificationHandler } from '@/utils/notifications';

// Catches render/startup errors and shows them on screen — used in production
// too, where the default is a blank screen with no way to see what failed.
// Styled inline with plain RN primitives so it can't itself fail on a broken
// theme/context import.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: '#1a1a2e', paddingTop: 80, paddingHorizontal: 24 }}>
      <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>
        Something went wrong
      </Text>
      <ScrollView style={{ flex: 1 }}>
        <Text style={{ color: '#ff8a8a', fontSize: 14, marginBottom: 16 }}>{error.message}</Text>
        <Text style={{ color: '#9a9ab0', fontSize: 11, fontFamily: 'Courier' }}>{error.stack}</Text>
      </ScrollView>
      <Pressable
        onPress={retry}
        style={{ backgroundColor: '#4a4ae0', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 40 }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '700' }}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  // Deferred to after first mount rather than module-import time — see
  // utils/notifications.ts for why.
  useEffect(() => {
    initNotificationHandler();
  }, []);

  return (
    <AuthProvider>
      <PurchasesProvider>
        <OnboardingProvider>
          <PlanProvider>
            <SettingsProvider>
              <HabitsProvider>
                <NotesProvider>
                  <BillsProvider>
                    <SavingsGoalsProvider>
                      <GoalsProvider>
                        <TasksProvider>
                          <SyllabiProvider>
                            <StatusBar style="dark" />
                            <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
                          </SyllabiProvider>
                        </TasksProvider>
                      </GoalsProvider>
                    </SavingsGoalsProvider>
                  </BillsProvider>
                </NotesProvider>
              </HabitsProvider>
            </SettingsProvider>
          </PlanProvider>
        </OnboardingProvider>
      </PurchasesProvider>
    </AuthProvider>
  );
}
