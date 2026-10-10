import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, Radius, Spacing, Typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { usePostSignInRoute } from '@/hooks/usePostSignInRoute';
import type { SocialProvider } from '@/services/socialAuth.service';

interface SocialAuthButtonsProps {
  // Sign-up screen only: a friend's code typed in the form, applied if this creates an account.
  referralCode?: string;
}

// "Continue with Apple / Google". The button of the provider in use keeps its spinner from the tap
// until the next screen takes over (cleared only on failure or cancel), so there is no moment of
// pause in between. Sign-in screen and sign-up screen both use this: signing in with a provider
// that has no account yet simply creates one.
export function SocialAuthButtons({ referralCode }: SocialAuthButtonsProps) {
  const { socialSignIn } = useAuth();
  const { routeNewUser, routeReturningUser } = usePostSignInRoute();
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  // Apple sign-in exists on iPhones and iPads only.
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  const handlePress = async (provider: SocialProvider) => {
    if (busy) return;
    setBusy(provider);
    try {
      const result = await socialSignIn(provider, { referralCode });
      if (!result) {
        // They closed the sheet.
        setBusy(null);
        return;
      }
      if (result.isNewUser) routeNewUser();
      else await routeReturningUser();
    } catch (e) {
      Alert.alert("Couldn't sign in", (e as { message?: string })?.message ?? 'Please try again.');
      setBusy(null);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {appleAvailable && (
        <Pressable style={[styles.appleBtn, !!busy && styles.disabled]} onPress={() => handlePress('apple')} disabled={!!busy}>
          {busy === 'apple' ? (
            <ActivityIndicator color={Colors.white} size="small" />
          ) : (
            <>
              <Ionicons name="logo-apple" size={19} color={Colors.white} />
              <Text style={styles.appleBtnText}>Continue with Apple</Text>
            </>
          )}
        </Pressable>
      )}

      <Pressable style={[styles.googleBtn, !!busy && styles.disabled]} onPress={() => handlePress('google')} disabled={!!busy}>
        {busy === 'google' ? (
          <ActivityIndicator color={Colors.primaryLight} size="small" />
        ) : (
          <>
            <Ionicons name="logo-google" size={17} color="#4285F4" />
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </>
        )}
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
  disabled: {
    opacity: 0.7,
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
