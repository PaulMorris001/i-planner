import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Keyboard, ActivityIndicator, Share, Platform, AppState } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FolderPickerModal } from '@/components/notes/FolderPickerModal';
import { ShareOptionsModal } from '@/components/notes/ShareOptionsModal';
import { CollaboratorsSheet } from '@/components/notes/CollaboratorsSheet';
import { NotePeopleSheet } from '@/components/notes/NotePeopleSheet';
import { requestConfirm } from '@/components/ui/ConfirmModal';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useNotes } from '@/hooks/useNotes';
import { useFolders } from '@/hooks/useFolders';
import { useDictation } from '@/hooks/useDictation';
import { noteService } from '@/services/note.service';
import { sharedNoteService } from '@/services/sharedNote.service';
import { collaborationService } from '@/services/collaboration.service';
import type { Note } from '@/types/note.types';
import type { NoteAccessRole } from '@/types/collaboration.types';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate, formatTimeLabel } from '@/utils/date';
import { shareNote } from '@/utils/exportNote';
import { RichText, useBridgeState, useEditorBridge } from '@10play/tentap-editor';
import { NoteFormatToolbar } from '@/components/notes/NoteFormatToolbar';
import { editorHtml } from '@/editor-web/build/editorHtml';
import { noteEditorBridges } from '@/utils/richText/editorBridges';
import {
  appendTextToEditorHtml,
  bodyToEditorHtml,
  bodyToPlainText,
  editorHtmlToBody,
  plainTextToEditorHtml,
} from '@/utils/richNote';


const NOTE_BODY_MAX_LENGTH = 100_000;
// Keep in sync with backend/src/constants/noteLimits.ts's NOTE_TITLE_MAX_LENGTH.
const NOTE_TITLE_MAX_LENGTH = 200;

const AUTOSAVE_INTERVAL_MS = 8_000;
// How often an open note is checked for changes other people have saved.
const REMOTE_CHECK_MS = 12_000;

// The latest copy of the note when a save was refused because someone else changed it first.
function latestNoteFromConflict(err: unknown): Note | null {
  const e = err as { status?: number; data?: { note?: Note } } | null;
  return e?.status === 409 && e.data?.note ? e.data.note : null;
}
// Typing is read out of the editor (a WebView) this long after the last change.
const EDITOR_SYNC_DEBOUNCE_MS = 250;
// How long the editor's own echo of an app-made change is ignored.
const EDITOR_ECHO_MS = 600;
// The editor counts text slightly differently from this screen (list markers,
// line breaks), so "full" is declared this many characters early.
const NOTE_FULL_MARGIN = 100;

// A title for a note whose title field is empty: its first line of text.
function deriveFallbackTitle(body: string): string {
  const firstLine = bodyToPlainText(body.slice(0, 2000)).trim().split('\n')[0]?.replace(/^•\s*/, '').trim() ?? '';
  if (!firstLine) return '';
  return firstLine.length > 60 ? firstLine.slice(0, 60) : firstLine;
}

