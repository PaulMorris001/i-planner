import { TenTapStartKit, PlaceholderBridge } from '@10play/tentap-editor';
import { AlignBridge } from './alignBridge';

// The editor's features ("bridges"). Used by BOTH the app (the note editor
// screen) and the editor page running inside the WebView (editor-web), which
// must agree on this list. If it changes, rebuild the editor page with
// `npm run editor:build` and commit editor-web/build.
export const noteEditorBridges = [
  ...TenTapStartKit.filter((bridge) => bridge !== PlaceholderBridge),
  PlaceholderBridge.configureExtension({ placeholder: 'Write something…' }),
  AlignBridge,
];
