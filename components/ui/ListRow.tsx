import { View, Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol, type IconSymbolName } from './icon-symbol';
import { Colors } from '@/constants/theme';

type ListRowLeading =
  | { type: 'bar'; color: string }
  | { type: 'icon'; name: IconSymbolName; color: string; background: string };

interface ListRowProps {
  leading: ListRowLeading;
  title: string;
  meta: string;
  onPress?: () => void;
  onLongPress?: () => void;
  // Shows a trailing "⋮" button when provided — the caller owns the
  // ItemActionSheet this typically opens.
  onMenuPress?: () => void;
}

// Shared row: leading accent + title/meta + optional trailing "⋮" menu.
export function ListRow({ leading, title, meta, onPress, onLongPress, onMenuPress }: ListRowProps) {
  return (
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      {leading.type === 'bar' ? (
        <View style={[styles.bar, { backgroundColor: leading.color }]} />
      ) : (
        <View style={[styles.iconBox, { backgroundColor: leading.background }]}>
          <IconSymbol name={leading.name} color={leading.color} size={16} />
        </View>
      )}
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {onMenuPress && (
        <Pressable onPress={onMenuPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconSymbol name="ellipsis" color={Colors.textMuted} size={18} />
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  bar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  meta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
