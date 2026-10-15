import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface AlreadyMemberModalProps {
  visible: boolean;
  // The link that was tapped is this account's own invite link.
  isOwnLink: boolean;
  // Points a friend and the sharer earn (from the server, so the wording never goes stale).
  rewards: { referrer: number; referred: number };
  // False while this account's own code has not loaded: there is nothing to share yet.
  canShare: boolean;
  // Opens the share sheet with this account's own link.
  onShare: () => void;
  onClose: () => void;
}

// Shown when someone who already has an account taps a friend's referral link. A code can only be
// used by a brand-new account, so there is nothing to apply: this says so kindly and turns the
// moment into "invite your own friends".
export function AlreadyMemberModal({ visible, isOwnLink, rewards, canShare, onShare, onClose }: AlreadyMemberModalProps) {
  // The reward amounts come from the server; until they have, don't print "0 points".
  const rewardText =
    rewards.referrer > 0 && rewards.referred > 0
      ? `you earn ${rewards.referrer} points, and they earn ${rewards.referred} too`
      : 'you both earn points';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* The card swallows taps so only the dimmed area behind it closes the popup. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.badge}>
            <IconSymbol name="person.fill" color={Colors.primaryLight} size={32} />
          </View>

          <Text style={styles.title}>{isOwnLink ? "That's your own invite link" : "You're already in!"}</Text>
          <Text style={styles.body}>
            {isOwnLink
              ? 'Share it with friends who are new to i-Planner.'
              : 'That invitation is for people joining i-Planner for the first time, so there is nothing to apply to your account.'}
          </Text>
          <Text style={styles.body}>
            Know someone who could use it? When a friend signs up with your code, {rewardText}.
          </Text>

          {canShare && (
            <Pressable style={styles.primary} onPress={onShare} accessibilityRole="button">
              <IconSymbol name="square.and.arrow.up" color={Colors.white} size={17} />
              <Text style={styles.primaryText}>Share my invite link</Text>
            </Pressable>
          )}
          <Pressable onPress={onClose} hitSlop={8} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Maybe later</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,40,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: Colors.white,
    borderRadius: 24,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center', marginTop: 10 },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  secondary: { marginTop: 14, paddingVertical: 4 },
  secondaryText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
