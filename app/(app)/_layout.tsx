import { Tabs } from 'expo-router';
import { Colors } from '@/constants/theme';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          backgroundColor: Colors.white,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Home' }} />
      <Tabs.Screen name="planner"   options={{ title: 'Planner' }} />
      <Tabs.Screen name="tasks"     options={{ title: 'Tasks' }} />
      <Tabs.Screen name="profile"   options={{ title: 'Profile' }} />
    </Tabs>
  );
}