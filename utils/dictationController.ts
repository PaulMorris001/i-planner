// The logic behind the notes mic button, kept free of React so every situation can be tested:
// permission refused, no speech service on the phone, unsupported language, no internet, a second
// tap while the first is still starting, a recogniser that never answers, and so on.
//
// hooks/useDictation.ts is the thin React wrapper that feeds it the recogniser's events.

// Appends `addition` to `base` with a separating space, unless `base` is empty
// or already ends in whitespace/a newline. Exported because note-editor.tsx
// needs the same join logic to attach a dictation session's output onto
// whatever text was already in the note before recording started.
export function joinDictationText(base: string, addition: string): string {
  if (!addition) return base;
  const needsSpace = base.length > 0 && !base.endsWith(' ') && !base.endsWith('\n');
  return `${base}${needsSpace ? ' ' : ''}${addition}`;
}

// If this long passes with no `result` event, the next one to arrive is treated as a new segment
// rather than a revision of the in-progress one. Android's recogniser can silently abandon a
// segment after a pause (github.com/jamsch/expo-speech-recognition/issues/87), so without this
// everything said before the most recent pause would be lost.
const SEGMENT_GAP_MS = 800;
const SAME_SEGMENT_OPENING_WORDS = 4;

// Lowercase, punctuation stripped, whitespace collapsed - recognisers revise casing and
// punctuation of earlier words as they go ("the" -> "The,").
function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Whether `next` is a revision of `prev` (the same segment, re-sent) rather than a brand-new one.
// iOS re-sends the WHOLE session transcript on every update and revises earlier words, so an exact
// prefix check misfires there; a shared opening also counts as the same segment.
export function isSameSegment(prev: string, next: string): boolean {
  const a = normalizeTranscript(prev);
  const b = normalizeTranscript(next);
  if (!a || !b) return true;
  if (a.startsWith(b) || b.startsWith(a)) return true;
  const aWords = a.split(' ');
  const bWords = b.split(' ');
  if (aWords.length < SAME_SEGMENT_OPENING_WORDS || bWords.length < SAME_SEGMENT_OPENING_WORDS) return false;
  return aWords.slice(0, SAME_SEGMENT_OPENING_WORDS).join(' ') === bWords.slice(0, SAME_SEGMENT_OPENING_WORDS).join(' ');
}

// ---- What the controller needs from the speech module (expo-speech-recognition) ---------------

export interface PermissionState {
  granted: boolean;
  canAskAgain?: boolean;
}

export interface SpeechModule {
  getPermissionsAsync(): Promise<PermissionState>;
  requestPermissionsAsync(): Promise<PermissionState>;
  isRecognitionAvailable(): boolean;
  // iOS and recent Android only; may be missing, may throw, may return nothing.
  getSupportedLocales?(options: Record<string, never>): Promise<{ locales: string[] }>;
  start(options: { lang: string; interimResults: boolean; continuous: boolean }): void;
  stop(): void;
  abort(): void;
}

export type DictationProblem =
  // Microphone or speech permission refused. `canAskAgain` false means only Settings can fix it.
  | { kind: 'permission'; canAskAgain: boolean }
  // This phone has no speech recognition service (or it is switched off).
  | { kind: 'unavailable' }
  | { kind: 'network' }
  // The microphone could not be used: another app has it, a call interrupted, hardware error.
  | { kind: 'microphone' }
  | { kind: 'language' }
  // The recogniser never answered.
  | { kind: 'timeout' }
  | { kind: 'unknown'; code: string };

export interface SpeechErrorEvent {
  error: string;
  message?: string;
}

export interface DictationHandlers {
  // Full text recognised so far this session, interim results included.
  onTranscriptChange: (liveText: string) => void;
  // The session is over (stopped, ended on its own, or failed). Always fires once per session
  // that produced a start, so whatever was dictated can be committed.
  onEnd?: () => void;
  // Whether the mic should look active.
  onRecordingChange: (recording: boolean) => void;
  // Something went wrong that the person should be told about.
  onProblem: (problem: DictationProblem) => void;
}

export interface DictationOptions {
  // The device's language tag, e.g. "en-NG".
  deviceLanguage: string;
  // How long to wait for the recogniser to confirm it started / to finish after Stop.
  startTimeoutMs?: number;
  stopTimeoutMs?: number;
  now?: () => number;
}

type State = 'idle' | 'starting' | 'listening' | 'stopping';

// Some English variants are not offered by every platform's recogniser (iOS has no "en-NG", for
// example), so for a language with no exact match, these are tried in order.
const LANGUAGE_FALLBACKS: Record<string, string[]> = {
  en: ['en-GB', 'en-US'],
};
const LAST_RESORT_LANGUAGE = 'en-US';

