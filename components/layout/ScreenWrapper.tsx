import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '@/constants/theme';

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
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={Colors.primaryLight}
                  colors={[Colors.primaryLight]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <SafeAreaView style={[styles.flex, style]} edges={edges}>
            {children}
          </SafeAreaView>
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