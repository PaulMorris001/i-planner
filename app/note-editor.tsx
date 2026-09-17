import { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert, Keyboard, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { FolderPickerModal } from '@/components/notes/FolderPickerModal';
import { Colors, Spacing, Radius } from '@/constants/theme';
import { useNotes } from '@/hooks/useNotes';
import { useFolders } from '@/hooks/useFolders';
import { useDictation, joinDictationText } from '@/hooks/useDictation';
import { noteService } from '@/services/note.service';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate, formatTimeLabel } from '@/utils/date';
import { shareNote } from '@/utils/exportNote';

// Keep in sync with backend/src/controllers/note.controller.ts's
// NOTE_BODY_MAX_LENGTH — this bounds it at entry (nicer UX, an inline cap
// instead of a save-time rejection), the backend enforces it regardless (a
// stale/old client build, or the API called directly, shouldn't be able to
// bypass it). Generous for any real note, but bounds how large a single
// note's text can ever get — see notes.tsx's previewText for why that matters:
// an unbounded body rendered into a <Text> builds a proportionally large
// AttributedString/text-fragment tree, and a large enough one has caused a
// real, confirmed stack-overflow crash when that tree was later torn down.
//
// `maxLength` alone isn't a hard enough stop for this: a confirmed crash came
// from a ~1.5hr keyboard-dictation session that (per the crash log) kept
// feeding text into this field well past what a single onChangeText/clip
// cycle can reliably keep up with under load. handleBodyChange below adds an
// active stop — truncate, blur (which ends iOS/Android dictation, since it
// needs focus), and tell the user — instead of just trusting the prop.
const NOTE_BODY_MAX_LENGTH = 20_000;

// How often the in-progress note is saved in the background, so a crash (or
// just navigating back without tapping Save) loses at most one interval's
// worth of typing/dictation instead of the whole note — see the crash where a
// ~1.5hr dictation session was lost entirely because nothing was persisted
// until the user explicitly hit Save.
const AUTOSAVE_INTERVAL_MS = 8_000;

// A title is required to save at all (see canSave/backend validation), but an
// autosave shouldn't be blocked just because the user dictated straight into
// the body and never touched the title field — that's exactly the scenario
// that caused the original data loss. Falls back to the first line of the
// body, matching the convention most notes apps use for an untitled note.
function deriveFallbackTitle(body: string): string {
  const firstLine = body.trim().split('\n')[0]?.trim() ?? '';
  if (!firstLine) return '';
  return firstLine.length > 60 ? firstLine.slice(0, 60) : firstLine;
}

