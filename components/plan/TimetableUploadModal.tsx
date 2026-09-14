import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import {
  ClassFieldsEditor,
  isClassFieldsValid,
  defaultClassFields,
  buildClassItem,
  type ClassFieldsValue,
} from '@/components/plan/ClassFieldsEditor';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { FEATURE_MIN_TIER, TIER_LABEL, hasTier } from '@/constants/featureTiers';
import { Routes } from '@/constants/routes';
import { parseISODateLocal, formatDatePickerLabel, localMidnight } from '@/utils/date';
import { usePurchases } from '@/contexts/PurchasesContext';
import { useTimetableUploadModal } from '@/contexts/TimetableUploadModalContext';
import { timetableService } from '@/services/timetable.service';
import { useClassActions } from '@/hooks/useClassActions';
import { useSettings } from '@/hooks/useSettings';
import { useFilePicker, formatFileSize } from '@/hooks/useFilePicker';
import { useFakeExtractionProgress } from '@/hooks/useFakeExtractionProgress';
import { getNotificationHeadroom } from '@/utils/notifications';
import type { ClassItem } from '@/types/plan.types';

interface DraftClassRow {
  key: string;
  fields: ClassFieldsValue;
}

type Step = 'pick' | 'preview' | 'upgrade' | 'extracting' | 'semester-dates' | 'review' | 'creating' | 'success';

const EXTRACT_STATUS_MESSAGES = [
  'Reading your timetable…',
  'Finding your classes…',
  'Working out days and times…',
  'Almost there…',
];

