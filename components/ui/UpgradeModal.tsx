import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { TIER_LABEL } from '@/constants/featureTiers';
import { Routes } from '@/constants/routes';
import type { SubscriptionTier } from '@/types/subscription.types';

interface UpgradeModalProps {
  visible: boolean;
  onClose: () => void;
  requiredTier: SubscriptionTier;
  featureLabel: string;
}

// Shown wherever a tapped feature exceeds the user's current tier — see
// constants/featureTiers.ts's FEATURE_MIN_TIER for what's gated. Every gated
// call site should check this client-side first (so tapping shows the modal
// instantly, no round trip) and also handle a 403 with field "tier" from the
// server as a fallback, since the server enforces the same map independently
// and can reject a call the client thought was fine (e.g. the "first free
// use" exemptions in plan.controller.ts/syllabus.controller.ts, which the
// client can't cheaply know the state of ahead of time).
export function UpgradeModal({ visible, onClose, requiredTier, featureLabel }: UpgradeModalProps) {
  const router = useRouter();

  const handleViewPlans = () => {
    onClose();
    router.push(Routes.PLANS);
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.iconBadge}>
          <IconSymbol name="sparkles" color={Colors.primaryLight} size={26} />
        </View>

        <Text style={styles.title}>Upgrade to {TIER_LABEL[requiredTier]}</Text>
        <Text style={styles.subtitle}>
          {featureLabel} is available on the {TIER_LABEL[requiredTier]} plan and above.
        </Text>

        <Pressable style={styles.upgradeBtn} onPress={handleViewPlans}>
          <Text style={styles.upgradeBtnText}>View Plans</Text>
        </Pressable>

        <Pressable onPress={onClose} hitSlop={8}>
          <Text style={styles.notNowText}>Not now</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
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
  notNowText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
});
