import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Colors, Spacing, Radius } from '@/constants/theme';

export const EXAM_NAME_PLACEHOLDER = 'SIE';
export const EXAM_TOPIC_COUNT = 10;

export const WEEKS_MIN = 4;
export const WEEKS_MAX = 20;
export const HOURS_MIN = 2;
export const HOURS_MAX = 30;

export const DEFAULT_EXAM_WEEKS = 10;
export const DEFAULT_EXAM_HOURS = 8;

interface ExamSetupFormProps {
  examName: string;
  onExamNameChange: (name: string) => void;
  weeks: number;
  hours: number;
  onWeeksChange: (weeks: number) => void;
  onHoursChange: (hours: number) => void;
}

export function ExamSetupForm({
  examName,
  onExamNameChange,
  weeks,
  hours,
  onWeeksChange,
  onHoursChange,
}: ExamSetupFormProps) {
  const totalHours = weeks * hours;
  const displayName = examName.trim() || EXAM_NAME_PLACEHOLDER;

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Exam</Text>
          <TextInput
            style={styles.examNameInput}
            value={examName}
            onChangeText={onExamNameChange}
            placeholder={EXAM_NAME_PLACEHOLDER}
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
          />
        </View>

        <View style={[styles.row, styles.rowBorder]}>
          <Text style={styles.rowLabel}>Weeks until exam</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => onWeeksChange(Math.max(WEEKS_MIN, weeks - 1))}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{weeks}</Text>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => onWeeksChange(Math.min(WEEKS_MAX, weeks + 1))}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.rowLabel}>Available hours / week</Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => onHoursChange(Math.max(HOURS_MIN, hours - 1))}
            >
              <Text style={styles.stepperBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepperValue}>{hours}</Text>
            <Pressable
              style={styles.stepperBtn}
              onPress={() => onHoursChange(Math.min(HOURS_MAX, hours + 1))}
            >
              <Text style={styles.stepperBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.hintBox}>
        <Text style={styles.hintText}>
          That's <Text style={styles.hintBold}>{totalHours} hours</Text> of study — enough to cover
          all {EXAM_TOPIC_COUNT} {displayName} topic areas with review time.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  examNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
    padding: 0,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 18,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  stepperValue: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 24,
    textAlign: 'center',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.infoSoft,
    borderRadius: 13,
    padding: 14,
    marginTop: 14,
  },
  hintText: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    color: Colors.primary,
    lineHeight: 19,
  },
  hintBold: {
    fontWeight: '700',
  },
});
