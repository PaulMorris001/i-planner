/* eslint-disable react/no-unescaped-entities */
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, ScrollView, Platform, Alert,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { usePlan } from '@/hooks/usePlan';
import { useOnboarding } from '@/hooks/useOnboarding';
import type { CareerGoal, FinancialGoal, ProfessionalPlan } from '@/types/plan.types';

const EMPTY_PLAN: ProfessionalPlan = {
  currentRole:     '',
  currentIndustry: '',
  careerGoals:     [],
  financialGoals:  [],
  certifications:  [],
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR + i);

const CERT_SUGGESTIONS = [
  'PMP', 'AWS Solutions Architect', 'Google Analytics',
  'CFA', 'CIMA', 'Six Sigma', 'IELTS', 'ACCA', 'Scrum Master', 'CPA',
];

// ── Helpers ────────────────────────────────────────────────────────────────
type Section = 'role' | 'career' | 'financial' | 'certifications';

const SECTIONS: { key: Section; label: string; emoji: string; hint: string }[] = [
  {
    key: 'role',
    label: 'Current position',
    emoji: '🏢',
    hint: 'Tell us where you are now',
  },
  {
    key: 'career',
    label: 'Career goals',
    emoji: '🚀',
    hint: 'Where do you want to be?',
  },
  {
    key: 'financial',
    label: 'Financial goals',
    emoji: '💰',
    hint: 'Income, savings & wealth targets',
  },
  {
    key: 'certifications',
    label: 'Certifications & skills',
    emoji: '🎓',
    hint: 'Qualifications you want to earn',
  },
];

