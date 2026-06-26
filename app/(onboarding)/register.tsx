import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { ScreenWrapper } from "@/components/layout/ScreenWrapper";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, Radius } from "@/constants/theme";
import { Routes } from "@/constants/routes";

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
    const e: typeof errors = {};
    if (!fullName) e.fullName = "Full name is required.";
    if (!email) e.email = "Email is required.";
    if (!password) e.password = "Password is required.";
    else if (password.length < 8)
      e.password = "Password must be at least 8 characters.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
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
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>i</Text>
          </View>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Start planning in under two minutes.
          </Text>
        </View>

        {/* General error */}
        {errors.general && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxText}>{errors.general}</Text>
          </View>
        )}

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
          By continuing, you agree to{" I-planner's"}{" "}
          <Text style={styles.legalLink}>Terms of Service</Text> and{" "}
          <Text style={styles.legalLink}>Privacy Policy</Text>.
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
  back: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    alignSelf: "flex-start",
  },
  backText: {
    ...Typography.body,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  header: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.h1,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  errorBox: {
    backgroundColor: Colors.errorBg,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorBoxText: {
    ...Typography.caption,
    color: Colors.error,
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
