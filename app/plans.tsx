import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { usePurchases } from '@/contexts/PurchasesContext';
import type { SubscriptionTier } from '@/types/subscription.types';

interface Tier {
  id: SubscriptionTier;
  name: string;
  monthlyPrice: string;
  // Annual cost expressed as a per-month equivalent, for the "Annual" toggle
  // state, plus the real yearly total shown as a small caption underneath.
  annualMonthlyEquivalent: string;
  annualTotal: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  // Product identifiers this tier's monthly/annual buttons map to — must
  // match exactly what's created in App Store Connect / Play Console. Free
  // has neither; it's never purchasable.
  monthlyProductId?: string;
  annualProductId?: string;
}

// Only features with real, shipped functionality behind them — no invented
// usage caps, plan-count limits, or "advanced" variants that don't actually
// exist in the app yet.
const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: '$0',
    annualMonthlyEquivalent: '$0',
    annualTotal: '',
    desc: 'Start planning with the basics.',
    features: [
      'Basic task planning',
      'Daily & weekly planner view',
      'Goals with AI-generated milestones',
      'Reminders (15 min before + at due time)',
      'Progress tracking',
    ],
  },
  {
    id: 'student',
    name: 'Student / Edu',
    monthlyPrice: '$6.99',
    annualMonthlyEquivalent: '$5.83',
    annualTotal: '$69.90/yr',
    desc: 'Stay on top of classes, exams, and deadlines.',
    features: [
      'Everything in Free',
      'Class schedule management',
      'Assignment & deadline tracking',
      'Calendar sync (Apple + Google)',
      'AI Study Buddy',
      'Habit tracking with streaks',
      'Exam countdown',
    ],
    monthlyProductId: 'student_monthly',
    annualProductId: 'student_annual',
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: '$11.99',
    annualMonthlyEquivalent: '$9.99',
    annualTotal: '$119.90/yr',
    desc: 'Plan your work, career, and goals.',
    features: [
      'Everything in Student / Edu',
      'Professional dashboard',
      'Career goal tracking',
      'Certification planning with AI-generated study topics',
      'AI Plan My Day & AI Goal Coach',
    ],
    highlight: true,
    monthlyProductId: 'professional_monthly',
    annualProductId: 'professional_annual',
  },
  {
    id: 'premium',
    name: 'Premium AI',
    monthlyPrice: '$29',
    annualMonthlyEquivalent: '$24.17',
    annualTotal: '$290/yr',
    desc: 'Advanced AI planning for high-stakes goals.',
    features: ['Everything in Professional'],
    monthlyProductId: 'premium_monthly',
    annualProductId: 'premium_annual',
  },
];

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, student: 1, professional: 2, premium: 3 };

const PERIOD_OPTIONS: { key: 'monthly' | 'annual'; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'annual', label: 'Annual' },
];

