import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';

// UI only for now — no Google/Apple Sign-In SDK wired up yet. Tapping either
// button just says so, rather than silently doing nothing (which would look
// broken rather than "not built yet" during QA).
function notImplemented(provider: string) {
  Alert.alert('Coming soon', `Sign in with ${provider} isn't available yet.`);
}

export function SocialAuthButtons() {
  return (
    <View style={styles.root}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable style={styles.appleBtn} onPress={() => notImplemented('Apple')}>
        <Ionicons name="logo-apple" size={19} color={Colors.white} />
        <Text style={styles.appleBtnText}>Continue with Apple</Text>
      </Pressable>

      <Pressable style={styles.googleBtn} onPress={() => notImplemented('Google')}>
        <Ionicons name="logo-google" size={17} color="#4285F4" />
        <Text style={styles.googleBtnText}>Continue with Google</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: Spacing.lg,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textMuted,
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  appleBtnText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.white,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleBtnText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
