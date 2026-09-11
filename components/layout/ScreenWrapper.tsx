import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  View,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';
import { waitForNoPendingMutations } from '@/utils/pendingMutations';

// Perceptual luminance, not full WCAG (gamma correction isn't worth it for a
// binary status-bar-icon choice) — matches every hex in Colors (#RGB/#RRGGBB).
function isLightColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

interface ScreenWrapperProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  backgroundColor?: string;
  edges?: Edge[];
  // Only meaningful when scroll is true — attaches pull-to-refresh to the internal ScrollView.
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
}

export function ScreenWrapper({
  children,
  scroll = false,
  style,
  backgroundColor = Colors.white,
  edges = ['top', 'right', 'bottom', 'left'],
  onRefresh,
  refreshing = false,
}: ScreenWrapperProps) {
  // Waits out any save/create/delete still in flight before actually running
  // the caller's onRefresh — a pull-to-refresh's GET landing mid-write would
  // read pre-edit server data and stomp the correct optimistic local state
  // with it. The pull spinner (controlled by the caller's own `refreshing`
  // state) just keeps showing a little longer while this waits, which is the
  // right visible behavior — not a silent extra delay with no indication
  // anything's happening. See utils/pendingMutations.ts.
  const handleRefresh = onRefresh
    ? async () => {
        await waitForNoPendingMutations();
        await onRefresh();
      }
    : undefined;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={edges}>
      <StatusBar style={isLightColor(backgroundColor) ? 'dark' : 'light'} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scroll, style]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              handleRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={Colors.primaryLight}
                  colors={[Colors.primaryLight]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          // Plain View, not another SafeAreaView — the outer SafeAreaView above
          // already applies padding for `edges`, and react-native-safe-area-context
          // doesn't treat that as "consumed": a second SafeAreaView requesting the
          // same edges here would apply that same inset a second time, doubling
          // the gap (most visible as excess top padding on any non-scrolling screen).
          <View style={[styles.flex, style]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
});