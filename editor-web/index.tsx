import React from 'react';
import { createRoot } from 'react-dom/client';
import { AdvancedEditor } from './AdvancedEditor';

declare global {
  interface Window {
    contentInjected: boolean | undefined;
  }
}

// On Android, react-native-webview sometimes injects the content after the page
// has loaded, so wait for it before rendering the editor.
const contentInjected = () => window.contentInjected;
const interval = setInterval(() => {
  if (!contentInjected()) return;
  const container = document.getElementById('root');
  createRoot(container!).render(<AdvancedEditor />);
  clearInterval(interval);
}, 1);
