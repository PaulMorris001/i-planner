import { View, Text, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors } from '@/constants/theme';

interface SectionCardHeaderProps {
  title: string;
  actionLabel: string;
  onActionPress: () => void;
}

// Card title + "+ Add X" pill action — Dashboard's My Classes/My Syllabi/My
// Exams section headers, independently hand-rolled 3 times before this
// extraction.
export function SectionCardHeader({ title, actionLabel, onActionPress }: SectionCardHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      <Pressable style={styles.actionBtn} onPress={onActionPress}>
        <IconSymbol name="plus" color={Colors.primaryLight} size={13} />
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.infoSoft,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