// Strict 24-hour "HH:MM" parser for the AI's extracted times — deliberately
// NOT utils/date.ts's parseTimeToDate/parseTimeToMinutes, whose regex treats
// a missing AM/PM suffix as ambiguous in a way that would silently misread
// "14:30" as 2:30 AM instead of 2:30 PM. Returns today's date at that
// time-of-day (same convention as parseTimeToDate) for handing to
// InlineDateTimePicker, or null if unparseable.
function parse24HourTime(hhmm: string): Date | null {
  const match = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

// Stamps every row with the same recurrence window — used both when the
// document itself stated term dates and when the user enters them on the
// 'semester-dates' step. Only startDate/endDate change; everything else
// about each row (days, time, professor, venue) is left alone.
function applySemesterWindow(rows: DraftClassRow[], start: Date, end: Date): DraftClassRow[] {
  return rows.map((r) => ({ ...r, fields: { ...r.fields, startDate: start, endDate: end } }));
}

interface SuccessSummary {
  savedCount: number;
  totalCount: number;
  failedCount: number;
}

// Mirrors SyllabusUploadModal's shape closely (same step machine, same
// pick/preview/extracting/review/creating/success flow) but for classes
// instead of deadlines — see the plan doc (timetable upload feature) for the
// full reasoning behind the extraction schema and the bulk-save path.
//
// Takes no props, unlike SyllabusUploadModal — mounted once at the root
// layout (see app/_layout.tsx) and driven by TimetableUploadModalContext, the
// same "one instance, opened from anywhere" pattern NewTaskModal already
// uses. Needed because its only entry point (the side-menu drawer,
// ProfileInfoModal.tsx) is itself rendered separately by several different
// screens — a single shared instance avoids mounting/owning this modal's
// state redundantly in every one of them.
export function TimetableUploadModal() {
  const router = useRouter();
  const { isOpen: visible, close: onClose } = useTimetableUploadModal();
  const { saveClasses } = useClassActions();
  const { tier } = usePurchases();
  const { remindersEnabled } = useSettings();

  const [step, setStep] = useState<Step>('pick');
  const { pickedAsset, pickDocument, pickPhoto, reset: resetPicker } = useFilePicker('timetable-photo');
  const [rows, setRows] = useState<DraftClassRow[]>([]);
  // The term's date range — either read straight off the document by the AI,
  // or (when it couldn't find one) picked by the user on the 'semester-dates'
  // step below. Applied to every row's startDate/endDate so each class
  // recurs for exactly the weeks of the term instead of forever; kept here
  // too (not just baked into the rows) so a manually "+ Add class" row during
  // review gets the same window automatically.
  const [semesterStart, setSemesterStart] = useState<Date | null>(null);
  const [semesterEnd, setSemesterEnd] = useState<Date | null>(null);
  // Which row's date/time picker is open, and which of the three — only one
  // InlineDateTimePicker is ever mounted at a time, shared across every row,
  // same idiom as SyllabusUploadModal's single shared date picker.
  const [openPicker, setOpenPicker] = useState<{ key: string; mode: 'date' | 'endDate' | 'time' } | null>(null);
  // Which of the two 'semester-dates' step pickers is open — a separate,
  // simpler piece of state since that step has exactly two fixed fields, not
  // a dynamic list of rows.
  const [semesterPickerOpen, setSemesterPickerOpen] = useState<'start' | 'end' | null>(null);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);
  const { progress: extractProgress, statusMessage: extractStatusMessage } = useFakeExtractionProgress(
    step === 'extracting',
    EXTRACT_STATUS_MESSAGES
  );
  // Bumped by reset() — an in-flight handleProcess call checks this after its
  // await resolves and no-ops if it's changed, so closing the modal mid-
  // extraction can't have a request that finally resolves later still try to
  // update a modal the user already dismissed and reset.
  const processGenerationRef = useRef(0);

  const reset = () => {
    processGenerationRef.current += 1;
    setStep('pick');
    resetPicker();
    setRows([]);
    setSemesterStart(null);
    setSemesterEnd(null);
    setOpenPicker(null);
    setSemesterPickerOpen(null);
    setSuccessSummary(null);
  };

  useEffect(() => {
    if (visible) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = () => {
    // Same rule as SyllabusUploadModal: 'creating' (the bulk save) stays
    // protected; 'extracting' doesn't, so a hung/slow AI call always leaves
    // the user a way out.
    if (step === 'creating') return;
    onClose();
    reset();
  };

  const handlePickDocument = async () => {
    if (await pickDocument()) setStep('preview');
  };

  const handlePickPhoto = async () => {
    if (await pickPhoto()) setStep('preview');
  };

  const handleProcess = async () => {
    if (!pickedAsset) {
      Alert.alert("Couldn't process", 'No file was found — please choose your file again.');
      setStep('pick');
      return;
    }
    const asset = pickedAsset;

    // Unlike syllabus, there's no free-allowance count here — a timetable is
    // realistically uploaded once per term, so the gate is tier-only from
    // the first use. See the plan doc for the reasoning.
    if (!hasTier(tier, FEATURE_MIN_TIER.timetable_extraction)) {
      setStep('upgrade');
      return;
    }

    const generation = ++processGenerationRef.current;
    setStep('extracting');
    try {
      const fileBase64 = asset.base64 ?? (await new File(asset.uri).base64());
      const extraction = await timetableService.extract({ fileBase64, filename: asset.name });
      if (processGenerationRef.current !== generation) return;

      const draftRows: DraftClassRow[] = extraction.meetings.map((m, i) => {
        const days = Array.from(new Set(m.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))).sort(
          (a, b) => a - b
        );
        return {
          key: `ex-${i}`,
          fields: {
            ...defaultClassFields(),
            className: m.courseName,
            selectedDays: days,
            time: parse24HourTime(m.startTime),
            professor: m.professor ?? '',
            venue: m.venue ?? '',
          },
        };
      });
      const seededRows = draftRows.length > 0 ? draftRows : [{ key: `custom-${Date.now()}`, fields: defaultClassFields() }];

      // The document stated its own term dates — apply them to every class
      // and skip straight to review. Otherwise ask the user once, up front,
      // rather than leaving every class recurring indefinitely by default.
      const foundStart = extraction.semesterStartDate ? parseISODateLocal(extraction.semesterStartDate) : null;
      const foundEnd = extraction.semesterEndDate ? parseISODateLocal(extraction.semesterEndDate) : null;
      const validFoundStart = foundStart && !Number.isNaN(foundStart.getTime()) ? foundStart : null;
      const validFoundEnd = foundEnd && !Number.isNaN(foundEnd.getTime()) ? foundEnd : null;

      if (validFoundStart && validFoundEnd) {
        setSemesterStart(validFoundStart);
        setSemesterEnd(validFoundEnd);
        setRows(applySemesterWindow(seededRows, validFoundStart, validFoundEnd));
        setStep('review');
      } else {
        setRows(seededRows);
        setStep('semester-dates');
      }
    } catch (err) {
      console.error('[TimetableUploadModal] extraction failed', err);
      if (processGenerationRef.current !== generation) return;
      const status = (err as { status?: number } | null)?.status;
      const field = (err as { field?: string } | null)?.field;
      const message = (err as { message?: string } | null)?.message;
      if (field === 'tier') {
        setStep('upgrade');
        return;
      }
      if (status === 429 && message) {
        Alert.alert("You've hit your AI limit", message);
      } else {
        Alert.alert("Couldn't read timetable", message ?? "Couldn't read that timetable. Try again.");
      }
      setStep('preview');
    }
  };

  const updateRow = (key: string, patch: Partial<ClassFieldsValue>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, fields: { ...r.fields, ...patch } } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const addRow = () => {
    // A manually-added row during review gets the same term window as every
    // extracted one, not an indefinitely-recurring default — otherwise the
    // one class the AI missed would quietly behave differently from the rest
    // of the batch.
    setRows((prev) => [
      ...prev,
      {
        key: `custom-${Date.now()}`,
        fields: { ...defaultClassFields(), startDate: semesterStart ?? new Date(), endDate: semesterEnd },
      },
    ]);
  };

  const semesterDatesValid = !!semesterStart && !!semesterEnd && localMidnight(semesterEnd) >= localMidnight(semesterStart);

  const handleConfirmSemesterDates = () => {
    if (!semesterDatesValid || !semesterStart || !semesterEnd) return;
    setRows((prev) => applySemesterWindow(prev, semesterStart, semesterEnd));
    setStep('review');
  };

  // Escape hatch — a user without exact dates handy (or who genuinely wants
  // classes to recur indefinitely) isn't blocked from proceeding; rows just
  // keep whatever startDate/endDate they already have (today / no end date).
  const handleSkipSemesterDates = () => setStep('review');

  // Rough ceiling on how many local notifications one class will need — lead
  // + exact, each its own native trigger, one pair per weekday for a
  // weekly/weekdays class (see scheduleOccurrence's WEEKLY branch in
  // utils/notifications.ts). Only used to size the pre-flight headroom check
  // below; doesn't need to be exact (an already-passed one-off due time
  // schedules 0, not 2, but that's a harmless overestimate here).
  const estimateNotificationCount = (item: ClassItem) => {
    if (item.recurring && (item.freq === 'weekly' || item.freq === 'weekdays')) {
      return Math.max(1, item.dayIdxs.length) * 2;
    }
    return 2;
  };

  const commitClasses = async (items: ClassItem[]) => {
    setStep('creating');
    try {
      const { saved, failedCount } = await saveClasses(items);
      setSuccessSummary({ savedCount: saved.length, totalCount: items.length, failedCount });
      setStep('success');
    } catch (err) {
      console.error('[TimetableUploadModal] failed to save classes', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
      setStep('review');
    }
  };

  const handleConfirm = async () => {
    const validRows = rows.filter((r) => isClassFieldsValid(r.fields));
    // String(Date.now() + i), not `${Date.now()}-${i}` — app/classes.tsx
    // sorts classes via Number(id), so ids assigned in this same synchronous
    // batch must stay pure-numeric-string, not gain a suffix that would turn
    // that comparison into NaN.
    const items: ClassItem[] = validRows.map((r, i) => buildClassItem(r.fields, String(Date.now() + i)));

    // Bulk-creating several recurring classes at once is the one flow in this
    // app that can plausibly schedule enough notifications in a single action
    // to hit iOS's 64-pending cap silently (every other create flow only ever
    // adds one item at a time) — warn instead of letting some classes'
    // reminders just never show up with no indication why.
    if (remindersEnabled) {
      const headroom = await getNotificationHeadroom();
      const estimatedNeeded = items.reduce((sum, item) => sum + estimateNotificationCount(item), 0);
      if (headroom !== null && estimatedNeeded > headroom) {
        Alert.alert(
          'Limited reminder slots',
          `Adding all ${items.length} classes needs about ${estimatedNeeded} reminders, but this device has ` +
            `room for about ${Math.max(headroom, 0)} more — some classes' reminders may not go off. Turn off ` +
            'alarms on a few classes, remove some, or continue anyway.',
          [
            { text: 'Review classes', style: 'cancel' },
            { text: 'Add anyway', onPress: () => commitClasses(items) },
          ]
        );
        return;
      }
    }

    await commitClasses(items);
  };

  const openPickerFor = (key: string, mode: 'date' | 'endDate' | 'time') => setOpenPicker({ key, mode });
  const closePicker = () => setOpenPicker(null);

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={85}>
      {step === 'pick' && (
        <>
          <Text style={styles.title}>Upload timetable</Text>
          <Text style={styles.sub}>
            Upload your class schedule and AI will pull out every class, its days, and its time.
          </Text>

          <View style={styles.pickTypeRow}>
            <Pressable style={styles.pickTypeCard} onPress={handlePickDocument}>
              <View style={styles.pickTypeIconBox}>
                <IconSymbol name="doc.fill" color={Colors.primaryLight} size={20} />
              </View>
              <Text style={styles.pickTypeLabel}>Document</Text>
              <Text style={styles.pickTypeSub}>PDF, Word, PowerPoint</Text>
            </Pressable>
            <Pressable style={styles.pickTypeCard} onPress={handlePickPhoto}>
              <View style={styles.pickTypeIconBox}>
                <IconSymbol name="photo.fill" color={Colors.primaryLight} size={20} />
              </View>
              <Text style={styles.pickTypeLabel}>Photo</Text>
              <Text style={styles.pickTypeSub}>From your library</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'preview' && pickedAsset && (
        <>
          <Text style={styles.title}>Ready to process</Text>
          <Text style={styles.sub}>Confirm this is the right file before AI reads it.</Text>

          <View style={styles.previewCard}>
            <View style={styles.previewIconBox}>
              <IconSymbol
                name={pickedAsset.mimeType?.startsWith('image/') ? 'photo.fill' : 'doc.fill'}
                color={Colors.primaryLight}
                size={22}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.previewFileName} numberOfLines={1}>{pickedAsset.name}</Text>
              {!!formatFileSize(pickedAsset.size) && (
                <Text style={styles.previewFileMeta}>{formatFileSize(pickedAsset.size)}</Text>
              )}
            </View>
          </View>

          <Pressable style={styles.chooseDifferentBtn} onPress={() => setStep('pick')}>
            <Text style={styles.chooseDifferentText}>Choose a different file</Text>
          </Pressable>

          <Pressable style={styles.pickButton} onPress={handleProcess}>
            <Text style={styles.pickButtonText}>Continue</Text>
          </Pressable>
        </>
      )}

      {/* Folded into this same sheet rather than a stacked <UpgradeModal> —
          RN (iOS especially) doesn't reliably present a second native Modal
          while one is already open. Same fix as SyllabusUploadModal's. */}
      {step === 'upgrade' && (
        <View style={styles.upgradeWrap}>
          <View style={styles.upgradeIconBadge}>
            <IconSymbol name="sparkles" color={Colors.primaryLight} size={26} />
          </View>
          <Text style={styles.upgradeTitle}>
            Upgrade to {TIER_LABEL[FEATURE_MIN_TIER.timetable_extraction]}
          </Text>
          <Text style={styles.upgradeSubtitle}>
            Timetable AI extraction is available on the {TIER_LABEL[FEATURE_MIN_TIER.timetable_extraction]} plan
            and above.
          </Text>
          <Pressable
            style={styles.upgradeBtn}
            onPress={() => {
              handleClose();
              router.push(Routes.PLANS);
            }}
          >
            <Text style={styles.upgradeBtnText}>View Plans</Text>
          </Pressable>
          <Pressable onPress={() => setStep('preview')} hitSlop={8}>
            <Text style={styles.upgradeNotNowText}>Not now</Text>
          </Pressable>
        </View>
      )}

      {step === 'extracting' && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={Colors.primary} size="large" />
          <Text style={styles.centerText}>{extractStatusMessage}</Text>
          <View style={styles.extractProgressTrack}>
            <AnimatedProgressBar pct={extractProgress} color={Colors.primary} />
          </View>
        </View>
      )}

      {step === 'semester-dates' && (
        <View>
          <Text style={styles.title}>When does this term run?</Text>
          <Text style={styles.sub}>
            We couldn&apos;t find a term date range on this document — enter it so your classes repeat for
            the right weeks instead of forever.
          </Text>

          <Text style={styles.sheetEyebrow}>Term starts</Text>
          <Pressable style={styles.datePicker} onPress={() => setSemesterPickerOpen('start')}>
            <Text style={styles.datePickerIcon}>📅</Text>
            <Text style={[styles.datePickerText, !semesterStart && styles.datePickerPlaceholder]}>
              {semesterStart ? formatDatePickerLabel(semesterStart) : 'Select start date'}
            </Text>
          </Pressable>

          <Text style={styles.sheetEyebrow}>Term ends</Text>
          <Pressable style={styles.datePicker} onPress={() => setSemesterPickerOpen('end')}>
            <Text style={styles.datePickerIcon}>🏁</Text>
            <Text style={[styles.datePickerText, !semesterEnd && styles.datePickerPlaceholder]}>
              {semesterEnd ? formatDatePickerLabel(semesterEnd) : 'Select end date'}
            </Text>
          </Pressable>
          {!!semesterStart && !!semesterEnd && !semesterDatesValid && (
            <Text style={styles.fieldError}>Term end date must be on or after the start date.</Text>
          )}

          <InlineDateTimePicker
            visible={semesterPickerOpen === 'start'}
            value={semesterStart ?? new Date()}
            mode="date"
            onChange={setSemesterStart}
            onDismiss={() => setSemesterPickerOpen(null)}
          />
          <InlineDateTimePicker
            visible={semesterPickerOpen === 'end'}
            value={semesterEnd ?? semesterStart ?? new Date()}
            mode="date"
            onChange={setSemesterEnd}
            onDismiss={() => setSemesterPickerOpen(null)}
          />

          <Pressable
            style={[styles.pickButton, !semesterDatesValid && styles.confirmButtonDisabled]}
            disabled={!semesterDatesValid}
            onPress={handleConfirmSemesterDates}
          >
            <Text style={styles.pickButtonText}>Continue</Text>
          </Pressable>
          <Pressable style={styles.chooseDifferentBtn} onPress={handleSkipSemesterDates}>
            <Text style={styles.chooseDifferentText}>Skip — repeat indefinitely instead</Text>
          </Pressable>
        </View>
      )}

      {(step === 'review' || step === 'creating') && (
        <>
          <ScrollView style={styles.rowList} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Review</Text>
            <Text style={styles.sub}>Edit anything the AI got wrong before adding these to your planner.</Text>

            {rows.length === 0 && (
              <Text style={styles.emptyText}>No classes detected — add one manually below.</Text>
            )}

            {rows.map((row) => (
              <View key={row.key} style={styles.rowCard}>
                <View style={styles.rowHeaderRow}>
                  <Text style={styles.rowEyebrow}>Class</Text>
                  <Pressable onPress={() => removeRow(row.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
                <ClassFieldsEditor
                  value={row.fields}
                  onChange={(patch) => updateRow(row.key, patch)}
                  datePickerVisible={openPicker?.key === row.key && openPicker.mode === 'date'}
                  onOpenDatePicker={() => openPickerFor(row.key, 'date')}
                  onCloseDatePicker={closePicker}
                  endDatePickerVisible={openPicker?.key === row.key && openPicker.mode === 'endDate'}
                  onOpenEndDatePicker={() => openPickerFor(row.key, 'endDate')}
                  onCloseEndDatePicker={closePicker}
                  timePickerVisible={openPicker?.key === row.key && openPicker.mode === 'time'}
                  onOpenTimePicker={() => openPickerFor(row.key, 'time')}
                  onCloseTimePicker={closePicker}
                />
              </View>
            ))}

            <Pressable style={styles.addRowButton} onPress={addRow}>
              <Text style={styles.addRowText}>+ Add class</Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footerRow}>
            <Pressable style={styles.backButton} onPress={handleClose} disabled={step === 'creating'}>
              <Text style={styles.backButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.confirmButton, step === 'creating' && styles.confirmButtonDisabled]}
              disabled={step === 'creating'}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>{step === 'creating' ? 'Adding…' : 'Add to planner'}</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'success' && successSummary && (
        <View style={styles.successBox}>
          <View style={styles.successIcon}>
            <IconSymbol name="checkmark" color={Colors.success} size={26} />
          </View>
          <Text style={styles.successTitle}>Timetable added</Text>
          <Text style={styles.successSub}>
            {successSummary.failedCount > 0
              ? `Added ${successSummary.savedCount} of ${successSummary.totalCount} classes — ${successSummary.failedCount} failed to save, add those manually.`
              : `Added ${successSummary.totalCount} class${successSummary.totalCount === 1 ? '' : 'es'} to your planner.`}
          </Text>
          <Pressable style={styles.successButton} onPress={handleClose}>
            <Text style={styles.successButtonText}>Done</Text>
          </Pressable>
        </View>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
  },
  upgradeWrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  upgradeIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  upgradeSubtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    marginBottom: Spacing.lg,
  },
  upgradeBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: 13,
    paddingVertical: 14,
    marginBottom: 12,
  },
  upgradeBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.white,
  },
  upgradeNotNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  pickButton: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  pickTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  pickTypeCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  pickTypeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pickTypeLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pickTypeSub: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  pickButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
  },
  previewIconBox: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewFileName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewFileMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chooseDifferentBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },
  chooseDifferentText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  sheetEyebrow: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 9,
  },
  datePicker: {
    height: 48, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.primary, backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: Spacing.sm,
  },
  datePickerIcon: { fontSize: 16 },
  datePickerText: { flex: 1, fontSize: 15, color: '#000000', fontWeight: '600' },
  datePickerPlaceholder: { color: Colors.textMuted, fontWeight: '400' },
  fieldError: { fontSize: 12, color: Colors.error, marginTop: 6 },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: 14,
  },
  centerText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  extractProgressTrack: {
    width: '80%',
    height: 6,
    borderRadius: 999,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  rowList: {
    marginTop: 4,
  },
  rowCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 12,
    marginTop: 12,
  },
  rowHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  removeText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 14,
  },
  addRowButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  addRowText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  backButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  successSub: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
    paddingHorizontal: 6,
  },
  successButton: {
    marginTop: 22,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 14,
    paddingVertical: 15,
  },
  successButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
