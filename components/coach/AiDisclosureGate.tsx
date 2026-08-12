import { View, Text, Pressable, Switch, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { CONSENT_ROWS } from '@/constants/aiConsent';
import { PRIVACY_URL } from '@/constants/legal';

type ConsentKey = (typeof CONSENT_ROWS)[number]['key'];

interface AiDisclosureGateProps {
  consent: Record<ConsentKey, boolean>;
  onToggle: (key: ConsentKey, value: boolean) => void;
  onAgree: () => void;
}

// Shown once, before the very first message ever reaches app/(app)/coach.tsx's
// send flow — required by App Store guideline 5.1.2(i): personal data can only
// go to a third-party AI service after the app names who it's sent to and gets
// permission first, not just offer a way to revoke it afterward. Gated by
// Settings.aiDisclosureAcknowledged (see contexts/SettingsContext.tsx), which
// coach.controller.ts also checks server-side so this can't be bypassed by
// calling the API directly.
export function AiDisclosureGate({ consent, onToggle, onAgree }: AiDisclosureGateProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <IconSymbol name="sparkles" color={Colors.primaryLight} size={26} />
        </View>

        <Text style={styles.title}>Before you chat with AI Coach</Text>
        <Text style={styles.subtitle}>
          Your messages, and any planner data categories you allow below, are sent to OpenAI
          to generate replies. OpenAI does not use this data to train its models.
        </Text>

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

        <Pressable style={styles.agreeBtn} onPress={onAgree}>
          <Text style={styles.agreeBtnText}>Agree & Continue</Text>
        </Pressable>

        <Pressable onPress={() => WebBrowser.openBrowserAsync(PRIVACY_URL)} hitSlop={8}>
          <Text style={styles.privacyLink}>Read our Privacy Policy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 7,
    marginBottom: Spacing.lg,
  },
  consentList: {
    width: '100%',
    gap: 14,
    marginBottom: Spacing.lg,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  consentDesc: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  agreeBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: 13,
    paddingVertical: 14,
    marginBottom: 12,
  },
  agreeBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.white,
  },
  privacyLink: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
