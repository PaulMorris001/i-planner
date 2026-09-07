import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Routes, type AppRoute } from "@/constants/routes";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import {
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
  const { user } = useAuth();
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
          <ScrollView
            contentContainerStyle={[
              styles.drawerContent,
              { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Pressable style={styles.closeButton} hitSlop={10} onPress={handleClose}>
              <IconSymbol name="xmark" color={Colors.textMuted} size={18} />
            </Pressable>

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

              <Pressable style={styles.manageRow} onPress={() => goTo(Routes.PROFILE)}>
                <Text style={styles.manageText}>Manage in Profile & settings</Text>
                <IconSymbol
                  name="chevron.right"
                  color={Colors.primaryLight}
                  size={18}
                />
              </Pressable>
            </View>
          </ScrollView>
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
  drawerContent: {
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: Spacing.lg,
    zIndex: 1,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 6,
    paddingRight: 24,
    paddingTop: 28,
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
});
