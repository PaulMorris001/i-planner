import {
  TouchableOpacity,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Radius, Colors } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, onPress, style }: CardProps) {
  return (
    <TouchableOpacity
      style={[styles.base, style]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    backgroundColor: Colors.white,
  },
});