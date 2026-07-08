import { Pressable, StyleSheet } from 'react-native';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius } from '@/constants/theme';
import { useNewTaskModal } from '@/contexts/NewTaskModalContext';

export function TabBarFAB({ accessibilityState }: BottomTabBarButtonProps) {
  const { open } = useNewTaskModal();

  return (
    <Pressable
      onPress={open}
      accessibilityState={accessibilityState}
      style={styles.button}
      hitSlop={12}
    >
      <IconSymbol name="plus" color={Colors.white} size={28} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    top: -20,
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
