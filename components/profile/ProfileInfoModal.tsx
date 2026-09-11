import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Routes, type AppRoute } from "@/constants/routes";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ProfileInfoModalProps {
  visible: boolean;
  onClose: () => void;
  focusProfile: string | null;
}

type PathId = "student" | "exam" | "professional";

// focus.tsx stores 'exam_candidate'; kept short here to match profile.tsx's own PathId convention.
function toPathId(focusProfile: string | null): PathId {
  if (focusProfile === "student") return "student";
  if (focusProfile === "exam_candidate") return "exam";
  return "professional";
}

// Same three paths/icons as focus.tsx's onboarding picker, so "your current path" matches.
const PATH_META: Record<
  PathId,
  {
    label: string;
    desc: string;
    icon: IconSymbolName;
    color: string;
    soft: string;
  }
> = {
  student: {
    label: "Student",
    desc: "Coursework, exams, internships & academic goals",
    icon: "book.fill",
    color: Colors.primary,
    soft: "#DAE9FC",
  },
  exam: {
    label: "Exam candidate",
    desc: "Preparing for tests with clear revision plans",
    icon: "pencil",
    color: "#92400E",
    soft: "#FEF3C7",
  },
  professional: {
    label: "Professional",
    desc: "Projects, certifications & career growth",
    icon: "briefcase.fill",
    color: "#065F46",
    soft: "#DCFCE7",
  },
};

const DRAWER_WIDTH_PCT = 0.82;
const DRAWER_MAX_WIDTH = 340;
const ANIM_MS = 260;

