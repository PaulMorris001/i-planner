import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { AuthHeader } from "@/components/onboarding/AuthHeader";
import { FormErrorBanner } from "@/components/onboarding/FormErrorBanner";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PRIVACY_URL, TERMS_URL } from "@/constants/legal";
import { Routes } from "@/constants/routes";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function Register() {
  const { register, loading } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
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
    try {
      await register({ fullName, email, password });
      router.replace(Routes.FOCUS);
    } catch (e: any) {
      setErrors({ general: e.message });
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
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>i</Text>
          </View>
        </AuthHeader>

        <FormErrorBanner message={errors.general} />

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Full name"
            placeholder="Ada Okafor"
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

          <Button
            label="Create account"
            onPress={handleRegister}
            loading={loading}
            style={styles.cta}
          />
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
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.replace(Routes.LOGIN)}>
            <Text style={styles.footerLink}>Sign in</Text>
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
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.accent,
    lineHeight: 34,
  },
});