export class DictationController {
  private state: State = 'idle';
  private finalTranscript = '';
  private currentSegment = '';
  private lastResultAt = 0;
  private sawStartThisSession = false;
  private triedLanguages: string[] = [];
  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  // Incremented for every session, so a late event from an old one is not mistaken for the new.
  private session = 0;

  constructor(
    private readonly speech: SpeechModule,
    private readonly handlers: DictationHandlers,
    private readonly options: DictationOptions
  ) {}

  get busy(): boolean {
    return this.state !== 'idle';
  }

  // The mic button: starts when idle, stops when running, and ignores taps while it is already
  // starting or stopping (a second tap during the permission prompt must not start a second one).
  async toggle(): Promise<void> {
    if (this.state === 'listening') return this.stop();
    if (this.state === 'idle') return this.start();
    // 'starting' or 'stopping': a stop request during start is honoured as soon as it is running.
    if (this.state === 'starting') this.stop();
  }

  async start(): Promise<void> {
    if (this.state !== 'idle') return;
    const session = ++this.session;
    this.state = 'starting';
    this.finalTranscript = '';
    this.currentSegment = '';
    this.lastResultAt = 0;
    this.sawStartThisSession = false;
    this.triedLanguages = [];
    // Immediate feedback on the tap, before the permission prompt or the recogniser answer.
    this.handlers.onRecordingChange(true);

    try {
      const permission = await this.ensurePermission();
      if (session !== this.session || this.state !== 'starting') return; // stopped meanwhile
      if (!permission.granted) {
        this.fail({ kind: 'permission', canAskAgain: permission.canAskAgain !== false });
        return;
      }
      if (!this.speech.isRecognitionAvailable()) {
        this.fail({ kind: 'unavailable' });
        return;
      }
      const lang = await this.pickLanguage();
      if (session !== this.session || this.state !== 'starting') return;
      this.beginRecognition(lang, session);
    } catch (err) {
      if (session !== this.session) return;
      this.fail({ kind: 'unknown', code: (err as { code?: string })?.code ?? 'start-failed' });
    }
  }

  stop(): void {
    if (this.state === 'idle') {
      // Nothing to stop; make sure the button is not left looking active.
      this.handlers.onRecordingChange(false);
      return;
    }
    if (this.state === 'stopping') return;
    const wasStarting = this.state === 'starting' && !this.sawStartThisSession;
    this.state = 'stopping';
    this.clearTimers();
    if (wasStarting) {
      // Never got going: abort so a recogniser that is just about to start cannot keep the mic
      // open, and there is no 'end' to wait for.
      try {
        this.speech.abort();
      } catch {
        // already stopped
      }
      this.finish(false);
      return;
    }
    try {
      this.speech.stop();
    } catch {
      // Handled by the safety timer below.
    }
    // The recogniser normally answers with an 'end' event; if it never does, finish anyway so the
    // button cannot get stuck in the active state.
    this.stopTimer = setTimeout(() => this.finish(true), this.options.stopTimeoutMs ?? 3000);
  }

  // The screen is going away: stop the mic quietly.
  dispose(): void {
    this.clearTimers();
    if (this.state !== 'idle') {
      try {
        this.speech.abort();
      } catch {
        // nothing more to do
      }
    }
    this.state = 'idle';
  }

  // ---- events from the recogniser ---------------------------------------------------------

  handleStart(): void {
    if (this.state === 'idle') return;
    this.sawStartThisSession = true;
    if (this.state === 'starting') this.state = 'listening';
    if (this.startTimer) {
      clearTimeout(this.startTimer);
      this.startTimer = null;
    }
  }

  handleResult(event: { results: { transcript: string }[]; isFinal: boolean }): void {
    if (this.state === 'idle') return;
    const now = (this.options.now ?? Date.now)();
    const segment = event.results[0]?.transcript ?? '';
    const prevSegment = this.currentSegment;
    const looksLikeSameSegment = !!prevSegment && isSameSegment(prevSegment, segment);
    if (prevSegment && !looksLikeSameSegment && now - this.lastResultAt > SEGMENT_GAP_MS) {
      this.finalTranscript = joinDictationText(this.finalTranscript, prevSegment);
      this.currentSegment = '';
    }
    this.lastResultAt = now;
    this.currentSegment = segment;

    if (event.isFinal) {
      this.finalTranscript = joinDictationText(this.finalTranscript, segment);
      this.currentSegment = '';
      this.handlers.onTranscriptChange(this.finalTranscript);
    } else {
      this.handlers.onTranscriptChange(joinDictationText(this.finalTranscript, segment));
    }
  }

