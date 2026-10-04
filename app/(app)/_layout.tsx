import { View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { TabBarFAB } from '@/components/ui/TabBarFAB';
import { CreateTaskHint } from '@/components/ui/CreateTaskHint';

// Tab bar geometry, shared with the hint's position below.
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_BAR_PADDING = 8;

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Always shown, except on Coach, where the chat input sits right above the
  // tab bar and the bubble would cover it.
  const showCreateTaskHint = pathname !== '/coach';
  // The + button fills the tab bar's content area, so its top edge sits this
  // far above the bottom of the screen.
  const fabTop = insets.bottom + TAB_BAR_PADDING + (TAB_BAR_CONTENT_HEIGHT - TAB_BAR_PADDING * 2);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.textMuted,
          tabBarStyle: {
            borderTopWidth: 1,
            borderTopColor: Colors.border,
            backgroundColor: Colors.white,
            height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
            paddingBottom: TAB_BAR_PADDING + insets.bottom,
            paddingTop: TAB_BAR_PADDING,
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
      {showCreateTaskHint && <CreateTaskHint bottomOffset={fabTop + 6} />}
    </View>
  );
}
