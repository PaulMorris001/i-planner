import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';

interface Tier {
  id: string;
  name: string;
  price: string;
  billed?: string;
  desc: string;
  features: string[];
  highlight?: boolean;
  cta: string;
  ctaDisabled?: boolean;
}

// Only features with real, shipped functionality behind them — no invented
// usage caps, plan-count limits, or "advanced" variants that don't actually
// exist in the app yet.
const TIERS: Tier[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    desc: 'Start planning with the basics.',
    features: [
      'Basic task planning',
      'Daily & weekly planner view',
      'Goals with AI-generated milestones',
      'Reminders (15 min before + at due time)',
      'Progress tracking',
    ],
    cta: 'Current plan',
    ctaDisabled: true,
  },
  {
    id: 'student',
    name: 'Student / Edu',
    price: '$6.99',
    billed: '$69.90/yr',
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
    cta: 'Coming soon',
    ctaDisabled: true,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: '$11.99',
    billed: '$119.90/yr',
    desc: 'Plan your work, career, and goals.',
    features: [
      'Everything in Student / Edu',
      'Professional dashboard',
      'Career goal tracking',
      'Certification planning with AI-generated study topics',
      'AI Plan My Day & AI Goal Coach',
    ],
    highlight: true,
    cta: 'Coming soon',
    ctaDisabled: true,
  },
  {
    id: 'premium',
    name: 'Premium AI',
    price: '$29',
    billed: '$290/yr',
    desc: 'Advanced AI planning for high-stakes goals.',
    features: ['Everything in Professional'],
    cta: 'Coming soon',
    ctaDisabled: true,
  },
];

export default function Plans() {
  const router = useRouter();

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Plans & pricing</Text>
      <Text style={styles.subtitle}>Compare tiers — from free planning to full AI coaching.</Text>

      <View style={styles.noticeBox}>
        <IconSymbol name="info.circle" color={Colors.warning} size={16} />
        <Text style={styles.noticeText}>
          Pricing shown is indicative and not final. Billing isn't live yet — every feature above is
          currently available on the Free plan.
        </Text>
      </View>

      <View style={styles.tierList}>
        {TIERS.map((tier) => (
          <View key={tier.id} style={[styles.card, tier.highlight && styles.cardHighlight]}>
            {tier.highlight && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>MOST POPULAR</Text>
              </View>
            )}
            <Text style={styles.tierName}>{tier.name}</Text>
            <Text style={styles.tierDesc}>{tier.desc}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{tier.price}</Text>
              <Text style={styles.priceUnit}>/mo</Text>
            </View>
            {tier.billed && <Text style={styles.billed}>{tier.billed}</Text>}

            <View style={styles.featureList}>
              {tier.features.map((f) => (
                <View key={f} style={styles.featureRow}>
                  <IconSymbol name="checkmark" color={tier.highlight ? Colors.primaryLight : Colors.success} size={13} />
                  <Text style={styles.featureText}>{f}</Text>
                </View>
              ))}
            </View>

            <Pressable
              style={[
                styles.ctaButton,
                tier.highlight && styles.ctaButtonHighlight,
                tier.ctaDisabled && styles.ctaButtonDisabled,
              ]}
              disabled={tier.ctaDisabled}
            >
              <Text
                style={[
                  styles.ctaText,
                  tier.highlight && styles.ctaTextHighlight,
                  tier.ctaDisabled && styles.ctaTextDisabled,
                ]}
              >
                {tier.cta}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 25,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 12,
    paddingHorizontal: Spacing.md,
  },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    marginTop: 5,
    paddingHorizontal: Spacing.md,
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
});
