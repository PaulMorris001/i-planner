import { View, Pressable, StyleSheet } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { Colors } from '@/constants/theme';
import type { NotesViewMode } from '@/hooks/useNotesViewMode';

interface ViewModeToggleProps {
  value: NotesViewMode;
  onChange: (mode: NotesViewMode) => void;
}

// Two-way icon switch — list/grid — used by the Notes screens. Kept generic
// enough (just a value/onChange pair) that it isn't tied to Notes specifically,
// but nothing else in the app needs it yet.
export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <View style={styles.track}>
      <Pressable
        style={[styles.option, value === 'list' && styles.optionActive]}
        onPress={() => onChange('list')}
        hitSlop={6}
      >
        <IconSymbol name="list.bullet" color={value === 'list' ? Colors.primaryLight : Colors.textMuted} size={16} />
      </Pressable>
      <Pressable
        style={[styles.option, value === 'grid' && styles.optionActive]}
        onPress={() => onChange('grid')}
        hitSlop={6}
      >
        <IconSymbol
          name="square.grid.2x2"
          color={value === 'grid' ? Colors.primaryLight : Colors.textMuted}
          size={16}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
  },
  option: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionActive: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
