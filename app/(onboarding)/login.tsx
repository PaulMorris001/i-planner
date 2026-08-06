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
import { Colors, Spacing, Typography } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { getAuthDebugLog } from '@/utils/authDebugLog';

export default function Login() {
  const { login, loading } = useAuth();
  const { completeOnboarding } = useOnboarding();

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
      await completeOnboarding();
      router.replace(Routes.DASHBOARD);
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

        {/* TEMPORARY — diagnosing the "must log in after every app restart"
            bug (Aug 2026). Shows the session-restore timeline for THIS
            launch, since there's no device console access. Delete this
            block, the import above, and utils/authDebugLog.ts's call sites
            once that bug is confirmed fixed. */}
        <View style={styles.debugBox}>
          <Text style={styles.debugTitle}>Session-restore debug log</Text>
          {getAuthDebugLog().map((line, i) => (
            <Text key={i} style={styles.debugLine}>{line}</Text>
          ))}
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
  debugBox: {
    marginTop: Spacing.xl,
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  debugTitle: {
    color: '#ffb84a',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  debugLine: {
    color: '#9a9ab0',
    fontSize: 10,
    fontFamily: 'Courier',
  },
});