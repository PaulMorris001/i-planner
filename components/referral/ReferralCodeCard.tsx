import { Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useReferral } from '@/hooks/useReferral';
import { useCopyReferralCode } from '@/hooks/useCopyReferralCode';
import { useShareReferralLink } from '@/hooks/useShareReferralLink';
import { formatReferralCode, friendsLabel } from '@/utils/referralFormat';

// The account's referral code on the Profile screen (just above Calendar Sync):
// the code, a Copy button, and how many points / friends it has earned.
export function ReferralCodeCard() {
  const { loaded, code, points, referralCount, refresh } = useReferral();
  const { copied, copy } = useCopyReferralCode(code);
  const { share } = useShareReferralLink(code);

  if (!code) {
    return (
      <View style={styles.card}>
        <Text style={styles.empty}>{loaded ? "Couldn't load your referral code." : 'Getting your referral code…'}</Text>
        {loaded && (
          <Pressable onPress={refresh} hitSlop={8}>
            <Text style={styles.retry}>Try again</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.flameBox}>
          <IconSymbol name="flame.fill" color={Colors.primaryLight} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.code} selectable>
            {formatReferralCode(code)}
          </Text>
          <Text style={styles.stats}>
            {points} points · {friendsLabel(referralCount)}
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionButton, copied && styles.copyButtonDone]}
          onPress={copy}
          accessibilityRole="button"
          accessibilityLabel="Copy referral code"
        >
          <IconSymbol name={copied ? 'checkmark' : 'doc.on.doc'} color={copied ? Colors.white : Colors.primaryLight} size={15} />
          <Text style={[styles.copyText, copied && styles.copyTextDone]}>{copied ? 'Copied' : 'Copy'}</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          onPress={share}
          accessibilityRole="button"
          accessibilityLabel="Share referral link"
        >
          <IconSymbol name="square.and.arrow.up" color={Colors.primaryLight} size={15} />
          <Text style={styles.copyText}>Share link</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flameBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  code: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 2,
    color: Colors.textPrimary,
  },
  stats: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderRadius: 999,
    paddingVertical: 9,
  },
  copyButtonDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  copyText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  copyTextDone: {
    color: Colors.white,
  },
  empty: {
    fontSize: 13.5,
    color: Colors.textSecondary,
  },
  retry: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
