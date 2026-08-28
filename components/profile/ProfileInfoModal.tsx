import { IconSymbol, type IconSymbolName } from "@/components/ui/icon-symbol";
import { Routes } from "@/constants/routes";
import { Colors, Spacing } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

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

export function ProfileInfoModal({
  visible,
  onClose,
  focusProfile,
}: ProfileInfoModalProps) {
  const router = useRouter();
  const { user } = useAuth();
  const displayName = user?.fullName?.trim() || user?.email || "";
  const initial = displayName.charAt(0).toUpperCase();
  const path = PATH_META[toPathId(focusProfile)];

  // Modal's "fade" animationType covers the overlay; this scale+opacity pair gives the card a
  // soft pop-in. Re-armed on every open since RN Modal unmounts content on close (no exit to drive).
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.9);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable style={styles.overlay} onPress={onClose} />
        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }] }]}
        >
          <Pressable style={styles.closeButton} hitSlop={10} onPress={onClose}>
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

          <Pressable
            style={styles.manageRow}
            onPress={() => {
              onClose();
              router.push(Routes.PROFILE);
            }}
          >
            <Text style={styles.manageText}>Manage in Profile & settings</Text>
            <IconSymbol
              name="chevron.right"
              color={Colors.primaryLight}
              size={18}
            />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(20,18,40,0.4)",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: Colors.offWhite,
    borderRadius: 22,
    padding: Spacing.lg,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  closeButton: {
    position: "absolute",
    top: 14,
    right: 14,
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
  manageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    paddingVertical: 6,
  },
  manageText: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.primaryLight,
  },
});
