import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Alert, Platform,
} from 'react-native';
import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { usePlan } from '@/hooks/usePlan';
import type {
  StudentPlan as StudentPlanType,
  ClassItem,
  RecruitmentItem,
  SocialItem,
  RoutineItem,
  OtherItem,
} from '@/types/plan.types';
 
// ── Constants ──────────────────────────────────────────────────────────────
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
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
  emoji: string;
  bg: string;
  accent: string;
  hint: string;
}[] = [
  { key: 'classes',       label: 'Classes',       emoji: '📚', bg: '#EEF2FF', accent: '#6366F1', hint: 'Lectures, seminars, labs & tutorials' },
  { key: 'recruitment',   label: 'Recruitment',   emoji: '💼', bg: '#F0FDF4', accent: '#16A34A', hint: 'Applications, interviews & networking' },
  { key: 'social_life',   label: 'Social Life',   emoji: '🎉', bg: '#FFF7ED', accent: '#EA580C', hint: 'Clubs, events, hangouts & sport' },
  { key: 'daily_routine', label: 'Daily Routine', emoji: '⏰', bg: '#F0F9FF', accent: '#0284C7', hint: 'Habits, rituals & recurring tasks' },
  { key: 'other',         label: 'Other',         emoji: '📌', bg: '#FDF4FF', accent: '#9333EA', hint: 'Anything else you want to track' },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function StudentPlan() {
  const insets = useSafeAreaInsets();
  const { savePlan } = usePlan();

  const [plan, setPlan] = useState<StudentPlanType>({
    classes:       [],
    recruitment:   [],
    social_life:   [],
    daily_routine: [],
    other:         [],
  });

  const [expanded, setExpanded] = useState<Section | null>(null);
  const [loading, setLoading]   = useState(false);

  // ── Class form state ──
  const [className, setClassName]   = useState('');
  const [classDays, setClassDays]   = useState<string[]>([]);
  const [classTime, setClassTime]   = useState('');

  // ── Recruitment form state ──
  const [recType, setRecType]       = useState<RecruitmentItem['taskType']>('Apply');
  const [recCompany, setRecCompany] = useState('');
  const [recDate, setRecDate]       = useState(new Date());
  const [showRecPicker, setShowRecPicker] = useState(false);

  // ── Social form state ──
  const [socialName, setSocialName]       = useState('');
  const [socialFreq, setSocialFreq]       = useState<SocialItem['frequency']>('One-off');

  // ── Routine form state ──
  const [routineName, setRoutineName]     = useState('');
  const [routineTime, setRoutineTime]     = useState<RoutineItem['timeOfDay']>('Morning');

  // ── Other form state ──
  const [otherTitle, setOtherTitle]       = useState('');
  const [otherDate, setOtherDate]         = useState(new Date());
  const [showOtherPicker, setShowOtherPicker] = useState(false);
  const [otherHasDate, setOtherHasDate]   = useState(false);

  const PROGRESS = 0.66;

  const toggleSection = (key: Section) => {
    setExpanded(prev => (prev === key ? null : key));
  };

  const toggleDay = (day: string) => {
    setClassDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // ── Add handlers ──
  const addClass = () => {
    if (!className.trim()) {
      Alert.alert('Course name required', 'Please enter a course name.');
      return;
    }
    const item: ClassItem = {
      id:         Date.now().toString(),
      courseName: className.trim(),
      days:       classDays,
      time:       classTime.trim(),
    };
    setPlan(prev => ({ ...prev, classes: [...prev.classes, item] }));
    setClassName('');
    setClassDays([]);
    setClassTime('');
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
    setRoutineName('');
    setRoutineTime('Morning');
  };

  const addOther = () => {
    if (!otherTitle.trim()) {
      Alert.alert('Title required', 'Please enter a title.');
      return;
    }
    const item: OtherItem = {
      id:    Date.now().toString(),
      title: otherTitle.trim(),
      date:  otherHasDate ? otherDate.toISOString() : '',
    };
    setPlan(prev => ({ ...prev, other: [...prev.other, item] }));
    setOtherTitle('');
    setOtherDate(new Date());
    setOtherHasDate(false);
  };

  // ── Remove handlers ──
  const removeClass      = (id: string) => setPlan(p => ({ ...p, classes:       p.classes.filter(i => i.id !== id) }));
  const removeRecruitment = (id: string) => setPlan(p => ({ ...p, recruitment:  p.recruitment.filter(i => i.id !== id) }));
  const removeSocial     = (id: string) => setPlan(p => ({ ...p, social_life:   p.social_life.filter(i => i.id !== id) }));
  const removeRoutine    = (id: string) => setPlan(p => ({ ...p, daily_routine: p.daily_routine.filter(i => i.id !== id) }));
  const removeOther      = (id: string) => setPlan(p => ({ ...p, other:         p.other.filter(i => i.id !== id) }));

  const handleContinue = async () => {
    setLoading(true);
    await savePlan(plan);
    router.replace(Routes.DASHBOARD);
  };

  const totalItems =
    plan.classes.length +
    plan.recruitment.length +
    plan.social_life.length +
    plan.daily_routine.length +
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
          <Text style={styles.title}>What do you want to plan?</Text>
          <Text style={styles.subtitle}>
            Tap a category to set it up. Everything is optional — update anytime from your dashboard.
          </Text>
        </View>

        {SECTIONS.map(sec => {
          const isOpen   = expanded === sec.key;
          const count    =
            sec.key === 'classes'       ? plan.classes.length :
            sec.key === 'recruitment'   ? plan.recruitment.length :
            sec.key === 'social_life'   ? plan.social_life.length :
            sec.key === 'daily_routine' ? plan.daily_routine.length :
            plan.other.length;

          return (
            <View key={sec.key} style={[styles.card, isOpen && styles.cardOpen]}>

              {/* ── Card header ── */}
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleSection(sec.key)}
                activeOpacity={0.75}
              >
                <View style={[styles.emojiBadge, { backgroundColor: sec.bg }]}>
                  <Text style={styles.emojiText}>{sec.emoji}</Text>
                </View>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardLabel}>{sec.label}</Text>
                  <Text style={styles.cardHint}>{sec.hint}</Text>
                </View>
                <View style={styles.cardRight}>
                  {count > 0 && (
                    <View style={[styles.countPill, { backgroundColor: sec.bg }]}>
                      <Text style={[styles.countText, { color: sec.accent }]}>{count}</Text>
                    </View>
                  )}
                  <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
                </View>
              </TouchableOpacity>

              {/* ── CLASSES ── */}
              {sec.key === 'classes' && (
                <>
                  {plan.classes.length > 0 && (
                    <View style={styles.itemList}>
                      {plan.classes.map((item, i) => (
                        <View key={item.id} style={[styles.itemRow, i < plan.classes.length - 1 && styles.itemRowBorder]}>
                          <View style={[styles.itemDot, { backgroundColor: sec.accent }]} />
                          <View style={styles.itemTextBlock}>
                            <Text style={styles.itemTitle}>{item.courseName}</Text>
                            <Text style={styles.itemMeta}>
                              {item.days.length > 0 ? item.days.join(', ') : 'No days set'}
                              {item.time ? ` · ${item.time}` : ''}
                            </Text>
                          </View>
                          <TouchableOpacity onPress={() => removeClass(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {isOpen && (
                    <View style={styles.formBody}>
                      <View style={styles.formDivider} />
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Course name</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Intro to Psychology"
                          placeholderTextColor={Colors.textMuted}
                          value={className}
                          onChangeText={setClassName}
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Days (optional)</Text>
                        <View style={styles.chipRow}>
                          {DAYS.map(day => (
                            <TouchableOpacity
                              key={day}
                              style={[styles.chip, classDays.includes(day) && { backgroundColor: '#6366F1', borderColor: '#6366F1' }]}
                              onPress={() => toggleDay(day)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.chipText, classDays.includes(day) && styles.chipTextActive]}>
                                {day}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Time (optional)</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. 9:00 AM"
                          placeholderTextColor={Colors.textMuted}
                          value={classTime}
                          onChangeText={setClassTime}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.addBtn, { borderColor: '#6366F1', backgroundColor: '#EEF2FF' }]}
                        onPress={addClass}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addBtnText, { color: '#6366F1' }]}>+ Add class</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* ── RECRUITMENT ── */}
              {sec.key === 'recruitment' && (
                <>
                  {plan.recruitment.length > 0 && (
                    <View style={styles.itemList}>
                      {plan.recruitment.map((item, i) => (
                        <View key={item.id} style={[styles.itemRow, i < plan.recruitment.length - 1 && styles.itemRowBorder]}>
                          <View style={[styles.taskTypeBadge, { backgroundColor: '#F0FDF4' }]}>
                            <Text style={[styles.taskTypeText, { color: '#16A34A' }]}>{item.taskType}</Text>
                          </View>
                          <View style={styles.itemTextBlock}>
                            <Text style={styles.itemTitle}>{item.company}</Text>
                            <Text style={styles.itemMeta}>📅 {formatDate(new Date(item.date))}</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeRecruitment(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {isOpen && (
                    <View style={styles.formBody}>
                      <View style={styles.formDivider} />
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Task type</Text>
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
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Company / Organisation</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Google, NHS, Deloitte"
                          placeholderTextColor={Colors.textMuted}
                          value={recCompany}
                          onChangeText={setRecCompany}
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Date</Text>
                        <TouchableOpacity
                          style={styles.datePicker}
                          onPress={() => setShowRecPicker(true)}
                          activeOpacity={0.8}
                        >
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
                      </View>
                      <TouchableOpacity
                        style={[styles.addBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
                        onPress={addRecruitment}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addBtnText, { color: '#16A34A' }]}>+ Add task</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* ── SOCIAL LIFE ── */}
              {sec.key === 'social_life' && (
                <>
                  {plan.social_life.length > 0 && (
                    <View style={styles.itemList}>
                      {plan.social_life.map((item, i) => (
                        <View key={item.id} style={[styles.itemRow, i < plan.social_life.length - 1 && styles.itemRowBorder]}>
                          <View style={[styles.itemDot, { backgroundColor: '#EA580C' }]} />
                          <View style={styles.itemTextBlock}>
                            <Text style={styles.itemTitle}>{item.activity}</Text>
                            <Text style={styles.itemMeta}>{item.frequency}</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeSocial(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {isOpen && (
                    <View style={styles.formBody}>
                      <View style={styles.formDivider} />
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Activity</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Basketball training, Study group"
                          placeholderTextColor={Colors.textMuted}
                          value={socialName}
                          onChangeText={setSocialName}
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>How often?</Text>
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
                      </View>
                      <TouchableOpacity
                        style={[styles.addBtn, { borderColor: '#EA580C', backgroundColor: '#FFF7ED' }]}
                        onPress={addSocial}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addBtnText, { color: '#EA580C' }]}>+ Add activity</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* ── DAILY ROUTINE ── */}
              {sec.key === 'daily_routine' && (
                <>
                  {plan.daily_routine.length > 0 && (
                    <View style={styles.itemList}>
                      {plan.daily_routine.map((item, i) => (
                        <View key={item.id} style={[styles.itemRow, i < plan.daily_routine.length - 1 && styles.itemRowBorder]}>
                          <Text style={styles.timeEmoji}>{TIME_OF_DAY_EMOJI[item.timeOfDay]}</Text>
                          <View style={styles.itemTextBlock}>
                            <Text style={styles.itemTitle}>{item.name}</Text>
                            <Text style={styles.itemMeta}>{item.timeOfDay}</Text>
                          </View>
                          <TouchableOpacity onPress={() => removeRoutine(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {isOpen && (
                    <View style={styles.formBody}>
                      <View style={styles.formDivider} />
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Routine name</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Review lecture notes"
                          placeholderTextColor={Colors.textMuted}
                          value={routineName}
                          onChangeText={setRoutineName}
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Time of day</Text>
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
                      </View>
                      <TouchableOpacity
                        style={[styles.addBtn, { borderColor: '#0284C7', backgroundColor: '#F0F9FF' }]}
                        onPress={addRoutine}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addBtnText, { color: '#0284C7' }]}>+ Add routine</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

              {/* ── OTHER ── */}
              {sec.key === 'other' && (
                <>
                  {plan.other.length > 0 && (
                    <View style={styles.itemList}>
                      {plan.other.map((item, i) => (
                        <View key={item.id} style={[styles.itemRow, i < plan.other.length - 1 && styles.itemRowBorder]}>
                          <View style={[styles.itemDot, { backgroundColor: '#9333EA' }]} />
                          <View style={styles.itemTextBlock}>
                            <Text style={styles.itemTitle}>{item.title}</Text>
                            {item.date ? <Text style={styles.itemMeta}>📅 {formatDate(new Date(item.date))}</Text> : null}
                          </View>
                          <TouchableOpacity onPress={() => removeOther(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={styles.removeBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
                  {isOpen && (
                    <View style={styles.formBody}>
                      <View style={styles.formDivider} />
                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Title</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Personal project, Volunteering"
                          placeholderTextColor={Colors.textMuted}
                          value={otherTitle}
                          onChangeText={setOtherTitle}
                        />
                      </View>
                      <View style={styles.fieldGroup}>
                        <TouchableOpacity
                          style={styles.toggleRow}
                          onPress={() => setOtherHasDate(p => !p)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.toggle, otherHasDate && styles.toggleActive]}>
                            <View style={[styles.toggleThumb, otherHasDate && styles.toggleThumbActive]} />
                          </View>
                          <Text style={styles.fieldLabel}>Add a date</Text>
                        </TouchableOpacity>
                        {otherHasDate && (
                          <>
                            <TouchableOpacity
                              style={styles.datePicker}
                              onPress={() => setShowOtherPicker(true)}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.datePickerIcon}>📅</Text>
                              <Text style={styles.datePickerText}>{formatDate(otherDate)}</Text>
                            </TouchableOpacity>
                            {showOtherPicker && (
                              <DateTimePicker
                                value={otherDate}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                themeVariant="light"
                                onChange={(_, date) => {
                                  if (Platform.OS === 'android') setShowOtherPicker(false);
                                  if (date) setOtherDate(date);
                                }}
                              />
                            )}
                          </>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.addBtn, { borderColor: '#9333EA', backgroundColor: '#FDF4FF' }]}
                        onPress={addOther}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.addBtnText, { color: '#9333EA' }]}>+ Add item</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}

            </View>
          );
        })}

        {/* Footer */}
        <View style={styles.footer}>
          {totalItems === 0 ? (
            <Text style={styles.skipHint}>No items yet — skip and add from your dashboard anytime.</Text>
          ) : (
            <Text style={styles.summaryHint}>{totalItems} item{totalItems > 1 ? 's' : ''} added ✓</Text>
          )}
          <Button label="Continue to dashboard" onPress={handleContinue} loading={loading} />
        </View>
      </ScrollView>
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
  pageHeader: { marginBottom: Spacing.lg },
  title:      { ...Typography.h1, color: Colors.textPrimary, marginBottom: Spacing.sm },
  subtitle:   { ...Typography.body, color: Colors.textSecondary, lineHeight: 22 },

  card: {
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  cardOpen: {
    borderColor: Colors.primary,
    ...Platform.select({
      ios:     { shadowColor: Colors.primary, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12 },
      android: { elevation: 2 },
    }),
  },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.md },
  emojiBadge:  { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  emojiText:   { fontSize: 22 },
  cardMeta:    { flex: 1, gap: 2 },
  cardLabel:   { ...Typography.h3, color: Colors.textPrimary },
  cardHint:    { ...Typography.caption, color: Colors.textMuted },
  cardRight:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  countPill:   { minWidth: 24, height: 24, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  countText:   { fontSize: 12, fontWeight: '700' },
  chevron:     { fontSize: 22, color: Colors.textMuted, lineHeight: 26 },
  chevronOpen: { transform: [{ rotate: '90deg' }], color: Colors.primary },

  itemList:     { marginHorizontal: Spacing.md, marginBottom: Spacing.sm, borderRadius: Radius.md, backgroundColor: Colors.offWhite, overflow: 'hidden' },
  itemRow:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, paddingHorizontal: Spacing.md },
  itemRowBorder:{ borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemDot:      { width: 7, height: 7, borderRadius: 4 },
  itemTextBlock:{ flex: 1 },
  itemTitle:    { ...Typography.body, color: Colors.textPrimary, fontWeight: '500' },
  itemMeta:     { ...Typography.caption, color: Colors.textSecondary, marginTop: 2 },
  removeBtnText:{ fontSize: 13, color: Colors.textMuted, padding: 4 },
  timeEmoji:    { fontSize: 18 },

  taskTypeBadge:{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full, backgroundColor: '#F0FDF4' },
  taskTypeText: { fontSize: 11, fontWeight: '700' },

  formBody:    { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: Spacing.md },
  formDivider: { height: 1, backgroundColor: Colors.border },
  fieldGroup:  { gap: 6 },
  fieldLabel:  { ...Typography.label, color: Colors.textSecondary },
  input: {
    height: 48, borderRadius: Radius.md, borderWidth: 1,
    borderColor: Colors.border, paddingHorizontal: Spacing.md,
    fontSize: 15, color: Colors.textPrimary, backgroundColor: Colors.offWhite,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, height: 34, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  chipText:       { fontSize: 13, fontWeight: '500', color: Colors.textSecondary },
  chipTextActive: { color: Colors.white },

  datePicker: {
    height: 48, borderRadius: Radius.md, borderWidth: 1.5,
    borderColor: Colors.primary, backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md, flexDirection: 'row',
    alignItems: 'center', gap: Spacing.sm,
  },
  datePickerIcon: { fontSize: 16 },
  datePickerText: { flex: 1, fontSize: 15, color: '#000000', fontWeight: '600' },

  toggleRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toggle:           { width: 40, height: 22, borderRadius: 11, backgroundColor: Colors.border, justifyContent: 'center', paddingHorizontal: 2 },
  toggleActive:     { backgroundColor: Colors.primary },
  toggleThumb:      { width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.white },
  toggleThumbActive:{ transform: [{ translateX: 18 }] },

  addBtn:    { height: 44, borderRadius: Radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  addBtnText:{ fontSize: 14, fontWeight: '600' },

  footer:      { marginTop: Spacing.lg, gap: Spacing.sm },
  skipHint:    { ...Typography.caption, color: Colors.textMuted, textAlign: 'center' },
  summaryHint: { ...Typography.caption, color: Colors.success, fontWeight: '600', textAlign: 'center' },
});