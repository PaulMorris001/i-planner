import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getLocales } from 'expo-localization';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

// Matches utils/currency.ts's own reasoning for reading this once at module
// load rather than per call — the device's language doesn't change mid-session.
const DICTATION_LANG = getLocales()[0]?.languageTag ?? 'en-US';

// Appends `addition` to `base` with a separating space, unless `base` is empty
// or already ends in whitespace/a newline. Exported because note-editor.tsx
// needs the same join logic to attach a dictation session's output onto
// whatever text was already in the note before recording started.
export function joinDictationText(base: string, addition: string): string {
  if (!addition) return base;
  const needsSpace = base.length > 0 && !base.endsWith(' ') && !base.endsWith('\n');
  return `${base}${needsSpace ? ' ' : ''}${addition}`;
}

interface UseDictationOptions {
  // Called with the full text recognized so far *this recording session*
  // (previous sessions' text is the caller's concern, not this hook's) —
  // every time it updates, interim results included.
  onTranscriptChange: (liveText: string) => void;
  onEnd?: () => void;
}

// Thin wrapper around expo-speech-recognition so callers (just note-editor.tsx
// today) don't need to deal with the module's event-listener API directly.
//
// The one subtlety this hook exists to hide: with `continuous: true`, Android
// runs recognition as a series of segments — after a pause, the *next*
// `result` event's `results[0]` starts a fresh segment rather than continuing
// to grow the same one (confirmed via the library's own README and a matching
// open issue: github.com/jamsch/expo-speech-recognition/issues/87, "After
// little pause in speech Android is replacing old transcript"). Naively
// trusting `results[0].transcript` as "the whole session so far" silently
// drops everything said before the most recent pause. `finalTranscriptRef`
// accumulates each segment only once it's confirmed final (`event.isFinal`),
// so a mid-sentence pause never loses anything — this also happens to be
// correct for iOS's documented behavior (one final result at the very end of
// the session), since `finalTranscriptRef` just stays empty throughout and
// the interim segment IS the whole session so far in that case.
export function useDictation({ onTranscriptChange, onEnd }: UseDictationOptions) {
  const [recording, setRecording] = useState(false);
  const finalTranscriptRef = useRef('');

  useSpeechRecognitionEvent('result', (event) => {
    const segment = event.results[0]?.transcript ?? '';
    if (event.isFinal) {
      finalTranscriptRef.current = joinDictationText(finalTranscriptRef.current, segment);
      onTranscriptChange(finalTranscriptRef.current);
    } else {
      onTranscriptChange(joinDictationText(finalTranscriptRef.current, segment));
    }
  });
  useSpeechRecognitionEvent('end', () => {
    setRecording(false);
    onEnd?.();
  });
  useSpeechRecognitionEvent('error', (event) => {
    console.error('[useDictation] speech recognition error', event.error, event.message);
    setRecording(false);
  });

  // Navigating away mid-dictation shouldn't leave a recognition session (and
  // the mic) running in the background.
  useEffect(() => {
    return () => {
      ExpoSpeechRecognitionModule.stop();
    };
  }, []);

  const start = async () => {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert(
        'Microphone access needed',
        'Enable microphone and speech recognition access in Settings to dictate notes.'
      );
      return;
    }
    finalTranscriptRef.current = '';
    setRecording(true);
    ExpoSpeechRecognitionModule.start({
      lang: DICTATION_LANG,
      interimResults: true,
      // Keeps listening (streaming interim results) across pauses in speech,
      // instead of auto-stopping after one sentence — a notes dictation
      // button should behave like a press-to-talk mic, not a one-shot query.
      continuous: true,
    });
  };

  const stop = () => {
    ExpoSpeechRecognitionModule.stop();
  };

  return { recording, start, stop };
}
