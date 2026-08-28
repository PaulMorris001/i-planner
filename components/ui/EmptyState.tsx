import { View, Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol, type IconSymbolName } from './icon-symbol';
import { Colors } from '@/constants/theme';

interface EmptyStateProps {
  icon: IconSymbolName;
  title: string;
  subtitle: string;
  onPress: () => void;
}

// Dashed icon box + title/subtitle, tappable — Dashboard's "nothing here yet" prompt.
export function EmptyState({ icon, title, subtitle, onPress }: EmptyStateProps) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.iconBox}>
        <IconSymbol name={icon} color={Colors.textMuted} size={19} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 13,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12.5,
    color: Colors.textMuted,
    marginTop: 1,
    lineHeight: 17,
  },
});
