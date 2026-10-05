import { Pressable, StyleSheet, Text } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useReferral } from '@/hooks/useReferral';
import { formatPoints } from '@/utils/referralFormat';

// The points counter next to the menu button in the header: a flame filled with
// the app's blue and the number in white inside it. Tapping it opens the
// referral code popup (ReferralModal). Hidden until a real profile has loaded, so
// it never flashes "0" and then jumps to the real number.
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
      <IconSymbol name="flame.fill" color={Colors.primaryLight} size={40} />
      {/* Fixed size: scaled-up system fonts would spill outside the flame. */}
      <Text style={styles.points} allowFontScaling={false} numberOfLines={1}>
        {formatPoints(points)}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same 42pt height as the menu button beside it.
  button: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  points: {
    position: 'absolute',
    bottom: 7,
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.2,
  },
});
