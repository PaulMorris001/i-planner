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

// Icon badge sized relative to the tile's own width rather than a fixed
// pixel value — with only 2 columns now, tiles are wide enough that a small
// fixed icon would look lost in all the extra space; scaling with `width`
// keeps the badge looking "big," matching the tile, on any screen size.
const ICON_BOX_RATIO = 0.62;
const ICON_RATIO = 0.42; // of the icon box, not of the tile

// One grid cell — icon badge, name below — shared by note tiles (a file icon)
// and folder tiles (a folder icon) so both look consistent, even though they
// come from two different screens/data sources.
export function GridTile({ label, iconName, width, onPress, onLongPress }: GridTileProps) {
  const iconBoxSize = Math.round(width * ICON_BOX_RATIO);
  const iconSize = Math.round(iconBoxSize * ICON_RATIO);

  return (
    <Pressable style={[styles.tile, { width }]} onPress={onPress} onLongPress={onLongPress}>
      <View
        style={[
          styles.iconBox,
          { width: iconBoxSize, height: iconBoxSize, borderRadius: iconBoxSize * 0.22 },
        ]}
      >
        <IconSymbol name={iconName} color={Colors.primaryLight} size={iconSize} />
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
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: 10,
    fontSize: 14.5,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
