import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AnimatedProgressBar } from '@/components/ui/AnimatedProgressBar';
import { InlineDateTimePicker } from '@/components/ui/InlineDateTimePicker';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { FEATURE_MIN_TIER, TIER_LABEL, hasTier, FREE_SYLLABUS_COUNT } from '@/constants/featureTiers';
import { Routes } from '@/constants/routes';
import { usePurchases } from '@/contexts/PurchasesContext';
import { syllabusService } from '@/services/syllabus.service';
import { usePlan } from '@/hooks/usePlan';
import { useTasks } from '@/hooks/useTasks';
import { useSyllabi } from '@/hooks/useSyllabi';
import { weekdayIndexMonday, parseISODateLocal, formatDatePickerLabel } from '@/utils/date';
import type { ClassItem } from '@/types/plan.types';

// Matches backend/src/services/syllabusExtraction.ts's SYLLABUS_MIME_BY_EXT —
// the backend derives the actual MIME type from the filename itself (safer
// than trusting the OS-reported one), so this list only needs to keep the
// native document picker's own filter in sync with what the server will
// accept. Images are deliberately NOT here — see handlePickPhoto below.
const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
];

// Common shape both pickers normalize into, so the preview/process logic
// below doesn't care which one was used.
interface PickedFile {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
  // Only ever set for a photo (see handlePickPhoto) — the picker encodes it
  // directly, sidestepping a second full-file disk read through
  // expo-file-system at Continue time. Documents don't have this option, so
  // they still get read via `new File(uri).base64()` in handleProcess.
  base64?: string;
}

interface DraftDeadline {
  key: string;
  title: string;
  date: Date;
}

type Step = 'pick' | 'preview' | 'upgrade' | 'extracting' | 'review' | 'creating' | 'success';