// A right-side sliding tab, not a centered pop-up — tapping the avatar now
// pulls in a drawer from the screen's right edge instead. Modal's own
// "slide"/"fade" animationType only moves vertically or fades, so the slide
// is driven manually (translateX + overlay opacity), same approach the old
// centered-card version already used for its scale/opacity pop-in.
export function ProfileInfoModal({
  visible,
  onClose,
  focusProfile,
}: ProfileInfoModalProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const drawerWidth = Math.min(windowWidth * DRAWER_WIDTH_PCT, DRAWER_MAX_WIDTH);

  const displayName = user?.fullName?.trim() || user?.email || "";
  const initial = displayName.charAt(0).toUpperCase();
  const path = PATH_META[toPathId(focusProfile)];

  const translateX = useRef(new Animated.Value(drawerWidth)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(drawerWidth);
    overlayOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: 0,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: ANIM_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, drawerWidth, translateX, overlayOpacity]);

  // Modal unmounts its content the instant `visible` flips false, which would
  // otherwise cut the slide-out short — every dismissal path (overlay tap, X
  // button, a nav action below) animates the drawer back off-screen first and
  // only calls the real onClose once that finishes.
  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: drawerWidth,
        duration: ANIM_MS - 60,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: ANIM_MS - 60,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [drawerWidth, translateX, overlayOpacity, onClose]);

  const goTo = useCallback(
    (route: AppRoute) => {
      Animated.parallel([
        Animated.timing(translateX, {
          toValue: drawerWidth,
          duration: ANIM_MS - 60,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: ANIM_MS - 60,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        onClose();
        router.push(route);
      });
    },
    [drawerWidth, translateX, overlayOpacity, onClose, router]
  );

  // Same "confirm, then log out" copy/pattern as profile.tsx's own logout —
  // kept in sync deliberately, since this drawer is now a second entry point
  // to the same action.
  const handleLogout = useCallback(() => {
    Alert.alert(
      "Log out?",
      "You'll need to sign back in to access your planner.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: () => {
            Animated.parallel([
              Animated.timing(translateX, {
                toValue: drawerWidth,
                duration: ANIM_MS - 60,
                useNativeDriver: true,
              }),
              Animated.timing(overlayOpacity, {
                toValue: 0,
                duration: ANIM_MS - 60,
                useNativeDriver: true,
              }),
            ]).start(({ finished }) => {
              if (!finished) return;
              onClose();
              logout().then(() => router.replace(Routes.WELCOME));
            });
          },
        },
      ]
    );
  }, [drawerWidth, translateX, overlayOpacity, onClose, logout, router]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.drawer,
            {
              width: drawerWidth,
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Pinned outside the ScrollView (not just above its content) — an
              absolutely-positioned child inside a ScrollView is measured from
              the top of the scrollable content itself, ignoring the
              contentContainer's paddingTop entirely, which is what let this
              sit under the status bar/Dynamic Island in the first place. Being
              a sibling of the ScrollView also means it never scrolls away. */}
          <Pressable
            style={[styles.closeButton, { top: insets.top + Spacing.sm }]}
            hitSlop={10}
            onPress={handleClose}
          >
            <IconSymbol name="xmark" color={Colors.textMuted} size={18} />
          </Pressable>

          {/* flex: 1 (not just the content padding below) — otherwise the
              ScrollView shrinks to fit its own content and the footer row
              ends up sitting right after it instead of pinned to the actual
              bottom of the drawer on a short content list. */}
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[
              styles.drawerContent,
              { paddingTop: insets.top + Spacing.lg, paddingBottom: Spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{displayName}</Text>
                {!!user?.email && (
                  <Text style={styles.email} numberOfLines={1}>
                    {user.email}
                  </Text>
                )}
              </View>
            </View>

            <Text style={styles.eyebrow}>CURRENT PATH</Text>
            <View style={styles.pathCard}>
              <View style={[styles.pathIconBox, { backgroundColor: path.soft }]}>
                <IconSymbol name={path.icon} color={path.color} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pathLabel}>{path.label}</Text>
                <Text style={styles.pathDesc}>{path.desc}</Text>
              </View>
            </View>

            <View style={styles.actionsGroup}>
              <Pressable style={styles.manageRow} onPress={() => goTo(Routes.GOALS)}>
                <View style={styles.manageLabelRow}>
                  <IconSymbol name="target" color={Colors.primaryLight} size={18} />
                  <Text style={styles.manageText}>Goals</Text>
                </View>
                <IconSymbol
                  name="chevron.right"
                  color={Colors.primaryLight}
                  size={18}
                />
              </Pressable>
              <Pressable style={styles.manageRow} onPress={() => goTo(Routes.NOTES)}>
                <View style={styles.manageLabelRow}>
                  <IconSymbol name="note.text" color={Colors.primaryLight} size={18} />
                  <Text style={styles.manageText}>Notes</Text>
                </View>
                <IconSymbol
                  name="chevron.right"
                  color={Colors.primaryLight}
                  size={18}
                />
              </Pressable>
            </View>
          </ScrollView>

          {/* Pinned to the bottom of the drawer, outside the ScrollView, so it
              always stays put as a footer action instead of scrolling away
              with the rest of the content. */}
          <Pressable style={styles.footerRow} onPress={() => goTo(Routes.PROFILE)}>
            <View style={styles.manageLabelRow}>
              <IconSymbol name="person.fill" color={Colors.primaryLight} size={18} />
              <Text style={styles.manageText}>Profile & Settings</Text>
            </View>
            <IconSymbol
              name="chevron.right"
              color={Colors.primaryLight}
              size={18}
            />
          </Pressable>

          <Pressable
            style={[styles.footerRow, { paddingBottom: insets.bottom + Spacing.md }]}
            onPress={handleLogout}
          >
            <View style={styles.manageLabelRow}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" color={Colors.error} size={18} />
              <Text style={styles.logoutText}>Log out</Text>
            </View>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,18,40,0.4)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.offWhite,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 16,
  },
  scroll: {
    flex: 1,
  },
  drawerContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  closeButton: {
    // top is set inline (insets.top + Spacing.sm) — no static default here,
    // since the safe-area inset isn't known until render.
    position: "absolute",
    right: Spacing.lg,
    zIndex: 1,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 6,
    paddingRight: 24,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: Colors.success,
  },
  name: {
    fontSize: 17.5,
    fontWeight: "800",
    color: Colors.textPrimary,
  },
  email: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  eyebrow: {
    fontSize: 11.5,
    fontWeight: "700",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: 8,
  },
  pathCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    padding: 14,
  },
  pathIconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pathLabel: {
    fontSize: 14.5,
    fontWeight: "700",
    color: Colors.textPrimary,
  },
  pathDesc: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 1,
    lineHeight: 17,
  },
  actionsGroup: {
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  // paddingVertical (not just paddingTop) — the Profile & Settings row is
  // followed immediately by another footerRow (Log out); without a bottom
  // value here too, its content had nothing under it before the next row's
  // divider line, reading as cramped/overlapping rather than two separate
  // rows. The second row's own inline paddingBottom (insets.bottom +
  // Spacing.md, for the home indicator) still overrides this one's bottom
  // half — style arrays merge left-to-right, so a later explicit
  // paddingBottom wins over paddingVertical's without touching its paddingTop.
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  manageLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  manageText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.error,
  },
});
