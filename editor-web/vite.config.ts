import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Builds the page that runs inside the note editor's WebView into ONE html file
// (editor-web/build/index.html). `npm run editor:build` then turns it into
// editor-web/build/editorHtml.js, which the app imports. Those generated files
// are committed, so building the app never needs to run this.
export default defineConfig({
  root: 'editor-web',
  build: {
    outDir: 'build',
    emptyOutDir: false,
  },
  resolve: {
    // TenTap carries its own nested react-dom (18.x), which cannot work with the
    // app's React 19: the page would crash on load. Force the single root copy.
    dedupe: ['react', 'react-dom'],
    alias: [
      // See expoConstantsStub.ts: keeps React Native out of the editor page.
      { find: 'expo-constants', replacement: fileURLToPath(new URL('./expoConstantsStub.ts', import.meta.url)) },
      // On the web side, TenTap exposes its bridges/hooks through a separate entry.
      { find: '@10play/tentap-editor', replacement: '@10play/tentap-editor/web' },
      { find: '@tiptap/pm/view', replacement: '@10play/tentap-editor/web' },
      { find: '@tiptap/pm/state', replacement: '@10play/tentap-editor/web' },
    ],
  },
  plugins: [react(), viteSingleFile()],
});
