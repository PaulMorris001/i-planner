import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Colors } from "@/constants/theme";

interface CountBadgeProps {
  count: number;
  // Placement over the icon it belongs to (absolute top/right offsets).
  style?: StyleProp<ViewStyle>;
}

// The small red number that sits on a corner of an icon. Nothing is drawn for 0, and anything over
// 9 reads "9+" so it never outgrows the icon.
export function CountBadge({ count, style }: CountBadgeProps) {
  if (count <= 0) return null;
  const label = count > 9 ? "9+" : String(count);
  return (
    <View style={[styles.badge, style]} pointerEvents="none" accessibilityLabel={`${count} unread`}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: Colors.white, fontSize: 10, fontWeight: "800", lineHeight: 12 },
});
