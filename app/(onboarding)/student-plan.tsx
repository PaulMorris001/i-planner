import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, Modal,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { AddClassModal } from '@/components/plan/AddClassModal';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { usePlan } from '@/hooks/usePlan';
import { useOnboarding } from '@/hooks/useOnboarding';
import type {
  StudentPlan as StudentPlanType,
  ClassItem,
  ClassFrequency,
  RecruitmentItem,
  SocialItem,
  RoutineItem,
  OtherItem,
} from '@/types/plan.types';

// ── Constants ──────────────────────────────────────────────────────────────
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TASK_TYPES: RecruitmentItem['taskType'][] = ['Apply', 'Interview', 'Network', 'Update CV', 'Other'];
const FREQUENCIES: SocialItem['frequency'][]    = ['One-off', 'Weekly', 'Monthly'];
const TIME_OF_DAY: RoutineItem['timeOfDay'][]   = ['Morning', 'Afternoon', 'Evening', 'Night'];

const TIME_OF_DAY_EMOJI: Record<RoutineItem['timeOfDay'], string> = {
  Morning:   '🌅',
  Afternoon: '☀️',
  Evening:   '🌆',
  Night:     '🌙',
};

type Section = 'classes' | 'recruitment' | 'social_life' | 'daily_routine' | 'other';

