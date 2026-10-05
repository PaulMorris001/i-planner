import { Pressable, StyleSheet, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useReferral } from '@/hooks/useReferral';
import { formatPoints } from '@/utils/referralFormat';

// The points counter next to the menu button in the header: a flame in the app's
// blue with the number written beside it, so a big number can grow sideways
// instead of being squeezed inside the icon. Tapping it opens the referral code
// popup (ReferralModal). Hidden until a real profile has loaded, so it never
// flashes "0" and then jumps to the real number.
export function ReferralPointsBadge() {
  const { code, points, openModal } = useReferral();
  // No profile yet (still loading, or the request failed): show nothing rather than a misleading 0.
  if (!code) return null;

  return (
    <Pressable
      onPress={openModal}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${points} points. Open your referral code.`}
      style={styles.button}
    >
      <IconSymbol name="flame.fill" color={Colors.primaryLight} size={28} />
      <Text style={styles.points} allowFontScaling={false} numberOfLines={1}>
        {formatPoints(points)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same 42pt height as the menu button beside it.
  button: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  points: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
});
