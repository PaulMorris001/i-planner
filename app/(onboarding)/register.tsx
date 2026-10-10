import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { AuthHeader } from "@/components/onboarding/AuthHeader";
import { FormErrorBanner } from "@/components/onboarding/FormErrorBanner";
import { SocialAuthButtons } from "@/components/onboarding/SocialAuthButtons";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PRIVACY_URL, TERMS_URL } from "@/constants/legal";
import { Routes } from "@/constants/routes";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { referralService } from "@/services/referral.service";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Register() {
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  // Stays true from the tap (code check, then account creation) until the next screen takes
  // over; cleared only on failure, so the button never flips back to idle mid-way.
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    referralCode?: string;
    general?: string;
  }>({});

  const validate = () => {
    const nextErrors: typeof errors = {};
    if (!fullName) nextErrors.fullName = "Full name is required.";
    if (!email) nextErrors.email = "Email is required.";
    if (!password) nextErrors.password = "Password is required.";
    else if (password.length < 8)
      nextErrors.password = "Password must be at least 8 characters.";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setErrors({});
    setSubmitting(true);
    const code = referralCode.trim();
    if (code) {
      // Checked BEFORE creating the account, so a typo can be fixed instead of the
      // code being silently dropped (it cannot be added after sign-up).
      try {
        const { valid } = await referralService.validate(code);
        if (!valid) {
          setErrors({ referralCode: "That referral code doesn't exist. Check it, or leave it blank." });
          setSubmitting(false);
          return;
        }
      } catch {
        // Could not check (no signal, busy). Do not block sign-up on it: the code is
        // kept and applied once the account exists.
      }
    }
    try {
      await register({ fullName, email, password, referralCode: code || undefined });
      router.replace(Routes.NOTIFICATIONS_PROMPT);
    } catch (e: any) {
      setErrors({ general: e.message });
      setSubmitting(false);
    }
  };

  return (
    <ScreenWrapper scroll backgroundColor={Colors.white}>
      <View style={styles.root}>
        <BackButton variant="text" />

        <AuthHeader
          title="Create your account"
          subtitle="Start planning in under two minutes."
        >
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logoMark}
            resizeMode="contain"
          />
        </AuthHeader>

        <FormErrorBanner message={errors.general} />

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Full name"
            placeholder="Alex Jackson"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoComplete="name"
            error={errors.fullName}
          />

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
            placeholder="Min. 8 characters"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            error={errors.password}
          />

          <Input
            label="Referral code (optional)"
            placeholder="Have a code from a friend?"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            error={errors.referralCode}
          />

          <Button
            label="Create account"
            onPress={handleRegister}
            loading={submitting}
            style={styles.cta}
          />

          <SocialAuthButtons referralCode={referralCode} />
        </View>

        {/* Legal */}
        <Text style={styles.legal}>
          By continuing, you agree to I-planner's{" "}
          <Text
            style={styles.legalLink}
            onPress={() => WebBrowser.openBrowserAsync(TERMS_URL)}
          >
            Terms of Service
          </Text>{" "}
          and{" "}
          <Text
            style={styles.legalLink}
            onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
          >
            Privacy Policy
          </Text>
          .
        </Text>

        {/* Footer */}
        <TouchableOpacity
          style={styles.footer}
          onPress={() => router.replace(Routes.LOGIN)}
          activeOpacity={0.7}
        >
          <Text style={styles.footerText}>
            Already have an account? <Text style={styles.footerLink}>Sign in</Text>
          </Text>
        </TouchableOpacity>
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
  cta: {
    marginTop: Spacing.sm,
  },
  legal: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
  legalLink: {
    color: Colors.primaryLight,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  footerText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  footerLink: {
    ...Typography.body,
    fontWeight: "600",
    color: Colors.primary,
  },
  logoMark: {
    width: 52,
    height: 52,
    marginBottom: Spacing.lg,
  },
});
