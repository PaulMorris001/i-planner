import { useEffect } from 'react';
import { Keyboard, Platform, Text, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/theme';

interface InlineDateTimePickerProps {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
  // Android's picker is a dialog that closes itself after a pick/cancel, so the caller needs to
  // flip its own `visible` state back off. iOS's inline spinner has no such dismiss moment, so
  // this component supplies its own "Done" button that calls it instead.
  onDismiss: () => void;
  minimumDate?: Date;
}

// Wraps @react-native-community/datetimepicker with this app's standard display/theme/platform-
// dismiss behavior. Deliberately doesn't own the trigger button — that varies too much per caller
// (emoji vs icon, optional Clear button, optional field label) to force into one shared shape.
export function InlineDateTimePicker({ visible, value, mode, onChange, onDismiss, minimumDate }: InlineDateTimePickerProps) {
  // A text field can still be focused when the trigger button is tapped (ScrollViews here use
  // keyboardShouldPersistTaps="handled"), which would otherwise leave the keyboard docked below
  // this picker — dismiss it so the picker is all that's showing.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  if (!visible) return null;
  return (
    <>
      <DateTimePicker
        value={value}
        mode={mode}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        themeVariant="light"
        minimumDate={minimumDate}
        onChange={(_, date) => {
          if (Platform.OS === 'android') onDismiss();
          if (date) onChange(date);
        }}
      />
      {Platform.OS === 'ios' && (
        <TouchableOpacity style={styles.doneBtn} onPress={onDismiss} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  doneBtn: { alignSelf: 'flex-end', paddingVertical: 8, paddingHorizontal: 16 },
  doneBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
});