// Full page, not a sheet — a note deserves the whole screen to write in, unlike
// the short forms every other "New X" flow in this app uses. `id` (querystring,
// not a dynamic route segment) is absent when creating a new note.
export default function NoteEditor() {
  // `folderId` is only read on the create path (from notes-folder.tsx's "New
  // note" button) — once a note exists, its own `folderId` field is the
  // source of truth instead.
  const { id, folderId: folderIdParam } = useLocalSearchParams<{ id?: string; folderId?: string }>();
  const { notes, createNote, updateNote, deleteNote } = useNotes();
  const { folders } = useFolders();
  const navigation = useNavigation();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [newNoteFolderId, setNewNoteFolderId] = useState<string | undefined>(folderIdParam);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sharing, setSharing] = useState(false);
  // 'loading': AI request in flight. 'reviewing': cleaned text is showing in
  // `body` and the user hasn't yet chosen to keep it or revert.
  const [cleanupState, setCleanupState] = useState<'idle' | 'loading' | 'reviewing'>('idle');
  // Starts as the route param (editing an existing note) and is filled in by
  // the first autosave once a brand-new note gets its real id — from then on
  // this, not the route param, is what every save/delete/share/move targets.
  const [savedId, setSavedId] = useState<string | undefined>(id);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const editing = savedId ? notes.find((n) => n.id === savedId) ?? null : null;

  const bodyInputRef = useRef<TextInput>(null);
  const warnedMaxLengthRef = useRef(false);
  // Snapshot of `body` taken the instant dictation starts — each dictation
  // "result" event carries the whole utterance recognized so far, not a
  // delta, so the live text replaces (not appends to) whatever was already
  // there before this snapshot was taken.
  const dictationBaseTextRef = useRef('');
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
  // True while any save (autosave or manual) is in flight, so the two can
  // never race each other into creating the same not-yet-saved note twice.
  const busyRef = useRef(false);
  const lastSavedRef = useRef<{ title: string; body: string }>({ title: '', body: '' });

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setBody(editing.body);
      lastSavedRef.current = { title: editing.title, body: editing.body };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Persists whatever's currently typed if it differs from the last save.
  // Shared by the autosave interval and the max-length hard stop. Takes an
  // optional override so the max-length stop can force-save the just-truncated
  // text immediately — the refs it'd otherwise read from only catch up to a
  // setState on the next render, one render too late for that case.
  const runAutosave = async (override?: { body?: string }) => {
    if (busyRef.current) return;
    const b = override?.body ?? bodyRef.current;
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
      setAutosaveStatus('saved');
    } catch (err) {
      console.error('[NoteEditor] autosave failed', err);
      setAutosaveStatus('idle');
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

  const canSave = title.trim().length > 0 && !submitting;
  // While editing, the note's own folderId is the source of truth (kept live
  // by NotesContext's optimistic update) — newNoteFolderId only matters
  // before the note exists yet.
  const currentFolderId = editing ? editing.folderId : newNoteFolderId;
  const currentFolderName = currentFolderId ? folders.find((f) => f.id === currentFolderId)?.name : undefined;

  const handleBodyChange = (text: string) => {
    if (text.length < NOTE_BODY_MAX_LENGTH) {
      warnedMaxLengthRef.current = false;
      setBody(text);
      return;
    }
    // Defense in depth alongside the TextInput's own maxLength prop — under a
    // long dictation session that prop alone wasn't enough to stop the app
    // from receiving far more text than this ever clipped to (see the
    // stack-overflow crash this guards against, above).
    const truncated = text.slice(0, NOTE_BODY_MAX_LENGTH);
    setBody(truncated);
    if (warnedMaxLengthRef.current) return;
    warnedMaxLengthRef.current = true;
    // Ending focus is what actually stops OS-level dictation — it has no API
    // for the app to tell it "stop," it just keeps listening as long as this
    // field is focused.
    bodyInputRef.current?.blur();
    Keyboard.dismiss();
    // The in-app mic button (below) isn't tied to keyboard focus at all, so
    // blurring/dismissing the keyboard above does nothing to it — this is the
    // direct, explicit stop the OS-dictation path above can only approximate.
    if (dictation.recording) dictation.stop();
    runAutosave({ body: truncated }).finally(() => {
      Alert.alert(
        'Note is full',
        `This note has reached the ${NOTE_BODY_MAX_LENGTH.toLocaleString()}-character limit, so typing and dictation have been stopped here. What you've written has been saved — start a new note to keep going.`
      );
    });
  };

  const dictation = useDictation({
    onTranscriptChange: (liveText) => {
      handleBodyChange(joinDictationText(dictationBaseTextRef.current, liveText));
    },
  });

  const handleToggleDictation = () => {
    if (dictation.recording) {
      dictation.stop();
    } else {
      dictationBaseTextRef.current = body;
      dictation.start();
    }
  };

  const handleClean = async () => {
    if (cleanupState !== 'idle' || dictation.recording || !body.trim()) return;
    Keyboard.dismiss();
    preCleanBodyRef.current = body;
    setCleanupState('loading');
    try {
      const { cleaned } = await noteService.cleanText(body);
      handleBodyChange(cleaned);
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
    handleBodyChange(preCleanBodyRef.current);
    setCleanupState('idle');
  };

  // Replays whatever navigation attempt usePreventRemove blocked, but only
  // after `cleanupState` has actually finished flushing to 'idle' — dispatching
  // it synchronously inside handleKeepCleaned/handleRevertCleaned would still
  // see the hook's stale (not-yet-re-rendered) `reviewing` closure and could
  // block the very same action a second time.
  useEffect(() => {
    if (cleanupState === 'idle' && pendingNavActionRef.current) {
      const action = pendingNavActionRef.current;
      pendingNavActionRef.current = null;
      navigation.dispatch(action);
    }
  }, [cleanupState, navigation]);

  usePreventRemove(cleanupState === 'reviewing', ({ data }) => {
    pendingNavActionRef.current = data.action;
    Alert.alert(
      'Keep or revert?',
      'You cleaned this note with AI. Choose which version to keep before leaving.',
      [
        { text: 'Revert to original', onPress: handleRevertCleaned },
        { text: 'Keep cleaned version', onPress: handleKeepCleaned },
      ]
    );
  });

  const handleSave = async () => {
    if (!canSave || busyRef.current) return;
    busyRef.current = true;
    setSubmitting(true);
    try {
      const t = title.trim();
      if (savedId) {
        await updateNote(savedId, { title: t, body });
      } else {
        await createNote({ title: t, body, folderId: newNoteFolderId });
      }
      lastSavedRef.current = { title: t, body };
      router.back();
    } catch (err) {
      console.error('[NoteEditor] failed to save note', err);
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
    if (!editing) return;
    confirmDelete(editing.title, () => {
      // A deleted note has nothing left to keep or revert — clear this first
      // so the usePreventRemove guard below doesn't fire for the router.back()
      // this delete is about to trigger.
      setCleanupState('idle');
      deleteNote(editing.id)
        .then(() => router.back())
        .catch((err) => console.error('[NoteEditor] failed to delete note', err));
    });
  };

  const handleShare = async () => {
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

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} edges={['top', 'right', 'left']}>
      <View style={styles.headerRow}>
        <Pressable hitSlop={10} onPress={() => router.back()} style={styles.backBtn}>
          <IconSymbol name="chevron.left" color={Colors.textPrimary} size={20} />
        </Pressable>

        <View style={styles.headerTitleWrap} pointerEvents="none">
          <Text style={styles.headerTitle} numberOfLines={1}>
            {editing ? 'Edit note' : 'New note'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          {!!editing && (
            <Pressable hitSlop={10} onPress={handleShare} disabled={sharing} style={styles.shareBtn}>
              <IconSymbol name="square.and.arrow.up" color={Colors.textPrimary} size={17} />
            </Pressable>
          )}
          {!!editing && (
            <Pressable hitSlop={10} onPress={handleDelete} style={styles.deleteBtn}>
              <IconSymbol name="trash" color={Colors.error} size={17} />
            </Pressable>
          )}
          <Pressable
            hitSlop={10}
            onPress={handleSave}
            disabled={!canSave}
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          >
            <Text style={[styles.saveBtnText, !canSave && styles.saveBtnTextDisabled]}>Save</Text>
          </Pressable>
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
          autoFocus={!editing}
        />

        <View style={styles.divider} />

        {!!editing && (
          <Text style={styles.metaText}>
            Edited {formatShortDate(editing.updatedAt)} · {formatTimeLabel(new Date(editing.updatedAt))}
            {autosaveStatus === 'saving' ? ' · Saving…' : autosaveStatus === 'saved' ? ' · Saved' : ''}
          </Text>
        )}

        <Pressable style={styles.folderRow} onPress={() => setFolderPickerOpen(true)} hitSlop={6}>
          <IconSymbol name="folder.fill" color={Colors.textMuted} size={15} />
          <Text style={styles.folderRowText} numberOfLines={1}>
            {currentFolderName ?? 'No folder'}
          </Text>
          <IconSymbol name="chevron.right" color={Colors.textMuted} size={14} />
        </Pressable>

        <TextInput
          ref={bodyInputRef}
          value={body}
          onChangeText={handleBodyChange}
          placeholder="Write something…"
          placeholderTextColor={Colors.textMuted}
          style={styles.bodyInput}
          multiline
          textAlignVertical="top"
          maxLength={NOTE_BODY_MAX_LENGTH}
        />

        {cleanupState === 'reviewing' ? (
          <View style={styles.reviewBanner}>
            <Text style={styles.reviewBannerText}>AI cleaned this note — read it over, then choose:</Text>
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
              disabled={cleanupState !== 'idle' || dictation.recording || !body.trim()}
              style={[styles.cleanBtn, (dictation.recording || !body.trim()) && styles.cleanBtnDisabled]}
            >
              <IconSymbol name="sparkles" color={Colors.primaryLight} size={16} />
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

      <FolderPickerModal
        visible={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        folders={folders}
        selectedId={currentFolderId}
        onSelect={handleSelectFolder}
      />

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
    left: 50,
    right: 50,
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
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: 18,
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
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 10,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  folderRowText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  bodyInput: {
    flex: 1,
    marginTop: 14,
    fontSize: 16,
    lineHeight: 23,
    color: Colors.textPrimary,
    padding: 0,
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