  handleEnd(): void {
    if (this.state === 'idle') return;
    // An 'end' that arrives before this session's own 'start' belongs to the previous session
    // (aborted a moment ago), not this one.
    if (this.state === 'starting' && !this.sawStartThisSession) return;
    this.finish(true);
  }

  handleError(event: SpeechErrorEvent): void {
    if (this.state === 'idle') return;
    const code = event.error;

    // Nothing was said, or the person stopped it: not a problem, the session simply ends.
    if (code === 'no-speech' || code === 'aborted') {
      // 'aborted' before our own start is the previous session being cut off: ignore it.
      if (this.state === 'starting' && !this.sawStartThisSession) return;
      this.finish(true);
      return;
    }

    // The language isn't offered here: try the next one before giving up.
    if (code === 'language-not-supported' && !this.sawStartThisSession) {
      const next = this.nextFallbackLanguage();
      if (next) {
        this.beginRecognition(next, this.session);
        return;
      }
      this.fail({ kind: 'language' });
      return;
    }

    if (code === 'not-allowed') return this.fail({ kind: 'permission', canAskAgain: false });
    if (code === 'service-not-allowed') return this.fail({ kind: 'unavailable' });
    if (code === 'network') return this.fail({ kind: 'network' });
    if (code === 'audio-capture' || code === 'busy' || code === 'interrupted') return this.fail({ kind: 'microphone' });
    this.fail({ kind: 'unknown', code });
  }

  // ---- internals --------------------------------------------------------------------------

  private async ensurePermission(): Promise<PermissionState> {
    const current = await this.speech.getPermissionsAsync().catch(() => null);
    if (current?.granted) return current;
    // Already refused with "don't ask again": the prompt cannot appear, so don't pretend to try.
    if (current && current.canAskAgain === false) return current;
    return this.speech.requestPermissionsAsync();
  }

  // The best language the recogniser actually offers, in order of preference.
  private async pickLanguage(): Promise<string> {
    const device = this.options.deviceLanguage || LAST_RESORT_LANGUAGE;
    let supported: string[] = [];
    try {
      const result = await this.speech.getSupportedLocales?.({});
      supported = result?.locales ?? [];
    } catch {
      supported = [];
    }
    // No list available (older Android): trust the device language and rely on the fallback chain
    // when the recogniser rejects it.
    if (supported.length === 0) return device;
    if (supported.includes(device)) return device;

    const base = device.split('-')[0];
    const sameLanguage = supported.filter((l) => l.split('-')[0] === base);
    for (const preferred of LANGUAGE_FALLBACKS[base] ?? []) {
      if (sameLanguage.includes(preferred)) return preferred;
    }
    if (sameLanguage.length) return sameLanguage[0];
    return supported.includes(LAST_RESORT_LANGUAGE) ? LAST_RESORT_LANGUAGE : device;
  }

  private nextFallbackLanguage(): string | null {
    const device = this.options.deviceLanguage || LAST_RESORT_LANGUAGE;
    const base = device.split('-')[0];
    const candidates = [...(LANGUAGE_FALLBACKS[base] ?? []), base, LAST_RESORT_LANGUAGE];
    return candidates.find((l) => !this.triedLanguages.includes(l)) ?? null;
  }

  private beginRecognition(lang: string, session: number): void {
    this.triedLanguages.push(lang);
    if (this.startTimer) clearTimeout(this.startTimer);
    // If the recogniser never confirms, don't leave the button looking active forever.
    this.startTimer = setTimeout(() => {
      if (session === this.session && this.state === 'starting') this.fail({ kind: 'timeout' });
    }, this.options.startTimeoutMs ?? 8000);
    try {
      this.speech.start({ lang, interimResults: true, continuous: true });
    } catch (err) {
      this.fail({ kind: 'unknown', code: (err as { code?: string })?.code ?? 'start-failed' });
    }
  }

  private fail(problem: DictationProblem): void {
    const hadSession = this.sawStartThisSession;
    this.clearTimers();
    try {
      this.speech.abort();
    } catch {
      // already stopped
    }
    this.finish(hadSession);
    this.handlers.onProblem(problem);
  }

  // Back to idle. `commit` says whether the session produced anything that should be committed
  // (so onEnd runs at most once, and only for a session that really started).
  private finish(commit: boolean): void {
    if (this.state === 'idle' && !commit) {
      this.handlers.onRecordingChange(false);
      return;
    }
    this.clearTimers();
    this.state = 'idle';
    this.handlers.onRecordingChange(false);
    if (commit) this.handlers.onEnd?.();
  }

  private clearTimers(): void {
    if (this.startTimer) clearTimeout(this.startTimer);
    if (this.stopTimer) clearTimeout(this.stopTimer);
    this.startTimer = null;
    this.stopTimer = null;
  }
}
