import { useEffect, useRef } from 'react';
import { Animated, Keyboard, KeyboardEvent, Platform } from 'react-native';

// RN's KeyboardAvoidingView doesn't reliably reset its height/offset once the keyboard
// closes inside a Modal on Android — the sheet ends up "floating" above the screen
// bottom. Tracking keyboard height ourselves and animating explicitly back to 0 on
// hide sidesteps that.
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
