import { useEffect, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { getLocales } from 'expo-localization';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  DictationController,
  joinDictationText,
  type DictationProblem,
  type SpeechModule,
} from '@/utils/dictationController';

export { joinDictationText };

// Read once at module load: the device's language doesn't change mid-session.
const DEVICE_LANGUAGE = getLocales()[0]?.languageTag ?? 'en-US';

interface UseDictationOptions {
  // Called with the full text recognised so far *this recording session* (previous sessions' text
  // is the caller's concern) — every time it updates, interim results included.
  onTranscriptChange: (liveText: string) => void;
  onEnd?: () => void;
}

function openSettings() {
  Linking.openSettings().catch((err) => console.error('[useDictation] could not open settings', err));
}

// Tells the person why the mic did nothing. Every failure ends up here, so the button is never
// silently dead.
function showProblem(problem: DictationProblem) {
  switch (problem.kind) {
    case 'permission':
      Alert.alert(
        'Microphone access needed',
        'Allow microphone and speech recognition for I-Planner in Settings to dictate notes.',
        [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: openSettings }]
      );
      return;
    case 'unavailable':
      Alert.alert(
        "Dictation isn't available",
        "This phone has no speech recognition service switched on. On Android, install or enable the Google app (and \"Speech Recognition & Synthesis\" from Google), then try again."
      );
      return;
    case 'network':
      Alert.alert('No connection', 'Dictation needs an internet connection. Check your connection and try again.');
      return;
    case 'microphone':
      Alert.alert('Microphone is busy', 'Another app may be using the microphone, or a call interrupted it. Close it and try again.');
      return;
    case 'language':
      Alert.alert("Language not supported", "Your phone's language isn't available for dictation on this device.");
      return;
    case 'timeout':
      Alert.alert("Dictation didn't start", 'Speech recognition did not respond. Please try again.');
      return;
    default:
      Alert.alert('Dictation stopped', `Something went wrong (${problem.code}). Please try again.`);
  }
}

// Thin React wrapper over DictationController (utils/dictationController.ts), which holds all the
// behaviour: permissions, availability, language fallback, segment merging, timeouts and the
// guards against double taps. This only feeds it the recogniser's events and tracks `recording`.
export function useDictation({ onTranscriptChange, onEnd }: UseDictationOptions) {
  const [recording, setRecording] = useState(false);

  // The controller is created once, but always calls the latest callbacks.
  const handlersRef = useRef({ onTranscriptChange, onEnd });
  handlersRef.current = { onTranscriptChange, onEnd };

  const controllerRef = useRef<DictationController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new DictationController(
      ExpoSpeechRecognitionModule as unknown as SpeechModule,
      {
        onTranscriptChange: (text) => handlersRef.current.onTranscriptChange(text),
        onEnd: () => handlersRef.current.onEnd?.(),
        onRecordingChange: setRecording,
        onProblem: showProblem,
      },
      { deviceLanguage: DEVICE_LANGUAGE }
    );
  }
  const controller = controllerRef.current;

  useSpeechRecognitionEvent('start', () => controller.handleStart());
  useSpeechRecognitionEvent('result', (event) => controller.handleResult(event));
  useSpeechRecognitionEvent('end', () => controller.handleEnd());
  useSpeechRecognitionEvent('error', (event) => {
    console.error('[useDictation] speech recognition error', event.error, event.message);
    controller.handleError(event);
  });

  // Navigating away mid-dictation shouldn't leave a recognition session (and the mic) running.
  useEffect(() => {
    return () => controller.dispose();
  }, [controller]);

  return {
    recording,
    start: () => controller.start(),
    stop: () => controller.stop(),
    // What the mic button calls: start, stop, or ignore a tap while it is still starting.
    toggle: () => controller.toggle(),
  };
}
