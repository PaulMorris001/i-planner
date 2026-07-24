import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TabBarFAB } from '@/components/ui/TabBarFAB';
import { NewTaskModalProvider } from '@/contexts/NewTaskModalContext';
import { NewTaskModal } from '@/components/task/NewTaskModal';

export default function AppLayout() {
  const insets = useSafeAreaInsets();

  return (
    <NewTaskModalProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            backgroundColor: Colors.white,
            height: 60 + insets.bottom,
            paddingBottom: 8 + insets.bottom,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '500',
          },
        }}
      >
        <Tabs.Screen
          name="dashboard"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => <IconSymbol name="house.fill" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: 'Planner',
            tabBarIcon: ({ color, size }) => <IconSymbol name="calendar" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: '',
            tabBarButton: (props) => <TabBarFAB {...props} />,
          }}
        />
        <Tabs.Screen
          name="coach"
          options={{
            title: 'Coach',
            tabBarIcon: ({ color, size }) => <IconSymbol name="sparkles" color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => <IconSymbol name="person.fill" color={color} size={size} />,
          }}
        />
      </Tabs>
      <NewTaskModal />
    </NewTaskModalProvider>
  );
}