const SECTIONS: {
  key: Section;
  label: string;
  sub: string;
  bg: string;
  accent: string;
}[] = [
  { key: 'classes',       label: 'Classes',       sub: 'optional',                   bg: '#EEF2FF', accent: '#6366F1' },
  { key: 'recruitment',   label: 'Recruitment',   sub: 'coffee chats & interviews',  bg: '#F0FDF4', accent: '#16A34A' },
  { key: 'social_life',   label: 'Social life',   sub: 'parties & events',           bg: '#FFF7ED', accent: '#EA580C' },
  { key: 'daily_routine', label: 'Daily routine', sub: 'habits & blocks',            bg: '#F0F9FF', accent: '#0284C7' },
  { key: 'other',         label: 'Other',         sub: 'anything else you plan',     bg: '#FDF4FF', accent: '#9333EA' },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

function classLabel(item: ClassItem): string {
  if (!item.recurring) {
    return `One time · ${formatDate(new Date(item.startDate))}`;
  }
  const map: Record<ClassFrequency, string> = {
    weekly:   `Weekly on ${DAY_FULL[item.dayIdxs[0] ?? 0]}`,
    weekdays: 'Weekdays',
    daily:    'Every day',
    monthly:  'Monthly',
  };
  return map[item.freq];
}

// ── Component ──────────────────────────────────────────────────────────────
export default function StudentPlan() {
  const insets = useSafeAreaInsets();
  const { savePlan } = usePlan();
  const { completeOnboarding } = useOnboarding();

  const [plan, setPlan] = useState<StudentPlanType>({
    classes:       [],
    recruitment:   [],
    social_life:   [],
    daily_routine: [],
    other:         [],
  });

  const [selectedSections, setSelectedSections] = useState<Section[]>(['classes']);
  const [loading, setLoading] = useState(false);

  // ── Class sheet state ──
  const [classSheetOpen, setClassSheetOpen] = useState(false);

  // ── Recruitment sheet state ──
  const [recSheetOpen, setRecSheetOpen] = useState(false);
  const [recType, setRecType]       = useState<RecruitmentItem['taskType']>('Apply');
  const [recCompany, setRecCompany] = useState('');
  const [recDate, setRecDate]       = useState(new Date());
  const [showRecPicker, setShowRecPicker] = useState(false);

  // ── Social sheet state ──
  const [socialSheetOpen, setSocialSheetOpen] = useState(false);
  const [socialName, setSocialName] = useState('');
  const [socialFreq, setSocialFreq] = useState<SocialItem['frequency']>('One-off');

  // ── Routine sheet state ──
  const [routineSheetOpen, setRoutineSheetOpen] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const [routineTime, setRoutineTime] = useState<RoutineItem['timeOfDay']>('Morning');

  // ── Other inline form state ──
  const [otherTitle, setOtherTitle] = useState('');

  const PROGRESS = 0.66;

  const toggleSection = (key: Section) => {
    setSelectedSections(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      return next.length ? next : prev; // keep at least one section visible
    });
  };

  // ── Add handlers ──
  const addClass = (item: ClassItem) => {
    setPlan(prev => ({ ...prev, classes: [...prev.classes, item] }));
  };

  const addRecruitment = () => {
    if (!recCompany.trim()) {
      Alert.alert('Company required', 'Please enter a company or organisation name.');
      return;
    }
    const item: RecruitmentItem = {
      id:       Date.now().toString(),
      taskType: recType,
      company:  recCompany.trim(),
      date:     recDate.toISOString(),
    };
    setPlan(prev => ({ ...prev, recruitment: [...prev.recruitment, item] }));
    setRecSheetOpen(false);
    setRecCompany('');
    setRecType('Apply');
    setRecDate(new Date());
  };

  const addSocial = () => {
    if (!socialName.trim()) {
      Alert.alert('Activity required', 'Please enter an activity name.');
      return;
    }
    const item: SocialItem = {
      id:        Date.now().toString(),
      activity:  socialName.trim(),
      frequency: socialFreq,
    };
    setPlan(prev => ({ ...prev, social_life: [...prev.social_life, item] }));
    setSocialSheetOpen(false);
    setSocialName('');
    setSocialFreq('One-off');
  };

  const addRoutine = () => {
    if (!routineName.trim()) {
      Alert.alert('Routine required', 'Please enter a routine name.');
      return;
    }
    const item: RoutineItem = {
      id:        Date.now().toString(),
      name:      routineName.trim(),
      timeOfDay: routineTime,
    };
    setPlan(prev => ({ ...prev, daily_routine: [...prev.daily_routine, item] }));
    setRoutineSheetOpen(false);
    setRoutineName('');
    setRoutineTime('Morning');
  };

  const addOther = () => {
    if (!otherTitle.trim()) return;
    const item: OtherItem = {
      id:    Date.now().toString(),
      title: otherTitle.trim(),
      date:  '',
    };
    setPlan(prev => ({ ...prev, other: [...prev.other, item] }));
    setOtherTitle('');
  };

  // ── Remove handlers ──
  const removeClass       = (id: string) => setPlan(p => ({ ...p, classes:       p.classes.filter(i => i.id !== id) }));
  const removeRecruitment = (id: string) => setPlan(p => ({ ...p, recruitment:   p.recruitment.filter(i => i.id !== id) }));
  const removeSocial      = (id: string) => setPlan(p => ({ ...p, social_life:   p.social_life.filter(i => i.id !== id) }));
  const removeRoutine     = (id: string) => setPlan(p => ({ ...p, daily_routine: p.daily_routine.filter(i => i.id !== id) }));
  const removeOther       = (id: string) => setPlan(p => ({ ...p, other:         p.other.filter(i => i.id !== id) }));

  const handleContinue = async () => {
    setLoading(true);
    try {
      await savePlan(plan);
      await completeOnboarding();
      router.replace(Routes.DASHBOARD);
    } catch (err) {
      console.error('[StudentPlan] failed to save plan', err);
      Alert.alert("Couldn't save your plan", 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const totalItems =
    plan.classes.length +
    plan.recruitment.length +
    plan.social_life.length +
    plan.daily_routine.length +
    plan.other.length;

  const itemsFor = (key: Section) =>
    key === 'classes'       ? plan.classes.length :
    key === 'recruitment'   ? plan.recruitment.length :
    key === 'social_life'   ? plan.social_life.length :
    key === 'daily_routine' ? plan.daily_routine.length :
    plan.other.length;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.offWhite }}>

      {/* ── Sticky header ── */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backLabel}>Back</Text>
          </TouchableOpacity>
          <View style={styles.stepBadge}>
            <Text style={styles.stepText}>Step 2 of 3</Text>
          </View>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${PROGRESS * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.pageHeader}>
          <View style={styles.pathBadge}>
            <Text style={styles.pathBadgeText}>Student path</Text>
          </View>
          <Text style={styles.title}>What do you want to plan?</Text>
          <Text style={styles.subtitle}>
            Pick what matters this semester — classes are optional. Plan recruitment, your social life and your day too.
          </Text>
        </View>

        {/* ── Multi-select focus chips ── */}
        <View style={styles.chipWrapRow}>
          {SECTIONS.map(sec => {
            const on = selectedSections.includes(sec.key);
            return (
              <TouchableOpacity
                key={sec.key}
                style={[styles.focusChip, on && { backgroundColor: sec.accent, borderColor: sec.accent }]}
                onPress={() => toggleSection(sec.key)}
                activeOpacity={0.75}
              >
                <Text style={[styles.focusChipText, on && styles.focusChipTextActive]}>{sec.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Sections (all selected ones shown at once) ── */}
        {SECTIONS.filter(sec => selectedSections.includes(sec.key)).map(sec => (
          <View key={sec.key} style={styles.section}>
            <Text style={styles.sectionEyebrow}>{sec.label.toUpperCase()} · {sec.sub}</Text>

            {/* ── CLASSES ── */}
            {sec.key === 'classes' && (
              <>
                {plan.classes.length > 0 && (
                  <View style={styles.itemList}>
                    {plan.classes.map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={[styles.itemAvatar, { backgroundColor: sec.bg }]}>
                          <Text style={[styles.itemAvatarText, { color: sec.accent }]}>{item.courseName.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.itemTextBlock}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.courseName}</Text>
                          <Text style={styles.itemMeta}>{classLabel(item)}{item.time ? ` · ${item.time}` : ''}</Text>
                        </View>
                        <View style={styles.itemCheck}>
                          <Text style={styles.itemCheckMark}>✓</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeClass(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setClassSheetOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addBtnText}>+ {plan.classes.length === 0 ? 'Add a class' : 'Add another class'}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── RECRUITMENT ── */}
            {sec.key === 'recruitment' && (
              <>
                {plan.recruitment.length > 0 && (
                  <View style={styles.itemList}>
                    {plan.recruitment.map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={[styles.itemAvatar, { backgroundColor: sec.bg }]}>
                          <Text style={[styles.itemAvatarText, { color: sec.accent }]}>{item.company.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.itemTextBlock}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.company}</Text>
                          <Text style={styles.itemMeta}>{item.taskType} · {formatDate(new Date(item.date))}</Text>
                        </View>
                        <View style={styles.itemCheck}>
                          <Text style={styles.itemCheckMark}>✓</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeRecruitment(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setRecSheetOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addBtnText}>+ {plan.recruitment.length === 0 ? 'Add a coffee chat or interview' : 'Add another'}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── SOCIAL LIFE ── */}
            {sec.key === 'social_life' && (
              <>
                {plan.social_life.length > 0 && (
                  <View style={styles.itemList}>
                    {plan.social_life.map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={[styles.itemAvatar, { backgroundColor: sec.bg }]}>
                          <Text style={[styles.itemAvatarText, { color: sec.accent }]}>{item.activity.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.itemTextBlock}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.activity}</Text>
                          <Text style={styles.itemMeta}>{item.frequency}</Text>
                        </View>
                        <View style={styles.itemCheck}>
                          <Text style={styles.itemCheckMark}>✓</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeSocial(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setSocialSheetOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addBtnText}>+ {plan.social_life.length === 0 ? 'Add a party or event' : 'Add another'}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── DAILY ROUTINE ── */}
            {sec.key === 'daily_routine' && (
              <>
                {plan.daily_routine.length > 0 && (
                  <View style={styles.itemList}>
                    {plan.daily_routine.map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={[styles.itemAvatar, { backgroundColor: sec.bg }]}>
                          <Text style={styles.itemAvatarEmoji}>{TIME_OF_DAY_EMOJI[item.timeOfDay]}</Text>
                        </View>
                        <View style={styles.itemTextBlock}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.itemMeta}>{item.timeOfDay}</Text>
                        </View>
                        <View style={styles.itemCheck}>
                          <Text style={styles.itemCheckMark}>✓</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeRoutine(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setRoutineSheetOpen(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.addBtnText}>+ {plan.daily_routine.length === 0 ? 'Add a routine block' : 'Add another'}</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── OTHER (inline, no sheet) ── */}
            {sec.key === 'other' && (
              <>
                {plan.other.length > 0 && (
                  <View style={styles.itemList}>
                    {plan.other.map(item => (
                      <View key={item.id} style={styles.itemRow}>
                        <View style={[styles.itemAvatar, { backgroundColor: sec.bg }]}>
                          <Text style={[styles.itemAvatarText, { color: sec.accent }]}>{item.title.charAt(0).toUpperCase()}</Text>
                        </View>
                        <View style={styles.itemTextBlock}>
                          <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                          <Text style={styles.itemMeta}>Custom plan</Text>
                        </View>
                        <View style={styles.itemCheck}>
                          <Text style={styles.itemCheckMark}>✓</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeOther(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={styles.removeBtnText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.otherInputRow}>
                  <TextInput
                    style={styles.otherInput}
                    placeholder="e.g. Thesis research, side project…"
                    placeholderTextColor={Colors.textMuted}
                    value={otherTitle}
                    onChangeText={setOtherTitle}
                    onSubmitEditing={addOther}
                  />
                  <TouchableOpacity style={styles.otherAddBtn} onPress={addOther} activeOpacity={0.8}>
                    <Text style={styles.otherAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          {totalItems === 0 ? (
            <Text style={styles.skipHint}>No items yet — skip and add from your dashboard anytime.</Text>
          ) : (
            <Text style={styles.summaryHint}>{totalItems} item{totalItems > 1 ? 's' : ''} added ✓</Text>
          )}
          <Button label="Continue to my dashboard" onPress={handleContinue} loading={loading} />
        </View>
      </ScrollView>

      <AddClassModal
        visible={classSheetOpen}
        onClose={() => setClassSheetOpen(false)}
        onAdd={addClass}
      />

      {/* ── Add recruitment sheet ── */}
      <Modal visible={recSheetOpen} transparent animationType="slide" onRequestClose={() => setRecSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setRecSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Add a coffee chat or interview</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setRecSheetOpen(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetEyebrow}>Task type</Text>
            <View style={styles.chipRow}>
              {TASK_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, recType === t && { backgroundColor: '#16A34A', borderColor: '#16A34A' }]}
                  onPress={() => setRecType(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, recType === t && styles.chipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sheetEyebrow}>Company / Organisation</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Google, NHS, Deloitte"
              placeholderTextColor={Colors.textMuted}
              value={recCompany}
              onChangeText={setRecCompany}
            />

            <Text style={styles.sheetEyebrow}>Date</Text>
            <TouchableOpacity style={styles.datePicker} onPress={() => setShowRecPicker(true)} activeOpacity={0.8}>
              <Text style={styles.datePickerIcon}>📅</Text>
              <Text style={styles.datePickerText}>{formatDate(recDate)}</Text>
            </TouchableOpacity>
            {showRecPicker && (
              <DateTimePicker
                value={recDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                themeVariant="light"
                onChange={(_, date) => {
                  if (Platform.OS === 'android') setShowRecPicker(false);
                  if (date) setRecDate(date);
                }}
              />
            )}

            <TouchableOpacity style={styles.sheetSaveBtn} onPress={addRecruitment} activeOpacity={0.85}>
              <Text style={styles.sheetSaveBtnText}>Add task</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Add social sheet ── */}
      <Modal visible={socialSheetOpen} transparent animationType="slide" onRequestClose={() => setSocialSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setSocialSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Add a party or event</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSocialSheetOpen(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetEyebrow}>Activity</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Basketball training, Study group"
              placeholderTextColor={Colors.textMuted}
              value={socialName}
              onChangeText={setSocialName}
            />

            <Text style={styles.sheetEyebrow}>How often?</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, socialFreq === f && { backgroundColor: '#EA580C', borderColor: '#EA580C' }]}
                  onPress={() => setSocialFreq(f)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, socialFreq === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.sheetSaveBtn} onPress={addSocial} activeOpacity={0.85}>
              <Text style={styles.sheetSaveBtnText}>Add activity</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* ── Add routine sheet ── */}
      <Modal visible={routineSheetOpen} transparent animationType="slide" onRequestClose={() => setRoutineSheetOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setRoutineSheetOpen(false)} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={styles.sheetTitle}>Add a routine block</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setRoutineSheetOpen(false)}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetEyebrow}>Routine name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Review lecture notes"
              placeholderTextColor={Colors.textMuted}
              value={routineName}
              onChangeText={setRoutineName}
            />

            <Text style={styles.sheetEyebrow}>Time of day</Text>
            <View style={styles.chipRow}>
              {TIME_OF_DAY.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, routineTime === t && { backgroundColor: '#0284C7', borderColor: '#0284C7' }]}
                  onPress={() => setRoutineTime(t)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, routineTime === t && styles.chipTextActive]}>
                    {TIME_OF_DAY_EMOJI[t]} {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.sheetSaveBtn} onPress={addRoutine} activeOpacity={0.85}>
              <Text style={styles.sheetSaveBtnText}>Add routine</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  stickyHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios:     { shadowColor: '#000', shadowOpacity: 0.06, shadowOffset: { width: 0, height: 3 }, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow: { fontSize: 18, color: Colors.textSecondary, lineHeight: 22 },
  backLabel: { ...Typography.body, fontWeight: '500', color: Colors.textSecondary },
  stepBadge: { backgroundColor: Colors.overlay, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  stepText:  { ...Typography.caption, fontWeight: '600', color: Colors.textSecondary },
  progressTrack: { height: 5, borderRadius: Radius.full, backgroundColor: Colors.border, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.primary },

  scroll:     { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  pageHeader: { marginBottom: Spacing.md },
  pathBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: Radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  pathBadgeText: { fontSize: 12.5, fontWeight: '700', color: '#3B5FCC' },
  title:      { ...Typography.h1, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle:   { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },

  chipWrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: Spacing.lg },
  focusChip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
    borderRadius: Radius.full,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  focusChipText:       { fontSize: 13.5, fontWeight: '700', color: Colors.textSecondary },
  focusChipTextActive: { color: Colors.white },

  section: { marginBottom: Spacing.lg },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 11,
  },

  itemList: { gap: 10, marginBottom: 10 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 14,
  },
  itemAvatar: {
    width: 40, height: 40, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  itemAvatarText:  { fontSize: 15, fontWeight: '700' },
  itemAvatarEmoji: { fontSize: 18 },
  itemTextBlock: { flex: 1, minWidth: 0 },
  itemTitle:     { fontSize: 15, fontWeight: '700', color: Colors.textPrimary },
  itemMeta:      { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  itemCheck: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.successSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  itemCheckMark: { fontSize: 11, fontWeight: '700', color: Colors.success },
  removeBtnText: { fontSize: 13, color: Colors.textMuted, padding: 4 },

  addBtn: {
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: Colors.border,
    borderRadius: 15, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { fontSize: 14.5, fontWeight: '600', color: Colors.primary },

  otherInputRow: { flexDirection: 'row', gap: 8 },
  otherInput: {
    flex: 1, minWidth: 0, height: 48,
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 13,
    paddingHorizontal: Spacing.md, fontSize: 14.5, color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  otherAddBtn: {
    borderRadius: 13, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  otherAddBtnText: { fontSize: 14.5, fontWeight: '700', color: Colors.white },

  footer:      { marginTop: Spacing.sm, gap: Spacing.sm },
  skipHint:    { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
  summaryHint: { ...Typography.caption, color: Colors.success, fontWeight: '600', textAlign: 'center' },

  // ── Bottom sheets ──
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(20,18,40,0.4)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    maxHeight: '88%',
    backgroundColor: Colors.offWhite,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: Spacing.md, paddingTop: 14, paddingBottom: 30,
  },
  handle: {
    width: 38, height: 4, borderRadius: 999,
    backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16,
  },
  sheetHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.3, flex: 1, marginRight: 10 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { fontSize: 13, color: Colors.textSecondary },
  sheetEyebrow: {
    fontSize: 12, fontWeight: '700', color: Colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 16, marginBottom: 9,
  },
  input: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: 13,
    padding: 14, fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.white,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, height: 34, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  chipText:       { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  datePicker: {
    height: 48, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.primary, backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: Spacing.sm,
  },
  datePickerIcon: { fontSize: 16 },
  datePickerText: { flex: 1, fontSize: 15, color: '#000000', fontWeight: '600' },
  datePickerPlaceholder: { color: Colors.textMuted, fontWeight: '400' },

  recurringRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
    borderRadius: 13, padding: 13, paddingHorizontal: 15, marginTop: 16,
  },
  recurringTitle: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  recurringSub:   { fontSize: 12, color: Colors.textMuted, marginTop: 1 },
  toggle:            { width: 40, height: 22, borderRadius: 11, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive:      { backgroundColor: Colors.primary },
  toggleThumb:       { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.white },
  toggleThumbActive: { transform: [{ translateX: 18 }] },

  sheetSaveBtn: {
    marginTop: 20, backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
  },
  sheetSaveBtnText: { fontSize: 16, fontWeight: '700', color: Colors.white },
});
