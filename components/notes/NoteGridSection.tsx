import { View, Text, StyleSheet } from 'react-native';
import { GridTile } from './GridTile';
import { useGridTileWidth } from './gridLayout';
import { Colors } from '@/constants/theme';
import type { Note } from '@/types/note.types';

interface NoteGridSectionProps {
  notes: Note[];
  onOpenNote: (id: string) => void;
  onShowActions: (note: Note) => void;
  emptyText: string;
}

// Same prop shape as NoteListSection, so app/notes.tsx and app/notes-folder.tsx
// can swap between the two based on the user's list/grid preference without
// changing anything else about how each screen filters/wires its notes.
export function NoteGridSection({ notes, onOpenNote, onShowActions, emptyText }: NoteGridSectionProps) {
  const { tileWidth, gap } = useGridTileWidth();

  if (notes.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={[styles.grid, { columnGap: gap, rowGap: gap + 10 }]}>
      {notes.map((note) => (
        <GridTile
          key={note.id}
          label={note.title}
          iconName="doc.fill"
          width={tileWidth}
          onPress={() => onOpenNote(note.id)}
          onLongPress={() => onShowActions(note)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});
