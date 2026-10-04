import { BridgeExtension } from '@10play/tentap-editor';
import { TextAlign } from '@tiptap/extension-text-align';

// Text alignment isn't part of TenTap's starter kit, so it's added as a custom
// bridge. This ONE file is used by both halves of the editor: the app (React
// Native side, for the toolbar's setTextAlign() and the current-alignment
// state) and the editor-web bundle (the page running inside the WebView, where
// the Tiptap extension itself lives). That is why it imports only from
// '@10play/tentap-editor', which the web build aliases to its web flavor.

export type TextAlignValue = 'left' | 'center' | 'right';

export type AlignEditorState = { activeAlign: TextAlignValue };
export type AlignEditorInstance = { setTextAlign: (align: TextAlignValue) => void };

enum AlignActionType {
  SetTextAlign = 'set-text-align',
}

type AlignMessage = { type: AlignActionType.SetTextAlign; payload: TextAlignValue };

export const AlignBridge = new BridgeExtension<AlignEditorState, AlignEditorInstance, AlignMessage>({
  tiptapExtension: TextAlign.configure({
    types: ['heading', 'paragraph'],
    alignments: ['left', 'center', 'right'],
  }),
  onBridgeMessage: (editor, message) => {
    if (message.type === AlignActionType.SetTextAlign) {
      editor.chain().focus().setTextAlign(message.payload).run();
    }
    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => ({
    setTextAlign: (align) => sendBridgeMessage({ type: AlignActionType.SetTextAlign, payload: align }),
  }),
  extendEditorState: (editor) => ({
    activeAlign: editor.isActive({ textAlign: 'center' }) ? 'center' : editor.isActive({ textAlign: 'right' }) ? 'right' : 'left',
  }),
});
