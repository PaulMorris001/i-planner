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

// If this long passes with no `result` event, the next one to arrive is
// treated as a new segment rather than a revision of the in-progress one —
// see the big comment below for why. Below the ~1-2s pause length reported to
// actually trigger data loss, comfortably above the gap between consecutive
// interim updates during continuous active speech (typically well under a
// second), so it shouldn't false-positive mid-sentence.
const SEGMENT_GAP_MS = 800;

// Lowercase, punctuation stripped, whitespace collapsed - recognizers revise
// casing and punctuation of earlier words as they go ("the" -> "The,").
function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const SAME_SEGMENT_OPENING_WORDS = 4;

// Whether `next` is a revision of `prev` (the same segment, re-sent) rather
// than a brand-new segment. iOS re-sends the WHOLE session transcript on every
// update and revises earlier words along the way, so an exact prefix check
// misfires there: a revision looked "new", the old transcript got baked in,
// and the next update (which still contains it) was appended on top,
// duplicating every paragraph spoken so far. Compare normalized text, and also
// treat a shared opening as the same segment: a genuinely new segment (Android
// after a pause) starts with different words.
function isSameSegment(prev: string, next: string): boolean {
  const a = normalizeTranscript(prev);
  const b = normalizeTranscript(next);
  if (!a || !b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  if (aWords.length < SAME_SEGMENT_OPENING_WORDS || bWords.length < SAME_SEGMENT_OPENING_WORDS) return false;
  return aWords.slice(0, SAME_SEGMENT_OPENING_WORDS).join(' ') === bWords.slice(0, SAME_SEGMENT_OPENING_WORDS).join(' ');
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
// drops everything said before the most recent pause.
//
// The first attempt at fixing this only baked a segment into
// `finalTranscriptRef` once `event.isFinal` arrived for it — that assumed
// Android always finalizes a segment before abandoning it for a new one.
// In practice (confirmed by a user hitting data loss on a plain ~1-2s pause)
// it doesn't: the recognizer can drop a segment with no `isFinal` event at
// all, so there's nothing for that logic to catch. `lastEventAtRef` adds a
// second, independent signal that doesn't depend on `isFinal` firing
// correctly: if too long has passed since the last `result` event, whatever
// segment was in progress is baked in as a precaution *before* processing the
// new event, on the theory that a real gap this size means the recognizer
// already silently moved on. This is still correct for iOS's documented
// behavior (one final result at the very end of the whole session, no
// mid-session gaps) since the timer only ever fires between actual events.
export function useDictation({ onTranscriptChange, onEnd }: UseDictationOptions) {
  const [recording, setRecording] = useState(false);
  const finalTranscriptRef = useRef('');
  const currentSegmentRef = useRef('');
  const lastEventAtRef = useRef(0);

  useSpeechRecognitionEvent('result', (event) => {
    const now = Date.now();
    const segment = event.results[0]?.transcript ?? '';
    const prevSegment = currentSegmentRef.current;
    // A gap this long usually means the recognizer silently abandoned the old
    // segment for a new one (see the big comment above) — *except* when the
    // gap is simply the natural pause right before finalizing that same
    // segment: `event.isFinal`'s own transcript for it is typically identical
    // or lightly revised, not new content. Comparing the two catches that
    // case (one contains the other, e.g. a straight prefix match either way)
    // so the segment doesn't get baked in twice — once here, once more via
    // the isFinal branch below for the very same words. See isSameSegment for
    // why this can't be a plain exact-prefix check.
    const looksLikeSameSegment = !!prevSegment && isSameSegment(prevSegment, segment);
    if (prevSegment && !looksLikeSameSegment && now - lastEventAtRef.current > SEGMENT_GAP_MS) {
      finalTranscriptRef.current = joinDictationText(finalTranscriptRef.current, prevSegment);
      currentSegmentRef.current = '';
    }
    lastEventAtRef.current = now;

    currentSegmentRef.current = segment;

    if (event.isFinal) {
      finalTranscriptRef.current = joinDictationText(finalTranscriptRef.current, segment);
      currentSegmentRef.current = '';
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
    currentSegmentRef.current = '';
    lastEventAtRef.current = 0;
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
