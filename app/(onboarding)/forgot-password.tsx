import { View, Text, StyleSheet } from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BackButton } from '@/components/ui/BackButton';
import { AuthHeader } from '@/components/onboarding/AuthHeader';
import { FormErrorBanner } from '@/components/onboarding/FormErrorBanner';
import { authService } from '@/services/auth.service';
import { Colors, Spacing, Typography } from '@/constants/theme';
import { Routes } from '@/constants/routes';

export default function ForgotPassword() {
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async () => {
    if (!email) { setError('Email is required.'); return; }
    setLoading(true);
    setError('');
    try {
      await authService.forgotPassword(email);
      setSent(true);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <ScreenWrapper backgroundColor={Colors.white}>
        <View style={styles.sentRoot}>
          <View style={styles.sentIcon}>
            <Text style={styles.sentIconText}>✓</Text>
          </View>
          <Text style={styles.sentTitle}>Check your email</Text>
          <Text style={styles.sentSub}>
            We've sent a password reset link to{' '}
            <Text style={styles.sentEmail}>{email}</Text>
          </Text>
          <Button
            label="Back to sign in"
            onPress={() => router.replace(Routes.LOGIN)}
            style={styles.sentBtn}
          />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scroll backgroundColor={Colors.white}>
      <View style={styles.root}>

        <BackButton variant="text" />

        <AuthHeader title="Reset password" subtitle="Enter your email and we'll send you a reset link." />

        <FormErrorBanner message={error} />

        <Input
          label="Email"
          placeholder="you@university.edu"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <Button
          label="Send reset link"
          onPress={handleSubmit}
          loading={loading}
          style={styles.cta}
        />

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
  cta: {
    marginTop: Spacing.sm,
  },

  // Sent state
  sentRoot: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  sentIconText: {
    fontSize: 28,
    color: Colors.success,
    fontWeight: '700',
  },
  sentTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  sentSub: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  sentEmail: {
    color: Colors.primary,
    fontWeight: '600',
  },
  sentBtn: {
    marginTop: Spacing.lg,
    width: '100%',
  },
});