export default function NoteEditor() {
  const { id, folderId: folderIdParam } = useLocalSearchParams<{ id?: string; folderId?: string }>();
  const { notes, sharedNotes, createNote, updateNote, deleteNote, leaveSharedNote, applyServerNote, setSharedRole } = useNotes();
  const { folders } = useFolders();
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  // The note's body in its STORED form: the editor's HTML behind RICH_BODY_MARKER,
  // or '' when empty (see utils/richNote.ts). Always the last text pulled from
  // the editor, never edited directly.
  const [body, setBody] = useState('');
  const [newNoteFolderId, setNewNoteFolderId] = useState<string | undefined>(folderIdParam);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const [cleanupState, setCleanupState] = useState<'idle' | 'loading' | 'reviewing'>('idle');
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // True once any save (Save button or autosave) has gone through on this
  // screen - drives the green "Saved" state of the header button.
  const [hasSaved, setHasSaved] = useState(false);
  // True from the moment the editor reports a change until that change has been
  // pulled into `body` (typing is debounced). Counts as unsaved, so leaving the
  // screen in that gap can't lose the last few keystrokes.
  const [pendingSync, setPendingSync] = useState(false);
  // A note is either one of this account's own, or one someone invited it to (with a role).
  const sharedEntry = savedId ? sharedNotes.find((s) => s.note.id === savedId) : undefined;
  const role: NoteAccessRole = sharedEntry ? sharedEntry.role : 'owner';
  const isOwner = role === 'owner';
  // A viewer can read the note but nothing on this screen changes it.
  const canEdit = role !== 'viewer';
  const editing = savedId ? notes.find((n) => n.id === savedId) ?? sharedEntry?.note ?? null : null;
  const [peopleOpen, setPeopleOpen] = useState(false);
  // The read-only people list an invited person can open.
  const [viewPeopleOpen, setViewPeopleOpen] = useState(false);
  // Set when a save was refused because someone else saved first: the latest copy, shown in a banner.
  const [conflict, setConflict] = useState<Note | null>(null);

  const warnedMaxLengthRef = useRef(false);
  // Snapshot of `body` taken right before a Clean request fires, restored on Revert.
  const preCleanBodyRef = useRef('');
  // Set only when usePreventRemove blocks a real navigation attempt (back
  // button/gesture/hardware back) while reviewing — replayed once the user
  // resolves Keep/Revert, so their original attempt to leave actually
  // completes instead of leaving them stuck needing to press back twice.
  // Left null for a proactive tap on the banner's own Keep/Revert buttons.
  const pendingNavActionRef = useRef<Parameters<Parameters<typeof usePreventRemove>[1]>[0]['data']['action'] | null>(
    null
  );
  // Refs mirror the latest state for the autosave interval/callbacks below,
  // which are set up once and would otherwise close over stale values.
  const titleRef = useRef(title);
  titleRef.current = title;
  const bodyRef = useRef(body);
  bodyRef.current = body;
  const newNoteFolderIdRef = useRef(newNoteFolderId);
  newNoteFolderIdRef.current = newNoteFolderId;
  const savedIdRef = useRef(savedId);
  savedIdRef.current = savedId;
  const canEditRef = useRef(canEdit);
  canEditRef.current = canEdit;
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  // True while any save (autosave or manual) is in flight, so the two can
  // never race each other into creating the same not-yet-saved note twice.
  const busyRef = useRef(false);
  const lastSavedRef = useRef<{ title: string; body: string }>({ title: '', body: '' });

  // --- Rich text editor -----------------------------------------------------
  // The editor runs in a WebView (see editor-web/), so everything below is
  // asynchronous: content is pulled out with getHTML() rather than read from a
  // controlled input.
  const [initialEditorHtml] = useState(() => bodyToEditorHtml(editing?.body ?? ''));
  const onEditorChangeRef = useRef<() => void>(() => {});
  const editor = useEditorBridge({
    customSource: editorHtml,
    bridgeExtensions: noteEditorBridges,
    initialContent: initialEditorHtml,
    autofocus: false,
    // This screen's own keyboard handling (ScreenWrapper) already lifts the
    // page above the keyboard; the editor's built-in avoidance would double up.
    avoidIosKeyboard: false,
    onChange: () => onEditorChangeRef.current(),
  });
  const editorState = useBridgeState(editor);
  // False until the editor's first content has been read and recorded as the
  // note's starting point (see the effect below). Saving is blocked until then,
  // so an existing note's body can never be overwritten with an empty one.
  const baselineReadyRef = useRef(false);
  // Changes the app makes to the editor itself (load, revert, dictation)
  // echo back as change events; those must not count as the user typing.
  const suppressUntilRef = useRef(0);
  const dictationActiveRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dictationBaseHtmlRef = useRef('');
  const dictationBaseLengthRef = useRef(0);
  // Dictation can start before the editor has finished loading (the mic works the
  // moment a note opens). What is said until then waits here and is put into the
  // note once it has loaded; `ended` records that dictation already stopped.
  const dictationBufferRef = useRef<{ text: string; ended: boolean } | null>(null);
  // Whether dictationBase* describe the note as it stands now. They are captured
  // when dictation starts, or at the first update if the note had not loaded yet.
  const dictationBaseSetRef = useRef(false);

  const applyBody = (stored: string) => {
    bodyRef.current = stored;
    setBody(stored);
  };

  const pullBodyFromEditor = async () => editorHtmlToBody(await editor.getHTML());

  // Reads what the editor currently holds into `body`. Also what Save,
  // autosave and leaving the screen call first, so none of them ever act on text
  // that is still waiting out the typing debounce.
  const syncBodyFromEditor = async (): Promise<string> => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    const stored = await pullBodyFromEditor();
    applyBody(stored);
    setPendingSync(false);
    enforceLengthLimit(stored);
    return stored;
  };

  // The latest body: pulled from the editor if typing is still waiting to sync.
  const currentBody = async (): Promise<string> => (syncTimerRef.current ? syncBodyFromEditor() : bodyRef.current);

  onEditorChangeRef.current = () => {
    if (!canEditRef.current || !baselineReadyRef.current || dictationActiveRef.current || Date.now() < suppressUntilRef.current) return;
    setPendingSync(true);
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncBodyFromEditor().catch((err) => console.error('[NoteEditor] failed to read the editor', err));
    }, EDITOR_SYNC_DEBOUNCE_MS);
  };

  useEffect(
    () => () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    },
    []
  );

  // Puts `stored` into the editor exactly as given, and makes it the screen's
  // body without reading the editor back. Used by Discard and Revert, which must
  // restore a previously stored string EXACTLY: reading it back could differ by a
  // harmless serialization detail and leave the note looking edited forever,
  // which would trap the user in the "Save changes?" prompt.
  const restoreBody = (stored: string) => {
    suppressUntilRef.current = Date.now() + EDITOR_ECHO_MS;
    editor.setContent(bodyToEditorHtml(stored));
    applyBody(stored);
    setPendingSync(false);
  };

  // Loads brand-new content (the AI's cleaned text) and records what the editor
  // makes of it as the body.
  const loadEditorHtml = async (html: string) => {
    suppressUntilRef.current = Date.now() + EDITOR_ECHO_MS;
    editor.setContent(html);
    const stored = await pullBodyFromEditor();
    applyBody(stored);
    setPendingSync(false);
    return stored;
  };

  // Once the editor is up: take ITS rendering of the note as the starting point.
  // Comparing against the stored string instead would flag every note as edited
  // the moment it opens (an older plain-text note, or any note whose HTML the
  // editor writes slightly differently), and Save would never start grey.
  useEffect(() => {
    if (!editorState.isReady || baselineReadyRef.current) return;
    let cancelled = false;
    (async () => {
      // The note arrived after the editor was created: put its text in.
      if (editing && bodyToEditorHtml(editing.body) !== initialEditorHtml) {
        suppressUntilRef.current = Date.now() + EDITOR_ECHO_MS;
        editor.setContent(bodyToEditorHtml(editing.body));
      }
      const stored = await pullBodyFromEditor();
      if (cancelled) return;
      baselineReadyRef.current = true;
      lastSavedRef.current = { title: lastSavedRef.current.title, body: stored };
      applyBody(stored);
      // The mic was tapped before the note finished loading: add what was said.
      const buffered = dictationBufferRef.current;
      if (buffered) {
        dictationBufferRef.current = null;
        suppressUntilRef.current = Date.now() + EDITOR_ECHO_MS;
        if (buffered.text) applyDictationText(buffered.text);
        if (buffered.ended) {
          dictationActiveRef.current = false;
          await syncBodyFromEditor();
        }
      }
    })().catch((err) => console.error('[NoteEditor] failed to load the note into the editor', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState.isReady, editing?.id]);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      lastSavedRef.current = { title: editing.title, body: lastSavedRef.current.body };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Persists whatever's currently typed if it differs from the last save.
  // Shared by the autosave interval and the max-length hard stop.
  const runAutosave = async () => {
    if (busyRef.current) return;
    // A viewer never saves; and while a conflict is waiting for a choice nothing is retried.
    if (!canEditRef.current || conflictRef.current) return;
    // Never silently commit an unconfirmed AI-cleanup decision — the editor is
    // also locked (not editable) during review, so nothing else can change while
    // this holds, but the 8s interval itself has no other reason to skip a tick.
    if (cleanupState === 'reviewing') return;
    // See baselineReadyRef: never save before the note's real text is known.
    if (savedIdRef.current && !baselineReadyRef.current) return;
    if (syncTimerRef.current) await syncBodyFromEditor();
    const b = bodyRef.current;
    const t = titleRef.current.trim() || deriveFallbackTitle(b);
    if (!t) return; // nothing worth persisting yet
    if (t === lastSavedRef.current.title && b === lastSavedRef.current.body) return;
    busyRef.current = true;
    setAutosaveStatus('saving');
    try {
      if (savedIdRef.current) {
        await updateNote(savedIdRef.current, { title: t, body: b });
      } else {
        const created = await createNote({ title: t, body: b, folderId: newNoteFolderIdRef.current });
        savedIdRef.current = created.id;
        setSavedId(created.id);
      }
      lastSavedRef.current = { title: t, body: b };
      // A title derived from the first line becomes the real title, or the
      // empty field would never match what was saved and look unsaved forever.
      if (!titleRef.current.trim()) setTitle(t);
      setAutosaveStatus('saved');
      setHasSaved(true);
    } catch (err) {
      console.error('[NoteEditor] autosave failed', err);
      setAutosaveStatus('idle');
      const latest = latestNoteFromConflict(err);
      if (latest) setConflict(latest);
    } finally {
      busyRef.current = false;
    }
  };

  // NotesContext's updateNote closes over `notes` directly (for its
  // rollback-on-error path, not just via a functional setState), so calling a
  // stale copy of it — e.g. from a closure this effect captured once at mount
  // — could roll back to a long-outdated notes snapshot on a failed autosave.
  // Routing the interval through a ref that's refreshed every render keeps it
  // always calling the current render's runAutosave/updateNote instead.
  const runAutosaveRef = useRef(runAutosave);
  runAutosaveRef.current = runAutosave;

  useEffect(() => {
    const interval = setInterval(() => runAutosaveRef.current(), AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Any text worth saving (an untitled note uses its first line as the title).
  const hasSaveableText = !!(title.trim() || deriveFallbackTitle(body));
  // Whether the body has any visible text (not just empty formatting).
  const hasBodyText = useMemo(() => !!bodyToPlainText(body).trim(), [body]);
  // True whenever there's something on screen that isn't reflected in the
  // last confirmed save (autosave included) — i.e. a crash, force-quit, or
  // leaving before the next 8s autosave tick would actually lose something.
  // Computed fresh every render directly against the ref, not tracked as its
  // own state — lastSavedRef only ever changes right alongside a title/body
  // state update or a re-render-triggering state change nearby (see
  // handleSave's own comment for the one case that needed extra care).
  const isDirty = pendingSync || title.trim() !== lastSavedRef.current.title || body !== lastSavedRef.current.body;
  // Save is only offered when there's an unsaved change worth keeping. States:
  // grey (nothing new: just opened, or unchanged since the last save), blue
  // (unsaved change), green "Saved" (a save went through, nothing edited since).
  const canSave = isDirty && hasSaveableText && !submitting && canEdit && !conflict;
  const showSaved = !isDirty && hasSaved && !submitting;
  // While editing, the note's own folderId is the source of truth (kept live
  // by NotesContext's optimistic update) — newNoteFolderId only matters
  // before the note exists yet.
  const currentFolderId = editing ? editing.folderId : newNoteFolderId;
  const currentFolderName = currentFolderId ? folders.find((f) => f.id === currentFolderId)?.name : undefined;

  // The note has hit the length limit (the editor itself stops accepting text
  // there): stop dictation, save what's there, and say so once.
  const notifyNoteFull = () => {
    if (warnedMaxLengthRef.current) return;
    warnedMaxLengthRef.current = true;
    // Ending focus is what actually stops OS-level dictation — it has no API
    // for the app to tell it "stop," it just keeps listening as long as the
    // field is focused.
    editor.blur();
    Keyboard.dismiss();
    // The in-app mic button isn't tied to keyboard focus at all, so this is the
    // direct, explicit stop the OS-dictation path above can only approximate.
    if (dictation.recording) dictation.stop();
    runAutosave().finally(() => {
      Alert.alert(
        'Note is full',
        `This note has reached the ${NOTE_BODY_MAX_LENGTH.toLocaleString()}-character limit, so typing and dictation have been stopped here. What you've written has been saved, so start a new note to keep going.`
      );
    });
  };

  const enforceLengthLimit = (stored: string) => {
    if (bodyToPlainText(stored).length < NOTE_BODY_MAX_LENGTH - NOTE_FULL_MARGIN) {
      warnedMaxLengthRef.current = false;
      return;
    }
    notifyNoteFull();
  };

  // Records the note as it stands as the text dictation adds onto.
  const setDictationBase = (stored: string) => {
    dictationBaseHtmlRef.current = bodyToEditorHtml(stored);
    dictationBaseLengthRef.current = bodyToPlainText(stored).length;
    dictationBaseSetRef.current = true;
  };

  // Dictation owns the editor's content while it runs: each update replaces the
  // previous update's text after the original note, so changes made through the
  // editor itself are ignored until it ends.
  const applyDictationText = (liveText: string) => {
    if (!dictationBaseSetRef.current) setDictationBase(bodyRef.current);
    const room = Math.max(0, NOTE_BODY_MAX_LENGTH - dictationBaseLengthRef.current);
    const text = liveText.length > room ? liveText.slice(0, room) : liveText;
    editor.setContent(appendTextToEditorHtml(dictationBaseHtmlRef.current, text));
    if (liveText.length > room) notifyNoteFull();
  };

  const dictation = useDictation({
    onTranscriptChange: (liveText) => {
      dictationActiveRef.current = true;
      if (!baselineReadyRef.current) {
        // The note is still loading: keep what has been said until it is in.
        dictationBufferRef.current = { text: liveText, ended: dictationBufferRef.current?.ended ?? false };
        return;
      }
      applyDictationText(liveText);
    },
    onEnd: () => {
      if (!baselineReadyRef.current) {
        // Stopped before the note loaded: finish up once it has.
        dictationBufferRef.current = { text: dictationBufferRef.current?.text ?? '', ended: true };
        return;
      }
      dictationActiveRef.current = false;
      // Whatever was dictated becomes part of the note.
      suppressUntilRef.current = Date.now() + EDITOR_ECHO_MS;
      syncBodyFromEditor().catch((err) => console.error('[NoteEditor] failed to read dictated text', err));
    },
  });

  // The editor can't be typed into while dictating or while an AI cleanup is
  // waiting on the Keep/Revert choice (Revert restores an exact snapshot taken
  // before Clean ran, so a manual edit during review would be silently lost).
  useEffect(() => {
    if (!editorState.isReady) return;
    editor.setEditable(canEdit && !dictation.recording && cleanupState !== 'reviewing');
    if (!dictation.recording) dictationActiveRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorState.isReady, dictation.recording, cleanupState, canEdit]);

  const handleToggleDictation = async () => {
    if (dictation.recording) {
      dictation.stop();
      return;
    }
    // Starts right away, even if the editor is still loading (see dictationBufferRef).
    dictationBufferRef.current = null;
    dictationBaseSetRef.current = false;
    if (baselineReadyRef.current) setDictationBase(await currentBody());
    dictation.start();
  };

  const handleClean = async () => {
    if (cleanupState !== 'idle' || dictation.recording || !baselineReadyRef.current) return;
    Keyboard.dismiss();
    editor.blur();
    const stored = await currentBody();
    const plain = bodyToPlainText(stored);
    if (!plain.trim()) return;
    preCleanBodyRef.current = stored;
    setCleanupState('loading');
    try {
      // The AI works on the note's text; formatting isn't part of what it
      // returns, so the cleaned version replaces it (Revert brings it back).
      const { cleaned } = await noteService.cleanText(plain);
      await loadEditorHtml(plainTextToEditorHtml(cleaned));
      setCleanupState('reviewing');
    } catch (err) {
      console.error('[NoteEditor] failed to clean note', err);
      setCleanupState('idle');
      Alert.alert("Couldn't clean this note", 'Check your connection and try again.');
    }
  };

  // Shared by the review banner's own buttons (a proactive choice) and the
  // usePreventRemove alert below (a choice forced by trying to leave) —
  // pendingNavActionRef is only ever non-null in the latter case.
  const handleKeepCleaned = () => {
    setCleanupState('idle');
  };

  const handleRevertCleaned = () => {
    restoreBody(preCleanBodyRef.current);
    setCleanupState('idle');
  };

  // Shares the review flow's pendingNavActionRef — same "forced choice on the
  // way out" shape, just for unsaved edits instead of an unresolved AI-cleanup
  // decision. Discarding just rolls title/body back to the last confirmed
  // save, which makes isDirty false by construction — nothing to separately
  // "undo" server-side, since nothing here was ever persisted.
  const handleDiscardChanges = () => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    setTitle(lastSavedRef.current.title);
    restoreBody(lastSavedRef.current.body);
  };

  // Same fallback-title behavior runAutosave already uses — a user who
  // dictated straight into the body and never touched the title shouldn't
  // hit a dead end tapping "Save" here.
  const handleSaveBeforeLeaving = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    try {
      const b = await currentBody();
      const t = title.trim() || deriveFallbackTitle(b);
      if (!t) {
        // Nothing meaningful typed on either field — nothing to lose either way.
        handleDiscardChanges();
        return;
      }
      if (savedId) {
        await updateNote(savedId, { title: t, body: b });
      } else {
        const created = await createNote({ title: t, body: b, folderId: newNoteFolderId });
        setSavedId(created.id);
      }
      lastSavedRef.current = { title: t, body: b };
    } catch (err) {
      console.error('[NoteEditor] failed to save note before leaving', err);
      const latest = latestNoteFromConflict(err);
      if (latest) {
        setConflict(latest);
        Alert.alert('Someone else changed this note', 'Choose whether to load their version or keep yours.');
      } else {
        Alert.alert("Couldn't save", 'Check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
      busyRef.current = false;
    }
  };

  // Replays whatever navigation attempt usePreventRemove blocked — only
  // once a real render has caught up to both cleanupState and isDirty going
  // clear. Dispatching synchronously from inside the various handlers above
  // would still see this hook's stale (not-yet-re-rendered) closure and could
  // block the very same action a second time.
  useEffect(() => {
    if (cleanupState !== 'idle' || isDirty) return;
    if (pendingNavActionRef.current) {
      const action = pendingNavActionRef.current;
      pendingNavActionRef.current = null;
      navigation.dispatch(action);
    }
  }, [cleanupState, isDirty, navigation]);

  usePreventRemove(cleanupState === 'reviewing' || isDirty, ({ data }) => {
    pendingNavActionRef.current = data.action;
    if (cleanupState === 'reviewing') {
      Alert.alert(
        'Keep or revert?',
        'You cleaned this note with AI. Choose which version to keep before leaving.',
        [
          { text: 'Revert to original', onPress: handleRevertCleaned },
          { text: 'Keep cleaned version', onPress: handleKeepCleaned },
        ]
      );
    } else {
      Alert.alert(
        'Save changes?',
        "This note hasn't finished saving yet. Save your changes before leaving, or discard them?",
        [
          { text: 'Discard', style: 'destructive', onPress: handleDiscardChanges },
          { text: 'Save', onPress: handleSaveBeforeLeaving },
        ]
      );
    }
  });

  const handleSave = async () => {
    if (!canSave || busyRef.current) return;
    // See baselineReadyRef: never save before the note's real text is known.
    if (savedIdRef.current && !baselineReadyRef.current) return;
    // Saving means "done typing for now", so put the keyboard away. The editor
    // lives in a WebView, so it has to be blurred itself, not just the keyboard.
    editor.blur();
    Keyboard.dismiss();
    // Tapping Save while an AI-cleanup decision is still unresolved implicitly
    // means "keep this version" — clear the review state so the guard above
    // doesn't intercept this save's own exit and re-litigate a decision Save
    // already made.
    setCleanupState('idle');
    busyRef.current = true;
    setSubmitting(true);
    try {
      const b = await currentBody();
      // Same first-line fallback as autosave for a note with no title.
      const t = title.trim() || deriveFallbackTitle(b);
      if (!t) return;
      if (savedIdRef.current) {
        await updateNote(savedIdRef.current, { title: t, body: b });
      } else {
        // Record the new note's id: the editor stays open after saving now, so
        // the next save must update this note, not create a second one.
        const created = await createNote({ title: t, body: b, folderId: newNoteFolderId });
        savedIdRef.current = created.id;
        setSavedId(created.id);
      }
      lastSavedRef.current = { title: t, body: b };
      if (!title.trim()) setTitle(t);
      // Stays on the screen; the header button turns green "Saved" (and
      // setHasSaved re-renders so isDirty catches up to the ref above).
      setHasSaved(true);
      setAutosaveStatus('saved');
    } catch (err) {
      console.error('[NoteEditor] failed to save note', err);
      const latest = latestNoteFromConflict(err);
      if (latest) setConflict(latest);
      else Alert.alert("Couldn't save", 'Check your connection and try again.');
    } finally {
      setSubmitting(false);
      busyRef.current = false;
    }
  };

  const handleSelectFolder = async (folderId: string | null) => {
    setFolderPickerOpen(false);
    if (savedId) {
      try {
        await updateNote(savedId, { folderId });
      } catch (err) {
        console.error('[NoteEditor] failed to move note', err);
      }
    } else {
      setNewNoteFolderId(folderId ?? undefined);
    }
  };

  const handleDelete = () => {
    if (!editing || !isOwner) return;
    confirmDelete(editing.title, () => {
      isClosingRef.current = true;
      // A deleted note has nothing left to keep, revert, or save — clear both
      // guards before this delete's own router.back() fires. Unlike
      // handleSave, this is safe to do synchronously right here: deleteNote
      // below is a real async call, so cleanupState's flush to 'idle' (and
      // isDirty's own recompute, since lastSavedRef is updated in this same
      // synchronous breath) both land well before .then(() => router.back())
      // ever runs.
      setCleanupState('idle');
      lastSavedRef.current = { title, body };
      deleteNote(editing.id)
        .then(() => router.back())
        .catch((err) => console.error('[NoteEditor] failed to delete note', err));
    });
  };

  const handleSharePdf = async () => {
    if (!editing || sharing) return;
    setSharing(true);
    try {
      // Share what's currently on screen, not the last-saved version — the
      // Share button sits right next to Save, so exporting stale content the
      // instant someone edits and taps Share (before saving) would be wrong.
      await shareNote({ ...editing, title: title.trim() || editing.title, body });
    } finally {
      setSharing(false);
    }
  };

  // Unlike the PDF export above, this goes through the backend — the link it
  // returns always resolves the note's *current* content live (see
  // backend/src/models/SharedNote.ts), so it can't export stale on-screen
  // edits the way the PDF path deliberately avoids. Needs a saved note to
  // point the link at, hence gating on `editing` (derived from `savedId`)
  // rather than just checking `title`/`body` are non-empty.
  const handleShareLink = async () => {
    if (!editing || sharing) return;
    setSharing(true);
    try {
      const { url } = await sharedNoteService.share(editing.id);
      // Exactly one field per platform. iOS shares `message` and `url` as two
      // separate items, so passing both made WhatsApp/Messages paste the link
      // twice. `url` gets iOS's native link preview; Android ignores `url`
      // entirely and only shares `message`.
      await Share.share(Platform.OS === 'ios' ? { url } : { message: url });
    } catch (err) {
      console.error('[NoteEditor] failed to create share link', err);
      Alert.alert("Couldn't create link", 'Check your connection and try again.');
    } finally {
      setSharing(false);
    }
  };

  const handleShare = () => {
    if (!editing || sharing) return;
    setShareMenuOpen(true);
  };

  // ---- Collaboration ---------------------------------------------------------
  // Set once the screen is on its way out (deleted, left, or access lost), so the check
  // below doesn't announce a note as "unavailable" because of the screen's own action.
  const isClosingRef = useRef(false);

  // Makes the server's newer copy of the note what the screen shows AND its last saved state
  // (so it doesn't count as unsaved), without reading the editor back.
  const adoptServerNote = (latest: Note) => {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }
    lastSavedRef.current = { title: latest.title, body: latest.body };
    setTitle(latest.title);
    restoreBody(latest.body);
    applyServerNote(latest);
  };
  const adoptServerNoteRef = useRef(adoptServerNote);
  adoptServerNoteRef.current = adoptServerNote;
  const setSharedRoleRef = useRef(setSharedRole);
  setSharedRoleRef.current = setSharedRole;

  const handleLoadTheirVersion = () => {
    if (!conflict) return;
    adoptServerNote(conflict);
    setConflict(null);
  };

  // Keeps what is on screen: the saved copy is brought up to date (so the next save is based on
  // the latest version), then the save is tried again and replaces their change.
  const handleKeepMine = () => {
    if (!conflict) return;
    applyServerNote(conflict);
    setConflict(null);
    setTimeout(() => runAutosaveRef.current(), 400);
  };

  // Someone invited to this note stepping away from it.
  const handleLeave = () => {
    if (!editing || isOwner) return;
    const noteId = editing.id;
    requestConfirm({
      title: 'Leave this note?',
      message: "You won't be able to open it again unless the owner invites you again.",
      confirmLabel: 'Leave',
      destructive: true,
      onConfirm: () => {
        const previous = lastSavedRef.current;
        isClosingRef.current = true;
        setCleanupState('idle');
        lastSavedRef.current = { title, body };
        leaveSharedNote(noteId)
          .then(() => router.back())
          .catch((err) => {
            console.error('[NoteEditor] failed to leave note', err);
            isClosingRef.current = false;
            lastSavedRef.current = previous;
            Alert.alert("Couldn't leave", 'Check your connection and try again.');
          });
      },
    });
  };

  // Picks up what other people save while this note is open. Skipped while there is anything
  // unsaved here (typing is never overwritten: saving it then reports the conflict instead),
  // while saving, dictating, or reviewing an AI cleanup, and while the app is in the background.
  const remoteCheckStateRef = useRef({ dirty: false, version: 0, cleanup: 'idle' as string, role });
  remoteCheckStateRef.current = { dirty: isDirty, version: editing?.version ?? 0, cleanup: cleanupState, role };
  useEffect(() => {
    if (!savedId) return;
    const timer = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      if (busyRef.current || conflictRef.current || dictationActiveRef.current || remoteCheckStateRef.current.cleanup !== 'idle') return;
      try {
        const { note: latest, role: serverRole } = await collaborationService.getNote(savedId);
        const state = remoteCheckStateRef.current;
        // The owner changed what this person may do (view <-> edit): take effect at once.
        if (serverRole !== 'owner' && state.role !== 'owner' && serverRole !== state.role) {
          setSharedRoleRef.current(savedId, serverRole);
          if (serverRole === 'viewer') {
            // Anything typed but not saved is not kept: a viewer can no longer save it.
            adoptServerNoteRef.current(latest);
            Alert.alert('Your access changed', 'You can now only view this note. Edits you had not saved were not kept.');
          } else {
            Alert.alert('Your access changed', 'You can now edit this note.');
          }
          return;
        }
        if ((latest.version ?? 0) <= state.version || state.dirty || busyRef.current) return;
        adoptServerNoteRef.current(latest);
      } catch (err) {
        if ((err as { status?: number } | null)?.status === 404 && !isClosingRef.current) {
          isClosingRef.current = true;
          Alert.alert('Note unavailable', 'This note was deleted, or you no longer have access to it.', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      }
    }, REMOTE_CHECK_MS);
    return () => clearInterval(timer);
  }, [savedId]);

  return (
    // 'bottom' matters here specifically because of the mic/Clean FABs and the
    // review banner pinned to the bottom of the page card — without it, they
    // sit flush against the physical screen edge and get covered by Android's
    // on-screen nav bar (3-button or gesture pill) on edge-to-edge devices.
    <ScreenWrapper backgroundColor={Colors.offWhite} edges={['top', 'right', 'bottom', 'left']}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" color={Colors.textPrimary} size={20} />
        </Pressable>

        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle} numberOfLines={1}>
            {editing ? (role === 'viewer' ? 'View note' : 'Edit note') : 'New note'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {!!editing && isOwner && (
            <Pressable hitSlop={10} onPress={handleShare} disabled={sharing} style={styles.shareBtn}>
              <IconSymbol name="square.and.arrow.up" color={Colors.textPrimary} size={17} />
            </Pressable>
          )}
          {!!editing && isOwner && (
            <Pressable hitSlop={10} onPress={handleDelete} style={styles.deleteBtn}>
              <IconSymbol name="trash" color={Colors.error} size={17} />
            </Pressable>
          )}
          {!!editing && !isOwner && (
            <Pressable hitSlop={10} onPress={() => setViewPeopleOpen(true)} style={styles.shareBtn} accessibilityLabel="Who has access">
              <IconSymbol name="person.fill" color={Colors.textPrimary} size={17} />
            </Pressable>
          )}
          {!!editing && !isOwner && (
            <Pressable hitSlop={10} onPress={handleLeave} style={styles.deleteBtn} accessibilityLabel="Leave this note">
              <IconSymbol name="rectangle.portrait.and.arrow.right" color={Colors.error} size={17} />
            </Pressable>
          )}
          {canEdit && (
          <Pressable
            hitSlop={10}
            onPress={handleSave}
            disabled={!canSave}
            accessibilityLabel={showSaved ? 'Saved' : 'Save note'}
            style={[styles.saveBtn, showSaved ? styles.saveBtnSaved : !canSave && !submitting && styles.saveBtnDisabled]}
          >
            {showSaved ? (
              <>
                <IconSymbol name="checkmark" color={Colors.white} size={14} />
                <Text style={styles.saveBtnText}>Saved</Text>
              </>
            ) : submitting ? (
              <Text style={styles.saveBtnText}>Saving…</Text>
            ) : (
              <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>Save</Text>
            )}
          </Pressable>
          )}
        </View>
      </View>

      <View style={styles.page}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor={Colors.textMuted}
          style={styles.titleInput}
          multiline
          editable={canEdit}
          autoFocus={!editing}
          maxLength={NOTE_TITLE_MAX_LENGTH}
        />

        <View style={styles.divider} />

        <View style={styles.metaRow}>
          {!!editing && (
            <Text style={styles.metaText} numberOfLines={1}>
              Edited {formatShortDate(editing.updatedAt)} · {formatTimeLabel(new Date(editing.updatedAt))}
              {autosaveStatus === 'saving' ? ' · Saving…' : autosaveStatus === 'saved' ? ' · Saved' : ''}
            </Text>
          )}
          {isOwner ? (
            <Pressable style={styles.folderChip} onPress={() => setFolderPickerOpen(true)} hitSlop={6}>
              <IconSymbol name="folder.fill" color={Colors.primaryLight} size={12} />
              <Text style={styles.folderChipText} numberOfLines={1}>
                {currentFolderName ?? 'No folder'}
              </Text>
              <IconSymbol name="chevron.right" color={Colors.primaryLight} size={11} />
            </Pressable>
          ) : (
            <View style={styles.folderChip}>
              <IconSymbol name="person.fill" color={Colors.primaryLight} size={12} />
              <Text style={styles.folderChipText} numberOfLines={1}>
                {role === 'viewer' ? 'View only' : 'Can edit'}
                {sharedEntry ? ` · from ${sharedEntry.ownerLabel}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.editorWrap}>
          <RichText editor={editor} style={styles.richText} />
        </View>

        {!!conflict && (
          <View style={[styles.reviewBanner, styles.conflictBanner]}>
            <Text style={styles.reviewBannerText}>Someone else changed this note while you were editing. Your changes aren&apos;t saved yet.</Text>
            <View style={styles.reviewBannerActions}>
              <Pressable style={styles.revertBtn} onPress={handleLoadTheirVersion}>
                <Text style={styles.revertBtnText}>Load their version</Text>
              </Pressable>
              <Pressable style={styles.keepBtn} onPress={handleKeepMine}>
                <Text style={styles.keepBtnText}>Keep mine</Text>
              </Pressable>
            </View>
          </View>
        )}

        {!canEdit ? null : cleanupState === 'reviewing' ? (
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>AI cleaned this note (formatting is reset). Read it over, then choose:</Text>
            <View style={styles.reviewBannerActions}>
              <Pressable style={styles.revertBtn} onPress={handleRevertCleaned}>
                <Text style={styles.revertBtnText}>Revert</Text>
              </Pressable>
              <Pressable style={styles.keepBtn} onPress={handleKeepCleaned}>
                <Text style={styles.keepBtnText}>Keep cleaned version</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            <Pressable
              hitSlop={10}
              onPress={handleClean}
              disabled={cleanupState !== 'idle' || dictation.recording || !hasBodyText}
              style={[styles.cleanBtn, (dictation.recording || !hasBodyText) && styles.cleanBtnDisabled]}
            >
              <IconSymbol name="paintbrush.fill" color={Colors.primaryLight} size={16} />
              <Text style={styles.cleanBtnText}>Clean</Text>
            </Pressable>

            <Pressable
              hitSlop={10}
              onPress={handleToggleDictation}
              style={[styles.micFab, dictation.recording && styles.micFabActive]}
            >
              <IconSymbol name="mic.fill" color={dictation.recording ? Colors.white : Colors.primaryLight} size={20} />
            </Pressable>
          </>
        )}
      </View>

      {canEdit && editorState.isFocused && !dictation.recording && cleanupState === 'idle' && <NoteFormatToolbar editor={editor} />}

      <FolderPickerModal
        visible={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        folders={folders}
        selectedId={currentFolderId}
        onSelect={handleSelectFolder}
      />

      <ShareOptionsModal
        visible={shareMenuOpen}
        onClose={() => setShareMenuOpen(false)}
        onSharePdf={handleSharePdf}
        onShareLink={handleShareLink}
        onInvite={isOwner && editing ? () => setPeopleOpen(true) : undefined}
      />

      {!!editing && isOwner && <CollaboratorsSheet visible={peopleOpen} onClose={() => setPeopleOpen(false)} noteId={editing.id} />}
      {!!editing && !isOwner && <NotePeopleSheet visible={viewPeopleOpen} onClose={() => setViewPeopleOpen(false)} noteId={editing.id} />}

      {cleanupState === 'loading' && (
        <View style={styles.cleaningOverlay}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
          <Text style={styles.cleaningOverlayText}>Cleaning your note…</Text>
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  // Sits above the AI-cleanup banner if both ever show at once.
  conflictBanner: {
    zIndex: 5,
    borderColor: Colors.primaryLight,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    position: 'absolute',
    // Not symmetric on purpose: backBtn alone is ~50pt, but headerActions can
    // hold up to 3 buttons (Share+Delete+Save) when editing, ~150pt+padding.
    // A centered title box with equal insets sits closer to the wider side's
    // buttons than to the back button — this keeps the title genuinely
    // centered in the actual free space between the two, not just centered
    // on screen.
    left: 50,
    right: 150,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.offWhite,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    backgroundColor: Colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  saveBtnSaved: {
    backgroundColor: Colors.success,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.border,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  saveBtnTextDisabled: {
    color: Colors.textMuted,
  },
  page: {
    flex: 1,
    marginTop: Spacing.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  titleInput: {
    fontSize: 23,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 14,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  folderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: Colors.infoSoft,
    borderRadius: Radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  folderChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: Colors.primaryLight,
    maxWidth: 120,
  },
  editorWrap: {
    flex: 1,
    marginTop: 14,
    overflow: 'hidden',
  },
  richText: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  micFab: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.md,
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  micFabActive: {
    backgroundColor: Colors.error,
    borderColor: Colors.error,
  },
  cleanBtn: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  cleanBtnDisabled: {
    opacity: 0.4,
  },
  cleanBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  reviewBanner: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    right: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    gap: 12,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  reviewBannerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  revertBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  revertBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  keepBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  keepBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  cleaningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.offWhite,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  cleaningOverlayText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
