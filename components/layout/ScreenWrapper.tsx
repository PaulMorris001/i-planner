import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  Platform,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/theme';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
  backgroundColor?: string;
  edges?: Edge[];
  // Only meaningful when scroll is true — attaches pull-to-refresh to the
  // internal ScrollView.
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