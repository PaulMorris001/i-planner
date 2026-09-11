import { GateCard } from "@/components/ui/GateCard";
import { CONSENT_ROWS } from "@/constants/aiConsent";
import { PRIVACY_URL } from "@/constants/legal";
import { Colors, Spacing } from "@/constants/theme";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

type ConsentKey = (typeof CONSENT_ROWS)[number]["key"];

interface AiDisclosureGateProps {
  consent: Record<ConsentKey, boolean>;
  onToggle: (key: ConsentKey, value: boolean) => void;
  onAgree: () => Promise<boolean>;
}

export function AiDisclosureGate({
  consent,
  onToggle,
  onAgree,
}: AiDisclosureGateProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleAgree = async () => {
    if (submitting) return;
    setSubmitting(true);
    const ok = await onAgree();
    setSubmitting(false);
    if (!ok) {
      Alert.alert("Couldn't save", "Check your connection and try again.");
    }
  };

  return (
    <GateCard
      icon="sparkles"
      title="Before you chat with AI Coach"
      subtitle="Your messages, and any planner data categories you allow below, are sent to OpenAI to generate replies. OpenAI does not use this data to train its models."
    >
      <View style={styles.consentList}>
        {CONSENT_ROWS.map((row) => (
          <View key={row.key} style={styles.consentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentLabel}>{row.label}</Text>
              <Text style={styles.consentDesc}>{row.desc}</Text>
            </View>
            <Switch
              value={consent[row.key]}
              onValueChange={(v) => onToggle(row.key, v)}
              trackColor={{ false: Colors.border, true: Colors.primaryLight }}
              thumbColor={Colors.white}
            />
          </View>
        ))}
      </View>

      <Pressable
        style={styles.agreeBtn}
        onPress={handleAgree}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator size="small" color={Colors.white} />
        ) : (
          <Text style={styles.agreeBtnText}>Agree & Continue</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)}
        hitSlop={8}
      >
        <Text style={styles.privacyLink}>Read our Privacy Policy</Text>
      </Pressable>
    </GateCard>
  );
}

const styles = StyleSheet.create({
  consentList: {
    width: "100%",
    gap: 14,
    marginBottom: Spacing.lg,
  },
  consentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  consentDesc: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  agreeBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.textPrimary,
    borderRadius: 13,
    paddingVertical: 14,
    marginBottom: 12,
  },
  agreeBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: Colors.white,
  },
  privacyLink: {
    fontSize: 13,
    fontWeight: "600",
    color: Colors.textMuted,
    textDecorationLine: "underline",
  },
});
