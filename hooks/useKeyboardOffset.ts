import { useEffect, useRef } from 'react';
import { Animated, Keyboard, KeyboardEvent, Platform } from 'react-native';

// RN's KeyboardAvoidingView doesn't reliably reset its own height/offset once the
// keyboard closes inside a Modal on Android (a long-standing, widely-reported RN
// issue) — the sheet ends up "floating" above the screen bottom instead of settling
// back down. Tracking the keyboard height ourselves and explicitly animating back to
// exactly 0 on hide sidesteps that: there's no stale internal state to get stuck on.
export function useKeyboardOffset() {
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const animateTo = (value: number, duration: number) => {
      Animated.timing(offset, { toValue: value, duration, useNativeDriver: false }).start();
    };

    const showSub = Keyboard.addListener(showEvent, (e: KeyboardEvent) => {
      animateTo(e.endCoordinates.height, Platform.OS === 'ios' ? e.duration || 250 : 200);
    });
    const hideSub = Keyboard.addListener(hideEvent, (e: KeyboardEvent) => {
      animateTo(0, Platform.OS === 'ios' ? e.duration || 250 : 200);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [offset]);

  return offset;
}