export default function Plans() {
  const { ready, tier: currentTier, subscriptions, purchasing, purchase, restorePurchases } = usePurchases();
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [restoring, setRestoring] = useState(false);

  const fetchedProductIds = new Set(subscriptions.map((s) => s.id));

  const handleSubscribe = (tierRow: Tier) => {
    const productId = period === 'monthly' ? tierRow.monthlyProductId : tierRow.annualProductId;
    if (!productId) return;
    purchase(productId);
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await restorePurchases();
      Alert.alert('Restored', "Any previous purchases tied to this account have been restored.");
    } catch (err) {
      console.error('[Plans] restore failed', err);
      Alert.alert("Couldn't restore purchases", 'Check your connection and try again.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader
        title="Plans & pricing"
        subtitle="Compare tiers — from free planning to full AI coaching."
        titleSize={25}
        subtitleSize={13.5}
      />

      {!ready && (
        <View style={styles.noticeBox}>
          <IconSymbol name="info.circle" color={Colors.warning} size={16} />
          <Text style={styles.noticeText}>
            Pricing shown is indicative and not final. Subscribing isn&apos;t available in this build yet —
            every feature above is currently available on the Free plan.
          </Text>
        </View>
      )}

      <SegmentedToggle options={PERIOD_OPTIONS} value={period} onChange={setPeriod} style={styles.periodToggle} />

      <View style={styles.tierList}>
        {TIERS.map((tierRow) => {
          const isFree = tierRow.id === 'free';
          const isCurrent = ready && currentTier === tierRow.id;
          const productId = period === 'monthly' ? tierRow.monthlyProductId : tierRow.annualProductId;
          const purchasable = ready && !isFree && !!productId && fetchedProductIds.has(productId);
          const isPurchasingThis = !!productId && purchasing === productId;

          let ctaLabel: string;
          let ctaDisabled: boolean;
          if (isFree || isCurrent) {
            ctaLabel = 'Current plan';
            ctaDisabled = true;
          } else if (!purchasable) {
            ctaLabel = 'Coming soon';
            ctaDisabled = true;
          } else if (currentTier !== 'free') {
            ctaLabel = TIER_RANK[tierRow.id] > TIER_RANK[currentTier] ? 'Upgrade' : 'Switch plan';
            ctaDisabled = false;
          } else {
            ctaLabel = 'Subscribe';
            ctaDisabled = false;
          }

          // Once the store has actually returned this product, always show its
          // real localized price instead of the static estimate below — the
          // static strings are US-only guesses and go stale the moment a
          // price changes in App Store Connect / Play Console without a
          // matching code change. The annual live price is the true yearly
          // total (not a derived per-month figure, which would need parsing
          // a formatted currency string back into a number), so its unit
          // label reads "/yr" instead of "/mo" and needs no separate caption.
          const liveProduct = productId ? subscriptions.find((s) => s.id === productId) : undefined;
          const displayPrice =
            liveProduct?.displayPrice ?? (period === 'monthly' ? tierRow.monthlyPrice : tierRow.annualMonthlyEquivalent);
          const priceUnit = liveProduct ? (period === 'monthly' ? '/mo' : '/yr') : '/mo';
          const displayCaption =
            !liveProduct && period === 'annual' && tierRow.annualTotal ? `Billed ${tierRow.annualTotal}` : undefined;

          return (
            <Card key={tierRow.id} style={[styles.card, tierRow.highlight && styles.cardHighlight]}>
              {tierRow.highlight && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>MOST POPULAR</Text>
                </View>
              )}
              <Text style={styles.tierName}>{tierRow.name}</Text>
              <Text style={styles.tierDesc}>{tierRow.desc}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{displayPrice}</Text>
                <Text style={styles.priceUnit}>{priceUnit}</Text>
              </View>
              {!!displayCaption && <Text style={styles.billed}>{displayCaption}</Text>}

              <View style={styles.featureList}>
                {tierRow.features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <IconSymbol name="checkmark" color={tierRow.highlight ? Colors.primaryLight : Colors.success} size={13} />
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                style={[
                  styles.ctaButton,
                  tierRow.highlight && !ctaDisabled && styles.ctaButtonHighlight,
                  ctaDisabled && styles.ctaButtonDisabled,
                ]}
                disabled={ctaDisabled || isPurchasingThis}
                onPress={() => handleSubscribe(tierRow)}
              >
                {isPurchasingThis ? (
                  <ActivityIndicator size="small" color={tierRow.highlight ? Colors.white : Colors.textSecondary} />
                ) : (
                  <Text
                    style={[
                      styles.ctaText,
                      tierRow.highlight && !ctaDisabled && styles.ctaTextHighlight,
                      ctaDisabled && styles.ctaTextDisabled,
                    ]}
                  >
                    {ctaLabel}
                  </Text>
                )}
              </Pressable>
            </Card>
          );
        })}
      </View>

      <Pressable style={styles.restoreButton} onPress={handleRestore} disabled={restoring || !ready}>
        {restoring ? (
          <ActivityIndicator size="small" color={Colors.textSecondary} />
        ) : (
          <Text style={styles.restoreText}>Restore purchases</Text>
        )}
      </Pressable>

      {/* Apple Guideline 3.1.2: the purchase screen must show renewal terms
          and carry functional links to the Terms of Use and Privacy Policy. */}
      <Text style={styles.legalNote}>
        Subscriptions renew automatically until canceled at least 24 hours before the end of the
        current period. Manage or cancel anytime in your App Store or Google Play account settings.
      </Text>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => WebBrowser.openBrowserAsync('https://i-planner.onrender.com/terms.html')}>
          <Text style={styles.legalLinkText}>Terms of Use</Text>
        </Pressable>
        <Text style={styles.legalLinkDivider}>·</Text>
        <Pressable onPress={() => WebBrowser.openBrowserAsync('https://i-planner.onrender.com/privacy.html')}>
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    marginHorizontal: Spacing.md,
    marginTop: 16,
    backgroundColor: Colors.warningSoft,
    borderWidth: 1,
    borderColor: Colors.warning,
    borderRadius: Radius.md,
    padding: 13,
  },
  noticeText: {
    flex: 1,
    fontSize: 12.5,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
  periodToggle: {
    marginHorizontal: Spacing.md,
    marginTop: 16,
  },
  tierList: {
    paddingHorizontal: Spacing.md,
    marginTop: 18,
    gap: 14,
  },
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: 18,
  },
  cardHighlight: {
    borderColor: Colors.primaryLight,
  },
  badge: {
    position: 'absolute',
    top: -11,
    right: 16,
    backgroundColor: Colors.primaryLight,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.4,
  },
  tierName: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  tierDesc: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 3,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  priceUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 3,
  },
  billed: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  featureList: {
    marginTop: 14,
    gap: 9,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  featureText: {
    flex: 1,
    fontSize: 13.5,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  ctaButton: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 13,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonHighlight: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  ctaButtonDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  ctaTextHighlight: {
    color: Colors.white,
  },
  ctaTextDisabled: {
    color: Colors.textMuted,
  },
  restoreButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingVertical: 10,
  },
  restoreText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  legalNote: {
    marginTop: 14,
    marginHorizontal: Spacing.md,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  legalLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.primaryLight,
    textDecorationLine: 'underline',
    paddingVertical: 6,
  },
  legalLinkDivider: {
    color: Colors.textMuted,
    fontSize: 12.5,
  },
});
