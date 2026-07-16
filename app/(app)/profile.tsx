import { useState } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/useAuth';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useSettings } from '@/hooks/useSettings';
import { Colors, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';

type PathId = 'student' | 'exam' | 'professional';

const PATH_OPTIONS: { id: PathId; label: string; desc: string }[] = [
  { id: 'student', label: 'Student', desc: 'Classes, coursework & campus life' },
  { id: 'exam', label: 'Exam Candidate', desc: 'Certification & test prep' },
  { id: 'professional', label: 'Professional', desc: 'Career, projects & goals' },
];

// focus.tsx stores 'exam_candidate'; this screen's PathId uses the shorter 'exam'.
function toPathId(focusProfile: string | null): PathId {
  if (focusProfile === 'student') return 'student';
  if (focusProfile === 'exam_candidate') return 'exam';
  return 'professional';
}

function fromPathId(id: PathId): string {
  return id === 'exam' ? 'exam_candidate' : id;
}

const CONSENT_ROWS = [
  { key: 'tasks', label: 'Tasks & deadlines', desc: 'Lets the AI plan around your to-dos' },
  { key: 'goals', label: 'Goals & milestones', desc: 'Lets the AI connect tasks to your goals' },
  { key: 'calendar', label: 'Calendar events', desc: 'Lets the AI schedule around your day' },
] as const;

export default function Profile() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { focusProfile, setFocusProfile } = useOnboarding();
  const {
    appleCalendarConnected,
    googleCalendarConnected,
    remindersEnabled,
    connectAppleCalendar,
    connectGoogleCalendar,
    disconnectAppleCalendar,
    disconnectGoogleCalendar,
    enableReminders,
    disableReminders,
  } = useSettings();

  const [pathMenuOpen, setPathMenuOpen] = useState(false);
  const [consent, setConsent] = useState<Record<string, boolean>>({
    tasks: true,
    goals: true,
    calendar: true,
  });

  const currentPath = toPathId(focusProfile);
  const displayName = user?.fullName ?? 'Jordan';
  const avatarInitial = user?.fullName?.trim().charAt(0).toUpperCase() ?? 'J';

  const handleLogout = async () => {
    await logout();
    router.replace(Routes.WELCOME);
  };

  const handleConnectApple = async () => {
    const ok = await connectAppleCalendar();
    if (!ok) {
      Alert.alert(
        "Couldn't connect calendar",
        'Calendar permission was denied. You can allow it later from your device settings.'
      );
    }
  };

  const handleConnectGoogle = async () => {
    const ok = await connectGoogleCalendar();
    if (!ok) {
      Alert.alert("Couldn't connect calendar", 'Something went wrong finishing the Google sign-in. Try again.');
    }
  };

  const confirmDisconnect = (calendarName: string, onConfirm: () => void) => {
    Alert.alert(
      `Disconnect ${calendarName}?`,
      "New classes and tasks won't be added to your calendar anymore. Events already created will stay put.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Disconnect', style: 'destructive', onPress: onConfirm },
      ]
    );
  };

  const handleEnableReminders = async () => {
    const ok = await enableReminders();
    if (!ok) {
      Alert.alert(
        "Couldn't enable reminders",
        'Notification permission was denied. You can allow it later from your device settings.'
      );
    }
  };

  const handleDisableReminders = () => {
    Alert.alert(
      'Turn off reminders?',
      'Scheduled reminders for your existing tasks and classes will be cancelled, and new ones won’t get one either.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Turn off', style: 'destructive', onPress: disableReminders },
      ]
    );
  };

  const currentPathLabel = PATH_OPTIONS.find((o) => o.id === currentPath)?.label ?? 'Professional';

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent} edges={['top', 'right', 'left']}>
      <View style={styles.body}>
        <Text style={styles.pageTitle}>Profile & settings</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          <View>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profilePlan}>I-Planner · Free plan</Text>
          </View>
        </View>

        <Text style={styles.eyebrow}>SWITCH PATH</Text>
        <Text style={styles.sectionDesc}>
          Changing your path re-arranges your dashboard — your tasks, goals and habits stay put.
        </Text>

        <View style={{ position: 'relative' }}>
          <Pressable style={styles.pathButton} onPress={() => setPathMenuOpen((v) => !v)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.pathEyebrow}>CURRENT PATH</Text>
              <Text style={styles.pathLabel}>{currentPathLabel}</Text>
            </View>
            <IconSymbol
              name={pathMenuOpen ? 'chevron.up' : 'chevron.down'}
              color={Colors.textSecondary}
              size={20}
            />
          </Pressable>

          {pathMenuOpen && (
            <View style={styles.pathMenu}>
              {PATH_OPTIONS.map((option, i) => {
                const isCurrent = option.id === currentPath;
                return (
                  <Pressable
                    key={option.id}
                    style={[
                      styles.pathOption,
                      isCurrent && styles.pathOptionActive,
                      i < PATH_OPTIONS.length - 1 && styles.pathOptionBorder,
                    ]}
                    onPress={async () => {
                      await setFocusProfile(fromPathId(option.id));
                      setPathMenuOpen(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pathOptionLabel}>{option.label}</Text>
                      <Text style={styles.pathOptionDesc}>{option.desc}</Text>
                    </View>
                    {isCurrent && (
                      <View style={styles.pathCheck}>
                        <IconSymbol name="checkmark" color={Colors.white} size={13} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Pressable style={styles.plansCard}>
          <View style={styles.plansIconBox}>
            <IconSymbol name="star.fill" color={Colors.white} size={20} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.plansTitle}>Plans & pricing</Text>
            <Text style={styles.plansSub}>Compare tiers & upgrade</Text>
          </View>
          <IconSymbol name="chevron.right" color={Colors.primaryLight} size={20} />
        </Pressable>

        <Text style={[styles.eyebrow, { marginTop: Spacing.lg }]}>CALENDAR SYNC</Text>
        <Text style={styles.sectionDesc}>
          Classes and tasks with a due date get written to whichever calendars you connect here.
        </Text>

        <View style={styles.consentList}>
          <View style={styles.calendarRow}>
            <View style={styles.calendarIconBox}>
              <IconSymbol name="calendar" color={Colors.textPrimary} size={17} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentLabel}>Apple Calendar</Text>
              <Text style={styles.consentDesc}>{appleCalendarConnected ? 'Connected' : 'Not connected'}</Text>
            </View>
            <Pressable
              style={[styles.calendarActionBtn, appleCalendarConnected && styles.calendarActionBtnDanger]}
              onPress={() =>
                appleCalendarConnected
                  ? confirmDisconnect('Apple Calendar', disconnectAppleCalendar)
                  : handleConnectApple()
              }
            >
              <Text style={[styles.calendarActionText, appleCalendarConnected && styles.calendarActionTextDanger]}>
                {appleCalendarConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.calendarRow}>
            <View style={styles.calendarIconBox}>
              <Text style={styles.googleG}>G</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentLabel}>Google Calendar</Text>
              <Text style={styles.consentDesc}>{googleCalendarConnected ? 'Connected' : 'Not connected'}</Text>
            </View>
            <Pressable
              style={[styles.calendarActionBtn, googleCalendarConnected && styles.calendarActionBtnDanger]}
              onPress={() =>
                googleCalendarConnected
                  ? confirmDisconnect('Google Calendar', disconnectGoogleCalendar)
                  : handleConnectGoogle()
              }
            >
              <Text style={[styles.calendarActionText, googleCalendarConnected && styles.calendarActionTextDanger]}>
                {googleCalendarConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.eyebrow, { marginTop: Spacing.lg }]}>REMINDERS</Text>
        <Text style={styles.sectionDesc}>
          Get notified 15 minutes before and exactly when a task or class with a due/start date and
          time is due — labeled so you know which is which.
        </Text>

        <View style={styles.consentList}>
          <View style={styles.calendarRow}>
            <View style={styles.calendarIconBox}>
              <IconSymbol name="bell.fill" color={Colors.textPrimary} size={17} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.consentLabel}>Task & class reminders</Text>
              <Text style={styles.consentDesc}>{remindersEnabled ? 'Enabled' : 'Off'}</Text>
            </View>
            <Pressable
              style={[styles.calendarActionBtn, remindersEnabled && styles.calendarActionBtnDanger]}
              onPress={() => (remindersEnabled ? handleDisableReminders() : handleEnableReminders())}
            >
              <Text style={[styles.calendarActionText, remindersEnabled && styles.calendarActionTextDanger]}>
                {remindersEnabled ? 'Turn off' : 'Enable'}
              </Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.eyebrow, { marginTop: Spacing.lg }]}>AI DATA ACCESS</Text>
        <Text style={styles.sectionDesc}>
          Control what the AI Coach can use. Revoke any category at any time.
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
                onValueChange={(v) => setConsent((c) => ({ ...c, [row.key]: v }))}
                trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                thumbColor={Colors.white}
              />
            </View>
          ))}
        </View>

        <Text style={[styles.eyebrow, { marginTop: Spacing.lg }]}>LEGAL</Text>
        <View style={styles.legalCard}>
          <Pressable style={[styles.legalRow, styles.legalRowBorder]}>
            <Text style={styles.legalLabel}>Terms of Service</Text>
            <IconSymbol name="chevron.right" color={Colors.textMuted} size={18} />
          </Pressable>
          <Pressable style={styles.legalRow}>
            <Text style={styles.legalLabel}>Privacy Policy</Text>
            <IconSymbol name="chevron.right" color={Colors.textMuted} size={18} />
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          I-Planner is a planning tool, not a licensed financial, legal, or career advisor. AI
          suggestions are informational only — verify important decisions independently.
        </Text>

        <Button label="Log out" onPress={handleLogout} variant="secondary" style={styles.logoutButton} />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  body: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 17,
    padding: 16,
    marginTop: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  profilePlan: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 1,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    marginBottom: 11,
  },
  pathButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 14,
    paddingHorizontal: 16,
  },
  pathEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  pathLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  pathMenu: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  pathOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  pathOptionActive: {
    backgroundColor: Colors.infoSoft,
  },
  pathOptionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pathOptionLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  pathOptionDesc: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 1,
    lineHeight: 17,
  },
  pathCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: Colors.infoSoft,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderRadius: 16,
    padding: 15,
    marginTop: 11,
  },
  plansIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plansTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  plansSub: {
    fontSize: 12.5,
    color: Colors.primaryLight,
    marginTop: 1,
  },
  consentList: {
    gap: 9,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 14,
    paddingHorizontal: 16,
  },
  consentLabel: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  consentDesc: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 1,
    lineHeight: 17,
  },
  calendarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 14,
    paddingHorizontal: 16,
  },
  calendarIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 15,
    fontWeight: '800',
    color: '#4285F4',
  },
  calendarActionBtn: {
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  calendarActionText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  calendarActionBtnDanger: {
    borderColor: Colors.border,
    backgroundColor: Colors.offWhite,
  },
  calendarActionTextDanger: {
    color: Colors.textMuted,
  },
  legalCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    overflow: 'hidden',
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    paddingHorizontal: 16,
  },
  legalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legalLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  disclaimer: {
    fontSize: 11.5,
    color: Colors.textMuted,
    lineHeight: 17,
    marginTop: 12,
  },
  logoutButton: {
    marginTop: Spacing.lg,
  },
});
