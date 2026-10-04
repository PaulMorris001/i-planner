import React from 'react';
import { EditorContent } from '@tiptap/react';
import { CharacterCount } from '@tiptap/extensions';
import { useTenTap } from '@10play/tentap-editor';
import { noteEditorBridges } from '../utils/richText/editorBridges';

// Same as NOTE_BODY_MAX_LENGTH in app/note-editor.tsx and
// backend/src/constants/noteLimits.ts. Enforced here too so typing and pasting
// stop at the limit inside the editor itself.
const NOTE_BODY_MAX_LENGTH = 100_000;

export const AdvancedEditor = () => {
  const editor = useTenTap({
    bridges: noteEditorBridges,
    tiptapOptions: {
      extensions: [CharacterCount.configure({ limit: NOTE_BODY_MAX_LENGTH })],
    },
  });
  return <EditorContent editor={editor} className={window.dynamicHeight ? 'dynamic-height' : undefined} />;
};
