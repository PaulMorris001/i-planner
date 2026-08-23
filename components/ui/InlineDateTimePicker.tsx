import { Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface InlineDateTimePickerProps {
  visible: boolean;
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
  // Android's picker is a dialog that closes itself after a pick/cancel — the
  // caller needs to know so it can flip its own `visible` state back off.
  // iOS's inline spinner has no such moment; this never fires there.
  onDismiss: () => void;
  minimumDate?: Date;
}

// Wraps @react-native-community/datetimepicker with this app's standard
// display/theme/platform-dismiss behavior — was independently redefined
// (identical `display`/`themeVariant` props and identical
// `if (Platform.OS === 'android') ...; if (date) ...` onChange shape) at 7
// call sites across AddClassModal.tsx (x2), NewTaskModal.tsx (x2),
// NewGoalModal.tsx, SyllabusUploadModal.tsx, and student-plan.tsx before
// being consolidated here. Deliberately doesn't own the trigger button —
// that varies too much per caller (emoji vs icon, optional Clear button,
// optional field label) to force into one shared shape.
export function InlineDateTimePicker({ visible, value, mode, onChange, onDismiss, minimumDate }: InlineDateTimePickerProps) {
  if (!visible) return null;
  return (
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
  );
}