// Human-readable size, e.g. "2.4 MB" / "180 KB" — a bare byte count reads as
// meaningless on the preview screen.
function formatFileSize(bytes?: number): string | null {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// There's no real progress to report — one request, one response, no
// incremental events from the extraction call to hook into — so this climbs
// asymptotically toward (never reaching) a cap instead of a fake linear fill,
// which would either finish long before the real result and then sit at
// 100% doing nothing, or look stalled once it's outpaced by a slow request.
// Paired with rotating status text below so a longer wait still reads as
// "working", not stuck.
const EXTRACT_PROGRESS_CAP = 92;
const EXTRACT_PROGRESS_TICK_MS = 400;
const EXTRACT_STATUS_MESSAGES = [
  'Reading your file…',
  'Scanning for deadlines…',
  'Pulling out the topic list…',
  'Almost there…',
];
const EXTRACT_STATUS_INTERVAL_MS = 3000;

interface SyllabusUploadModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SuccessSummary {
  courseName: string;
  savedCount: number;
  totalCount: number;
  failedCount: number;
}

// Shared between onboarding's student-plan.tsx and the post-signin Syllabi
// screens (syllabi.tsx, Dashboard's My Syllabi card).
export function SyllabusUploadModal({ visible, onClose }: SyllabusUploadModalProps) {
  const router = useRouter();
  const { updatePlan } = usePlan();
  const { createTask } = useTasks();
  const { syllabi, createSyllabus } = useSyllabi();
  const { tier } = usePurchases();

  const [step, setStep] = useState<Step>('pick');
  const [pickedAsset, setPickedAsset] = useState<PickedFile | null>(null);
  const [fileName, setFileName] = useState('');
  const [courseName, setCourseName] = useState('');
  const [deadlines, setDeadlines] = useState<DraftDeadline[]>([]);
  const [datePickerKey, setDatePickerKey] = useState<string | null>(null);
  // True when `deadlines` was seeded from the topic outline, not real dated
  // deadlines — swaps the review screen's copy so placeholder dates don't
  // look like something the AI actually found.
  const [showingTopicsFallback, setShowingTopicsFallback] = useState(false);
  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractStatusIndex, setExtractStatusIndex] = useState(0);
  // Bumped by reset() — an in-flight handleProcess call checks this after its
  // await resolves and no-ops if it's changed, so closing the modal mid-
  // extraction (see handleClose below) can't have a request that finally
  // resolves seconds/minutes later still try to update a modal the user
  // already dismissed and reset.
  const processGenerationRef = useRef(0);

  const reset = () => {
    processGenerationRef.current += 1;
    setStep('pick');
    setPickedAsset(null);
    setFileName('');
    setCourseName('');
    setDeadlines([]);
    setDatePickerKey(null);
    setShowingTopicsFallback(false);
    setSuccessSummary(null);
    setExtractProgress(0);
    setExtractStatusIndex(0);
  };

  useEffect(() => {
    if (visible) reset();
  }, [visible]);

  // Simulated progress + rotating status text while extracting — there's no
  // real progress signal from a single request/response AI call, so this is
  // purely to keep the screen feeling alive on a slower request rather than
  // a static spinner that gives no sense of whether it's still working.
  useEffect(() => {
    if (step !== 'extracting') return;
    setExtractProgress(0);
    setExtractStatusIndex(0);
    const progressTimer = setInterval(() => {
      setExtractProgress((p) => p + (EXTRACT_PROGRESS_CAP - p) * 0.08);
    }, EXTRACT_PROGRESS_TICK_MS);
    const statusTimer = setInterval(() => {
      setExtractStatusIndex((i) => Math.min(i + 1, EXTRACT_STATUS_MESSAGES.length - 1));
    }, EXTRACT_STATUS_INTERVAL_MS);
    return () => {
      clearInterval(progressTimer);
      clearInterval(statusTimer);
    };
  }, [step]);

  const handleClose = () => {
    // 'creating' (saving the reviewed deadlines) is still protected — a
    // partial multi-step save is riskier to walk away from mid-flight.
    // 'extracting' is deliberately NOT protected: a hung/slow network call
    // used to leave the user with no way to dismiss the modal at all short
    // of force-quitting (see apiRequest's new timeout in services/api.ts for
    // the other half of this fix) — closing now just abandons that request,
    // caught by the generation check above once/if it does resolve.
    if (step === 'creating') return;
    onClose();
    reset();
  };

  // Only picks a file and shows it back for confirmation — the actual AI call
  // (and its tier/quota gating) happens in handleProcess once the user taps
  // Continue, not the instant a file is chosen. Files (PDF/Word/PowerPoint)
  // live in the Files-app-style document picker; photos don't — see
  // handlePickPhoto for those, launched from a separate button.
  const handlePickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: SUPPORTED_DOCUMENT_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPickedAsset({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size });
    setStep('preview');
  };

  // A syllabus photo naturally comes from the Camera Roll/Photos, not Files —
  // expo-image-picker's library picker, not expo-document-picker.
  const handlePickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photo access needed', 'Allow photo library access in Settings to choose a syllabus photo.');
      return;
    }
    // quality: 1 (no compression) on a modern phone photo can be a 10-20+ MB
    // file — base64-encoding something that size (both the disk read below
    // and the network upload at Continue time) is heavy enough to visibly
    // freeze the UI thread for a long stretch, not just "feel slow". 0.6 is
    // still plenty readable for a document photo and cuts that dramatically.
    // base64: true has the picker encode it directly, so Continue doesn't
    // need a second full-file read through expo-file-system on top of this.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const mimeType = asset.mimeType ?? 'image/jpeg';
    // fileName can come back null with limited photo-library access — a
    // syllabus.controller.ts-recognized extension is required either way,
    // since the backend derives the real MIME type from the filename itself.
    const name = asset.fileName ?? `syllabus-photo.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
    setPickedAsset({ uri: asset.uri, name, mimeType, size: asset.fileSize, base64: asset.base64 ?? undefined });
    setStep('preview');
  };

  const handleProcess = async () => {
    if (!pickedAsset) {
      // Should be unreachable (this button only renders when pickedAsset is
      // set) — surfaced loudly instead of silently doing nothing, so a stale-
      // state bug is visible if it ever recurs rather than looking like a
      // dead button.
      Alert.alert("Couldn't process", 'No file was found — please choose your file again.');
      setStep('pick');
      return;
    }
    const asset = pickedAsset;

    if (syllabi.length >= FREE_SYLLABUS_COUNT && !hasTier(tier, FEATURE_MIN_TIER.syllabus_extraction)) {
      setStep('upgrade');
      return;
    }

    const generation = ++processGenerationRef.current;
    setStep('extracting');
    try {
      // A photo already has base64 from the picker itself (see
      // handlePickPhoto) — only a document needs this separate disk read.
      const fileBase64 = asset.base64 ?? (await new File(asset.uri).base64());
      const extraction = await syllabusService.extract({ fileBase64, filename: asset.name });
      // The modal was closed (or a new pick/process started) while this was
      // in flight — reset() already bumped the generation, so applying this
      // now-stale result would resurrect state the user already walked away
      // from. Silently drop it; nothing to alert them to, they left on purpose.
      if (processGenerationRef.current !== generation) return;
      // Parsed as local midnight, not `new Date(d.date)`'s UTC midnight, so
      // this round-trips to the same calendar day for users west of UTC.
      const extractedDeadlines = extraction.deadlines.map((d, i) => ({
        key: `ex-${i}`,
        title: d.title,
        date: parseISODateLocal(d.date),
      }));
      // No dated deadlines — fall back to the topic outline (rows start on
      // today; user picks real dates), or one blank row if even that's empty.
      const topicFallback = extraction.subtopics.map((title, i) => ({
        key: `topic-${i}`,
        title,
        date: new Date(),
      }));
      setFileName(asset.name);
      setCourseName(extraction.courseName);
      setShowingTopicsFallback(extractedDeadlines.length === 0 && topicFallback.length > 0);
      setDeadlines(
        extractedDeadlines.length > 0
          ? extractedDeadlines
          : topicFallback.length > 0
          ? topicFallback
          : [{ key: `custom-${Date.now()}`, title: '', date: new Date() }]
      );
      setStep('review');
    } catch (err) {
      console.error('[SyllabusUploadModal] extraction failed', err);
      if (processGenerationRef.current !== generation) return;
      // Defense in depth — covers `syllabi` being stale; the backend's
      // exemption check (syllabus.controller.ts) is the real source of truth.
      const status = (err as { status?: number } | null)?.status;
      const field = (err as { field?: string } | null)?.field;
      const message = (err as { message?: string } | null)?.message;
      if (field === 'tier') {
        setStep('upgrade');
        return;
      }
      if (status === 429 && message) {
        // Same title convention as Coach's identical quota-exceeded case —
        // a distinct message from a generic parse failure, so the user knows
        // it's their usage cap, not a bad file.
        Alert.alert("You've hit your AI limit", message);
      } else {
        Alert.alert("Couldn't read syllabus", message ?? "Couldn't read that syllabus. Try again.");
      }
      // Back to preview (not pick) — the file is still chosen, no need to
      // make them re-pick it just because e.g. a quota check failed.
      setStep('preview');
    }
  };

  const updateDeadline = (key: string, patch: Partial<DraftDeadline>) => {
    setDeadlines((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  };

  const removeDeadline = (key: string) => {
    setDeadlines((prev) => prev.filter((d) => d.key !== key));
  };

  const addDeadline = () => {
    setDeadlines((prev) => [...prev, { key: `custom-${Date.now()}`, title: '', date: new Date() }]);
  };

  const handleConfirm = async () => {
    const name = courseName.trim() || 'Untitled course';
    setStep('creating');
    try {
      const newClass: ClassItem = {
        id: Date.now().toString(),
        courseName: name,
        startDate: new Date().toISOString(),
        // Syllabus gives deadlines, not a meeting schedule, so this is a
        // one-off record; edit later to add a real recurring schedule.
        recurring: false,
        freq: 'weekly',
        dayIdxs: [weekdayIndexMonday(new Date())],
        time: '',
      };
      await updatePlan((p) => ({ ...p, classes: [...p.classes, newClass] }));

      const validDeadlines = deadlines.filter((d) => d.title.trim().length > 0);
      const results = await Promise.allSettled(
        validDeadlines.map((d) =>
          createTask({
            title: d.title.trim(),
            category: 'academic',
            priority: 'medium',
            day: weekdayIndexMonday(d.date),
            // 23 matches NewTaskModal's "no time picked" convention, so these
            // sort after time-scheduled tasks within the same priority tier.
            hour: 23,
            time: '',
            dueDate: d.date.toISOString(),
            recurring: false,
            notes: `From syllabus: ${name}`,
          })
        )
      );
      const failed = results.filter((r) => r.status === 'rejected').length;

      await createSyllabus({ fileName, courseName: name, classId: newClass.id }).catch((err) => {
        console.error('[SyllabusUploadModal] failed to record syllabus metadata', err);
      });

      setSuccessSummary({
        courseName: name,
        savedCount: validDeadlines.length - failed,
        totalCount: validDeadlines.length,
        failedCount: failed,
      });
      setStep('success');
    } catch (err) {
      console.error('[SyllabusUploadModal] failed to save syllabus', err);
      Alert.alert("Couldn't save", 'Check your connection and try again.');
      setStep('review');
    }
  };

  return (
    <BottomSheetModal visible={visible} onClose={handleClose} maxHeightPct={85}>
      {step === 'pick' && (
        <>
          <Text style={styles.title}>Upload syllabus</Text>
          <Text style={styles.sub}>
            Upload a syllabus and AI will pull out the course name and every deadline.
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

      {/* Folded into this same sheet (rather than a separate stacked
          `<UpgradeModal>`) because React Native — iOS especially — doesn't
          reliably present a second native Modal while one is already open;
          that's what made the Continue button look completely dead for a
          gated user instead of showing this prompt. */}
      {step === 'upgrade' && (
        <View style={styles.upgradeWrap}>
          <View style={styles.upgradeIconBadge}>
            <IconSymbol name="sparkles" color={Colors.primaryLight} size={26} />
          </View>
          <Text style={styles.upgradeTitle}>
            Upgrade to {TIER_LABEL[FEATURE_MIN_TIER.syllabus_extraction]}
          </Text>
          <Text style={styles.upgradeSubtitle}>
            Syllabus AI extraction is available on the {TIER_LABEL[FEATURE_MIN_TIER.syllabus_extraction]} plan and
            above.
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
          <Text style={styles.centerText}>{EXTRACT_STATUS_MESSAGES[extractStatusIndex]}</Text>
          <View style={styles.extractProgressTrack}>
            <AnimatedProgressBar pct={extractProgress} color={Colors.primary} />
          </View>
        </View>
      )}

      {(step === 'review' || step === 'creating') && (
        <>
          <ScrollView style={styles.deadlineList} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Review</Text>
            <Text style={styles.sub}>Edit anything the AI got wrong before adding it to your planner.</Text>

            <Text style={styles.fieldLabel}>Course name</Text>
            <TextInput
              value={courseName}
              onChangeText={setCourseName}
              placeholder="Course name"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />

            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>
              {showingTopicsFallback ? "Topics — set a date for each" : 'Deadlines'}
            </Text>
            {showingTopicsFallback && (
              <Text style={styles.topicsNote}>
                No dated deadlines found, so here's the course's topic outline instead — pick a date for
                each one you want tracked, or remove ones you don't.
              </Text>
            )}
            {deadlines.map((d) => (
              <View key={d.key} style={styles.deadlineRow}>
                <View style={styles.deadlineInputs}>
                  <TextInput
                    value={d.title}
                    onChangeText={(text) => updateDeadline(d.key, { title: text })}
                    placeholder="Deadline"
                    placeholderTextColor={Colors.textMuted}
                    style={styles.deadlineTitleInput}
                  />
                  <Pressable onPress={() => setDatePickerKey(d.key)}>
                    <Text style={styles.deadlineDateText}>{formatDatePickerLabel(d.date)}</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => removeDeadline(d.key)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.removeText}>✕</Text>
                </Pressable>
              </View>
            ))}

            {deadlines.length === 0 && (
              <Text style={styles.emptyText}>No deadlines detected — add one manually below.</Text>
            )}

            <Pressable style={styles.addDeadlineButton} onPress={addDeadline}>
              <Text style={styles.addDeadlineText}>+ Add deadline</Text>
            </Pressable>
          </ScrollView>

          <InlineDateTimePicker
            visible={!!datePickerKey}
            value={deadlines.find((d) => d.key === datePickerKey)?.date ?? new Date()}
            mode="date"
            onChange={(date) => datePickerKey && updateDeadline(datePickerKey, { date })}
            onDismiss={() => setDatePickerKey(null)}
          />

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
          <Text style={styles.successTitle}>Syllabus added</Text>
          <Text style={styles.successSub}>
            {successSummary.failedCount > 0
              ? `${successSummary.courseName} was added with ${successSummary.savedCount} of ${successSummary.totalCount} deadlines — ${successSummary.failedCount} failed to save, add those manually.`
              : `${successSummary.courseName} was added with ${successSummary.totalCount} deadline${successSummary.totalCount === 1 ? '' : 's'}.`}
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    padding: 14,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  topicsNote: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    lineHeight: 17,
    marginTop: -4,
    marginBottom: 10,
  },
  deadlineList: {
    marginTop: 4,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 13,
    padding: 12,
    marginBottom: 10,
  },
  deadlineInputs: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  deadlineTitleInput: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    padding: 0,
  },
  deadlineDateText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.primaryLight,
  },
  removeText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 4,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  addDeadlineButton: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  addDeadlineText: {
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
