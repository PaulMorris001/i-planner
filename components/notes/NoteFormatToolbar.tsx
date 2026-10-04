import { Pressable, StyleSheet, View } from 'react-native';
import { useBridgeState, type BridgeState, type EditorBridge } from '@10play/tentap-editor';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AlignEditorInstance, AlignEditorState, TextAlignValue } from '@/utils/richText/alignBridge';

// Soft yellow, readable behind dark text. Stored in the note as the mark's color.
const HIGHLIGHT_COLOR = '#FFEB7A';

// The alignment bridge's methods/state (utils/richText/alignBridge.ts) are
// added to the editor at runtime, so they are typed here rather than merged
// into the library's own types.
type NoteEditor = EditorBridge & AlignEditorInstance;
type NoteEditorState = BridgeState & Partial<AlignEditorState>;

const NEXT_ALIGN: Record<TextAlignValue, TextAlignValue> = { left: 'center', center: 'right', right: 'left' };
const ALIGN_ICON: Record<TextAlignValue, IconSymbolName> = {
  left: 'text.alignleft',
  center: 'text.aligncenter',
  right: 'text.alignright',
};

interface ToolButtonProps {
  icon: IconSymbolName;
  label: string;
  active?: boolean;
  onPress: () => void;
}

function ToolButton({ icon, label, active, onPress }: ToolButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={4}
      style={[styles.button, active && styles.buttonActive]}
    >
      <IconSymbol name={icon} size={20} color={Colors.white} />
    </Pressable>
  );
}

// Formatting bar shown above the keyboard while the note body is being edited:
// bold, italic, highlight, text alignment (one button that cycles left, center,
// right) and bullet/numbered lists. Buttons light up for whatever formatting
// the cursor or selection is currently in.
export function NoteFormatToolbar({ editor }: { editor: EditorBridge }) {
  const state = useBridgeState(editor) as NoteEditorState;
  const noteEditor = editor as NoteEditor;
  const align = state.activeAlign ?? 'left';

  return (
    <View style={styles.bar}>
      <ToolButton icon="bold" label="Bold" active={state.isBoldActive} onPress={() => editor.toggleBold()} />
      <ToolButton icon="italic" label="Italic" active={state.isItalicActive} onPress={() => editor.toggleItalic()} />
      <ToolButton
        icon="highlighter"
        label="Highlight"
        active={!!state.activeHighlight}
        onPress={() => editor.toggleHighlight(HIGHLIGHT_COLOR)}
      />
      <View style={styles.divider} />
      <ToolButton
        icon={ALIGN_ICON[align]}
        label={`Align ${NEXT_ALIGN[align]}`}
        onPress={() => noteEditor.setTextAlign(NEXT_ALIGN[align])}
      />
      <View style={styles.divider} />
      <ToolButton
        icon="list.dash"
        label="Bulleted list"
        active={state.isBulletListActive}
        onPress={() => editor.toggleBulletList()}
      />
      <ToolButton
        icon="list.number"
        label="Numbered list"
        active={state.isOrderedListActive}
        onPress={() => editor.toggleOrderedList()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.full,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  button: {
    width: 42,
    height: 38,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonActive: {
    backgroundColor: Colors.primaryLight,
  },
  divider: {
    width: 1,
    height: 22,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
