import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useReferral } from '@/hooks/useReferral';
import { useCopyReferralCode } from '@/hooks/useCopyReferralCode';
import { formatReferralCode, friendsLabel } from '@/utils/referralFormat';

// Centered popup showing the account's referral code with a Copy button. It
// opens in two cases:
//  - by itself, once, for a brand-new sign-up the first time they reach the app
//    (welcomePending), and
//  - whenever the points badge in the header is tapped.
// Rendered inside the signed-in app layout, NOT globally, so the welcome popup
// can't appear in the middle of onboarding.
export function ReferralModal() {
  const { loaded, code, points, referralCount, referredBy, welcomePending, rewards, modalOpen, closeModal, markWelcomeSeen } =
    useReferral();
  const { copied, copy } = useCopyReferralCode(code);

  const visible = loaded && !!code && (modalOpen || welcomePending);

  const handleClose = () => {
    closeModal();
    if (welcomePending) markWelcomeSeen();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        {/* The card swallows taps so only the dimmed area behind it closes the popup. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.flameBadge}>
            <IconSymbol name="flame.fill" color={Colors.primaryLight} size={34} />
          </View>

          <Text style={styles.title}>{welcomePending ? 'Welcome to i-Planner!' : 'Your referral code'}</Text>
          <Text style={styles.subtitle}>
            {welcomePending && referredBy
              ? `You got ${rewards.referred} bonus points for joining with a friend's code. Here is your own code to share.`
              : welcomePending
                ? 'Here is your personal referral code. Share it with friends and you both earn points.'
                : 'Share this code with friends when they sign up.'}
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.code} selectable>
              {formatReferralCode(code)}
            </Text>
          </View>

          <Pressable style={[styles.copyButton, copied && styles.copyButtonDone]} onPress={copy} accessibilityRole="button">
            <IconSymbol name={copied ? 'checkmark' : 'doc.on.doc'} color={Colors.white} size={17} />
            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy code'}</Text>
          </Pressable>

          <Text style={styles.explainer}>
            You earn {rewards.referrer} points for every friend who signs up with your code, and they earn {rewards.referred} too.
          </Text>

          <View style={styles.statsRow}>
            <Text style={styles.stat}>
              <Text style={styles.statStrong}>{points}</Text> points
            </Text>
            <View style={styles.statDot} />
            <Text style={styles.stat}>{friendsLabel(referralCount)}</Text>
          </View>

          <Pressable onPress={handleClose} hitSlop={8} style={styles.done}>
            <Text style={styles.doneText}>{welcomePending ? 'Got it' : 'Close'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(15, 14, 42, 0.55)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
  flameBadge: {
    width: 60,
    height: 60,
    borderRadius: Radius.full,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  codeBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 16,
    backgroundColor: Colors.offWhite,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primaryLight,
    borderRadius: Radius.lg,
  },
  code: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 4,
    color: Colors.textPrimary,
  },
  copyButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  copyButtonDone: {
    backgroundColor: Colors.success,
  },
  copyText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  explainer: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  stat: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statStrong: {
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  done: {
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
