import { useEffect, useRef } from 'react';
import { Animated, DimensionValue, ViewStyle } from 'react-native';
import { Colors } from '@/constants/theme';

interface SkeletonBlockProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// A single pulsing placeholder shape — the building block for every skeleton
// loading state in the app (currently just the Dashboard, but reusable anywhere
// a screen fetches data before it can render its real content).
export function SkeletonBlock({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBlockProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius, backgroundColor: Colors.border, opacity }, style]}
    />
  );
}
