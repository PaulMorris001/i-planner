import { Pressable, Text, StyleSheet } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';

interface ViewMoreToggleProps {
  expanded: boolean;
  onPress: () => void;
  // Items still hidden while collapsed — nothing renders when this is 0 and
  // the list isn't already expanded (nothing to expand into).
  hiddenCount: number;
}

// Local expand/collapse for a list capped to a preview count — distinct from
// ViewAllRow, which navigates to a different screen instead of expanding in place.
export function ViewMoreToggle({ expanded, onPress, hiddenCount }: ViewMoreToggleProps) {
  if (!expanded && hiddenCount <= 0) return null;
  return (
    <Pressable style={styles.row} onPress={onPress} hitSlop={{ top: 6, bottom: 6 }}>
      <Text style={styles.text}>{expanded ? 'View less' : `View ${hiddenCount} more`}</Text>
      <IconSymbol name={expanded ? 'chevron.up' : 'chevron.down'} color={Colors.textSecondary} size={14} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  text: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});