export default function ProfessionalPlan() {
  const insets = useSafeAreaInsets();
  const { saveProfessionalPlan } = usePlan();
  const { completeOnboarding } = useOnboarding();

  const [plan, setPlan]         = useState<ProfessionalPlan>(EMPTY_PLAN);
  const [expanded, setExpanded] = useState<Section | null>('role');
  const [loading, setLoading]   = useState(false);

  // Career goal form state
  const [careerGoalInput, setCareerGoalInput]   = useState('');
  const [careerYearInput, setCareerYearInput]   = useState(String(CURRENT_YEAR + 3));

  // Financial goal form state
  const [finGoalInput, setFinGoalInput]         = useState('');
  const [finAmountInput, setFinAmountInput]     = useState('');
  const [finYearInput, setFinYearInput]         = useState(String(CURRENT_YEAR + 2));

  // Cert form state
  const [certInput, setCertInput]               = useState('');

  const PROGRESS = 0.66;

  const toggleSection = (key: Section) => {
    setExpanded(prev => (prev === key ? null : key));
  };

  // ── Career goals ──
  const addCareerGoal = () => {
    if (!careerGoalInput.trim()) {
      Alert.alert('Goal required', 'Please describe your career goal.');
      return;
    }
    const newGoal: CareerGoal = {
      id:         Date.now().toString(),
      goal:       careerGoalInput.trim(),
      targetYear: careerYearInput,
    };
    setPlan(prev => ({ ...prev, careerGoals: [...prev.careerGoals, newGoal] }));
    setCareerGoalInput('');
    setCareerYearInput(String(CURRENT_YEAR + 3));
  };

  const removeCareerGoal = (id: string) => {
    setPlan(prev => ({ ...prev, careerGoals: prev.careerGoals.filter(g => g.id !== id) }));
  };

  // ── Financial goals ──
  const addFinancialGoal = () => {
    if (!finGoalInput.trim()) {
      Alert.alert('Goal required', 'Please describe your financial goal.');
      return;
    }
    const newGoal: FinancialGoal = {
      id:           Date.now().toString(),
      goal:         finGoalInput.trim(),
      targetAmount: finAmountInput.trim(),
      targetYear:   finYearInput,
    };
    setPlan(prev => ({ ...prev, financialGoals: [...prev.financialGoals, newGoal] }));
    setFinGoalInput('');
    setFinAmountInput('');
    setFinYearInput(String(CURRENT_YEAR + 2));
  };

  const removeFinancialGoal = (id: string) => {
    setPlan(prev => ({ ...prev, financialGoals: prev.financialGoals.filter(g => g.id !== id) }));
  };

  // ── Certifications ──
  const addCert = (name: string) => {
    const cert = name.trim();
    if (!cert) return;
    if (plan.certifications.includes(cert)) return;
    setPlan(prev => ({ ...prev, certifications: [...prev.certifications, cert] }));
    setCertInput('');
  };

  const removeCert = (cert: string) => {
    setPlan(prev => ({ ...prev, certifications: prev.certifications.filter(c => c !== cert) }));
  };

  // ── Continue ──
  const handleContinue = async () => {
    setLoading(true);
    await saveProfessionalPlan(plan);
    await completeOnboarding();
    router.replace(Routes.DASHBOARD);
  };

  const totalItems =
    plan.careerGoals.length +
    plan.financialGoals.length +
    plan.certifications.length;

  const renderSectionHeader = (sec: typeof SECTIONS[number]) => {
    const isOpen = expanded === sec.key;
    return (
      <TouchableOpacity
        style={[styles.sectionHeader, isOpen && styles.sectionHeaderOpen]}
        onPress={() => toggleSection(sec.key)}
        activeOpacity={0.75}
      >
        <View style={styles.sectionEmoji}>
          <Text style={styles.sectionEmojiText}>{sec.emoji}</Text>
        </View>
        <View style={styles.sectionMeta}>
          <Text style={styles.sectionLabel}>{sec.label}</Text>
          <Text style={styles.sectionHint}>{sec.hint}</Text>
        </View>
        <Text style={[styles.chevron, isOpen && styles.chevronOpen]}>›</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.offWhite }}>

      {/* ── Sticky header ── */}
      <View style={[styles.stickyHeader, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
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
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Page heading */}
        <View style={styles.pageHeader}>
          <Text style={styles.title}>Where do you want to grow?</Text>
          <Text style={styles.subtitle}>
            Tell us about your current role and set professional goals. We'll build your growth plan around this.
          </Text>
        </View>

        {/* ── SECTION 1: Current position ── */}
        <View style={[styles.card, expanded === 'role' && styles.cardOpen]}>
          {renderSectionHeader(SECTIONS[0])}
          {expanded === 'role' && (
            <View style={styles.sectionBody}>
              <View style={styles.formDivider} />

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Current job title</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Marketing Manager"
                  placeholderTextColor={Colors.textMuted}
                  value={plan.currentRole}
                  onChangeText={v => setPlan(p => ({ ...p, currentRole: v }))}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Industry</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Financial Services, Tech, Healthcare"
                  placeholderTextColor={Colors.textMuted}
                  value={plan.currentIndustry}
                  onChangeText={v => setPlan(p => ({ ...p, currentIndustry: v }))}
                />
              </View>

              {plan.currentRole ? (
                <View style={styles.previewBox}>
                  <Text style={styles.previewText}>
                    📍 Currently: <Text style={styles.previewHighlight}>{plan.currentRole}</Text>
                    {plan.currentIndustry ? ` in ${plan.currentIndustry}` : ''}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* ── SECTION 2: Career goals ── */}
        <View style={[styles.card, expanded === 'career' && styles.cardOpen]}>
          {renderSectionHeader(SECTIONS[1])}

          {/* Added career goals */}
          {plan.careerGoals.length > 0 && (
            <View style={styles.itemList}>
              {plan.careerGoals.map((g, i) => (
                <View
                  key={g.id}
                  style={[styles.itemRow, i < plan.careerGoals.length - 1 && styles.itemRowBorder]}
                >
                  <View style={[styles.itemDot, { backgroundColor: '#6366F1' }]} />
                  <View style={styles.itemTextBlock}>
                    <Text style={styles.itemTitle}>{g.goal}</Text>
                    <Text style={styles.itemMeta}>Target: {g.targetYear}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeCareerGoal(g.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {expanded === 'career' && (
            <View style={styles.sectionBody}>
              <View style={styles.formDivider} />

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Career goal</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Get promoted to Senior Manager"
                  placeholderTextColor={Colors.textMuted}
                  value={careerGoalInput}
                  onChangeText={setCareerGoalInput}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Target year</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearRow}
                >
                  {YEAR_OPTIONS.map(yr => (
                    <TouchableOpacity
                      key={yr}
                      style={[
                        styles.yearChip,
                        careerYearInput === String(yr) && styles.yearChipActive,
                      ]}
                      onPress={() => setCareerYearInput(String(yr))}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.yearChipText,
                        careerYearInput === String(yr) && styles.yearChipTextActive,
                      ]}>
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={styles.addBtn}
                onPress={addCareerGoal}
                activeOpacity={0.8}
              >
                <Text style={styles.addBtnText}>+ Add career goal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── SECTION 3: Financial goals ── */}
        <View style={[styles.card, expanded === 'financial' && styles.cardOpen]}>
          {renderSectionHeader(SECTIONS[2])}

          {/* Added financial goals */}
          {plan.financialGoals.length > 0 && (
            <View style={styles.itemList}>
              {plan.financialGoals.map((g, i) => (
                <View
                  key={g.id}
                  style={[styles.itemRow, i < plan.financialGoals.length - 1 && styles.itemRowBorder]}
                >
                  <View style={[styles.itemDot, { backgroundColor: '#16A34A' }]} />
                  <View style={styles.itemTextBlock}>
                    <Text style={styles.itemTitle}>{g.goal}</Text>
                    <Text style={styles.itemMeta}>
                      {g.targetAmount ? `${g.targetAmount} · ` : ''}Target: {g.targetYear}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => removeFinancialGoal(g.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {expanded === 'financial' && (
            <View style={styles.sectionBody}>
              <View style={styles.formDivider} />

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Financial goal</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Save for a house deposit"
                  placeholderTextColor={Colors.textMuted}
                  value={finGoalInput}
                  onChangeText={setFinGoalInput}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Target amount (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. ₦5,000,000 or $10,000"
                  placeholderTextColor={Colors.textMuted}
                  value={finAmountInput}
                  onChangeText={setFinAmountInput}
                  keyboardType="default"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Target year</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.yearRow}
                >
                  {YEAR_OPTIONS.map(yr => (
                    <TouchableOpacity
                      key={yr}
                      style={[
                        styles.yearChip,
                        finYearInput === String(yr) && styles.yearChipActive,
                      ]}
                      onPress={() => setFinYearInput(String(yr))}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.yearChipText,
                        finYearInput === String(yr) && styles.yearChipTextActive,
                      ]}>
                        {yr}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <TouchableOpacity
                style={[styles.addBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
                onPress={addFinancialGoal}
                activeOpacity={0.8}
              >
                <Text style={[styles.addBtnText, { color: '#16A34A' }]}>+ Add financial goal</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── SECTION 4: Certifications ── */}
        <View style={[styles.card, expanded === 'certifications' && styles.cardOpen]}>
          {renderSectionHeader(SECTIONS[3])}

          {/* Added certs */}
          {plan.certifications.length > 0 && (
            <View style={styles.certPills}>
              {plan.certifications.map(cert => (
                <View key={cert} style={styles.certPill}>
                  <Text style={styles.certPillText}>{cert}</Text>
                  <TouchableOpacity onPress={() => removeCert(cert)}>
                    <Text style={styles.certRemove}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {expanded === 'certifications' && (
            <View style={styles.sectionBody}>
              <View style={styles.formDivider} />

              {/* Quick suggestions */}
              <Text style={styles.fieldLabel}>Quick add</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsRow}
              >
                {CERT_SUGGESTIONS.filter(c => !plan.certifications.includes(c)).map(c => (
                  <TouchableOpacity
                    key={c}
                    style={styles.suggestionChip}
                    onPress={() => addCert(c)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionChipText}>+ {c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Custom input */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Or type your own</Text>
                <View style={styles.certInputRow}>
                  <TextInput
                    style={[styles.input, { flex: 1 }]}
                    placeholder="e.g. Prince2, TOGAF"
                    placeholderTextColor={Colors.textMuted}
                    value={certInput}
                    onChangeText={setCertInput}
                    onSubmitEditing={() => addCert(certInput)}
                    returnKeyType="done"
                  />
                  <TouchableOpacity
                    style={styles.certAddBtn}
                    onPress={() => addCert(certInput)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.certAddBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          {totalItems === 0 ? (
            <Text style={styles.skipHint}>
              You can skip and set goals from your dashboard later.
            </Text>
          ) : (
            <Text style={styles.summaryHint}>
              {totalItems} goal{totalItems > 1 ? 's' : ''} set ✓ — your growth plan is ready.
            </Text>
          )}
          <Button
            label="Continue to dashboard"
            onPress={handleContinue}
            loading={loading}
          />
          <TouchableOpacity
            onPress={async () => {
              await completeOnboarding();
              router.replace(Routes.DASHBOARD);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.skipLink}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Sticky header ──
  stickyHeader: {
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backArrow: {
    fontSize: 18,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  backLabel: {
    ...Typography.body,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  stepBadge: {
    backgroundColor: Colors.overlay,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepText: {
    ...Typography.caption,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressTrack: {
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },

  // ── Scroll ──
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  pageHeader: {
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  // ── Cards ──
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
      ios: {
        shadowColor: Colors.primary,
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  sectionHeaderOpen: {},
  sectionEmoji: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionEmojiText: {
    fontSize: 22,
  },
  sectionMeta: {
    flex: 1,
    gap: 2,
  },
  sectionLabel: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  sectionHint: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  chevron: {
    fontSize: 22,
    color: Colors.textMuted,
    lineHeight: 26,
  },
  chevronOpen: {
    transform: [{ rotate: '90deg' }],
    color: Colors.primary,
  },

  // ── Section body ──
  sectionBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  formDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
  },
  input: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.offWhite,
  },

  // ── Year chips ──
  yearRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  yearChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  yearChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  yearChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  yearChipTextActive: {
    color: Colors.white,
  },

  // ── Preview box ──
  previewBox: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(93, 202, 165, 0.25)',
  },
  previewText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  previewHighlight: {
    fontWeight: '700',
    color: Colors.primary,
  },

  // ── Item list ──
  itemList: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.offWhite,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  itemTextBlock: {
    flex: 1,
  },
  itemTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  itemMeta: {
    ...Typography.caption,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  removeBtnText: {
    fontSize: 13,
    color: Colors.textMuted,
    padding: 4,
  },

  // ── Add buttons ──
  addBtn: {
    height: 44,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },

  // ── Certifications ──
  certPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  certPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.overlay,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(26, 20, 99, 0.12)',
  },
  certPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  certRemove: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  suggestionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  suggestionChip: {
    paddingHorizontal: 12,
    height: 34,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offWhite,
  },
  suggestionChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  certInputRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  certAddBtn: {
    height: 48,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certAddBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },

  // ── Footer ──
  footer: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  skipHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  summaryHint: {
    ...Typography.caption,
    color: Colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  skipLink: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: Spacing.xs,
  },
});