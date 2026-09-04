import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BackButton } from '@/components/ui/BackButton';
import { AuthHeader } from '@/components/onboarding/AuthHeader';
import { FormErrorBanner } from '@/components/onboarding/FormErrorBanner';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { settingsService } from '@/services/settings.service';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { Routes } from '@/constants/routes';

export default function Login() {
  const { login, loading } = useAuth();
  const { completeOnboarding, setFocusProfile } = useOnboarding();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]     = useState<{ email?: string; password?: string; general?: string }>({});

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!email)    nextErrors.email    = 'Email is required.';
    if (!password) nextErrors.password = 'Password is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    try {
      await login({ email, password });
      // The Login screen is only ever reached with no local onboarding state
      // (a fresh install, reinstall, or new device) — focusProfile lives in
      // AsyncStorage, so without this check a returning user would silently
      // default to "professional" and never see Focus again. Restore it from
      // Settings if this account already chose one; otherwise this really is
      // a first-time-here device, so send them through Focus like Register does.
      const settings = await settingsService.get();
      if (settings.focusProfile) {
        await setFocusProfile(settings.focusProfile);
        await completeOnboarding();
        router.replace(Routes.DASHBOARD);
      } else {
        router.replace(Routes.FOCUS);
      }
    } catch (e: any) {
      setErrors({ general: e.message });
    }
  };

  return (
    <ScreenWrapper scroll backgroundColor={Colors.white}>
      <View style={styles.root}>

        <BackButton variant="text" />

        <AuthHeader title="Welcome back" subtitle="Sign in to continue planning" />

        <FormErrorBanner message={errors.general} />

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="you@university.edu"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />

          <Input
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            error={errors.password}
          />

          <TouchableOpacity
            style={styles.forgot}
            onPress={() => router.push(Routes.FORGOT_PASSWORD)}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>

          <Button
            label="Sign in"
            onPress={handleLogin}
            loading={loading}
            style={styles.cta}
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.replace(Routes.REGISTER)}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
        </View>

      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  form: {
    gap: 4,
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: Spacing.md,
  },
  forgotText: {
    ...Typography.caption,
    color: Colors.primaryLight,
    fontWeight: '500',
  },
  cta: {
    marginTop: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xxl,
  },
  footerText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  footerLink: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.primary,
  },
});