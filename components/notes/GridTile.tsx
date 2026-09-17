import { View, Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

interface GridTileProps {
  label: string;
  iconName: IconSymbolName;
  // Pixel width, computed by the grid section from the actual screen width —
  // not a percentage. Percentage widths alongside a numeric gap can overflow
  // a wrapping flex row by the gap's width (support for gap eating into
  // percentage sizing varies by RN/Yoga version), so the section does the
  // arithmetic itself once instead of leaving it to flexbox to approximate.
  width: number;
  onPress: () => void;
  onLongPress?: () => void;
}

// One grid cell — icon badge, name below — shared by note tiles (a file icon)
// and folder tiles (a folder icon) so both look consistent, even though they
// come from two different screens/data sources.
export function GridTile({ label, iconName, width, onPress, onLongPress }: GridTileProps) {
  return (
    <Pressable style={[styles.tile, { width }]} onPress={onPress} onLongPress={onLongPress}>
      <View style={styles.iconBox}>
        <IconSymbol name={iconName} color={Colors.primaryLight} size={26} />
      </View>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
  },
});
