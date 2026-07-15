import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

interface AnimatedProgressBarProps {
  pct: number;
  color: string;
}

// Renders just the animated fill — the caller wraps it in its own sized/styled
// track View (heights/radii differ slightly between the Goals list and the
// Dashboard's cards, so the track itself isn't part of this component).
export function AnimatedProgressBar({ pct, color }: AnimatedProgressBarProps) {
  const widthAnim = useRef(new Animated.Value(pct)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width isn't animatable via the native driver
    }).start();
  }, [pct, widthAnim]);

  const width = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return <Animated.View style={[styles.fill, { width, backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
