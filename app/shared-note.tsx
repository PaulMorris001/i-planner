import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { sharedNoteService } from '@/services/sharedNote.service';
import { Routes } from '@/constants/routes';
import { Colors, Spacing, Radius } from '@/constants/theme';
import type { Note } from '@/types/note.types';

type Status = 'loading' | 'ready' | 'unavailable' | 'error';

// Reached via iplanner://shared-note?token=... (expo-router auto-routes an
// incoming scheme URL to the matching file-based route — no separate Linking
// listener needed) after tapping "Open in i-Planner" on the web preview page
// (backend/src/services/sharedNoteHtml.ts). Not necessarily reached from
// inside the app's own navigation stack — a cold start via a tapped link has
// no back history, so this deliberately never relies on router.back(),
// always routing forward/explicitly instead.
export default function SharedNote() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { user, initializing } = useAuth();
  const { refetch: refetchNotes } = useNotes();
  const [status, setStatus] = useState<Status>('loading');
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [alreadyImportedNote, setAlreadyImportedNote] = useState<Note | null>(null);

  useEffect(() => {
    if (initializing || !user || !token) return;
    let cancelled = false;
    sharedNoteService
      .getPreview(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[SharedNote] failed to load preview', err);
        if (cancelled) return;
        setStatus(err?.status === 404 ? 'unavailable' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [initializing, user, token]);

  const openNote = async (noteId: string) => {
    // The note was just created/found server-side, but NotesContext's own
    // local `notes` array (what note-editor.tsx's `editing` lookup reads
    // from) has no idea it exists yet — this bypassed NotesContext's own
    // createNote entirely, so nothing updated it. Without this, note-editor
    // opens to an id it can't find locally and just renders blank.
    await refetchNotes();
    router.replace(`${Routes.NOTE_EDITOR}?id=${noteId}`);
  };

  const handleImport = async () => {
    if (!token || importing) return;
    setImporting(true);
    try {
      const { alreadyImported, note } = await sharedNoteService.importNote(token);
      if (alreadyImported) {
        setImporting(false);
        setAlreadyImportedNote(note);
        return;
      }
      await openNote(note.id);
    } catch (err) {
      console.error('[SharedNote] failed to import note', err);
      setStatus('error');
      setImporting(false);
    }
  };

  // A shared note is a Notes-specific action — land back on the Notes list,
  // not the general Dashboard, wherever this screen bails out.
  const goToNotes = () => router.replace(Routes.NOTES);

  if (!token) {
    return (
      <StateScreen icon="link" title="Invalid link" subtitle="This share link looks incomplete." onPress={goToNotes} />
    );
  }

  if (initializing || (user && status === 'loading')) {
    return (
      <ScreenWrapper backgroundColor={Colors.offWhite}>
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (!user) {
    return (
      <StateScreen
        icon="person.fill"
        title="Log in to add this note"
        subtitle="Once you're logged in, reopen this link to add the note to your account."
        actionLabel="Log In"
        onPress={() => router.replace(Routes.LOGIN)}
      />
    );
  }

  if (status === 'unavailable' || status === 'error') {
    return (
      <StateScreen
        icon="info.circle"
        tone="muted"
        title={status === 'unavailable' ? 'This note is no longer available' : "Couldn't load this note"}
        subtitle={
          status === 'unavailable'
            ? 'It may have been deleted, or the link may be incorrect.'
            : 'Check your connection and try again.'
        }
        onPress={goToNotes}
      />
    );
  }

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <View style={styles.eyebrowRow}>
        <View style={styles.eyebrowIcon}>
          <IconSymbol name="link" color={Colors.primaryLight} size={14} />
        </View>
        <Text style={styles.eyebrowText}>Shared note</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardIconBadge}>
          <IconSymbol name="note.text" color={Colors.primaryLight} size={24} />
        </View>
        <Text style={styles.title}>{preview!.title}</Text>
        <View style={styles.divider} />
        {preview!.body.trim() ? (
          <Text style={styles.body}>{preview!.body}</Text>
        ) : (
          <Text style={[styles.body, styles.bodyEmpty]}>No additional text</Text>
        )}
      </View>

      <Pressable style={styles.primaryBtn} onPress={handleImport} disabled={importing}>
        {importing ? (
          <ActivityIndicator color={Colors.white} size="small" />
        ) : (
          <>
            <IconSymbol name="plus" color={Colors.white} size={16} />
            <Text style={styles.primaryBtnText}>Add to My Notes</Text>
          </>
        )}
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={goToNotes}>
        <Text style={styles.secondaryBtnText}>Not now</Text>
      </Pressable>

      <BottomSheetModal visible={!!alreadyImportedNote} onClose={() => setAlreadyImportedNote(null)}>
        <View style={styles.modalContent}>
          <View style={styles.modalIconBadge}>
            <IconSymbol name="checkmark" color={Colors.success} size={22} />
          </View>
          <Text style={styles.modalTitle}>Already added</Text>
          <Text style={styles.modalSub}>You&apos;ve already added this note to your notes.</Text>
          <View style={styles.modalActions}>
            <Pressable style={styles.modalCloseBtn} onPress={() => setAlreadyImportedNote(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
            <Pressable
              style={styles.modalOpenBtn}
              onPress={() => {
                const note = alreadyImportedNote;
                setAlreadyImportedNote(null);
                if (note) openNote(note.id);
              }}
            >
              <Text style={styles.modalOpenText}>Open Note</Text>
            </Pressable>
          </View>
        </View>
      </BottomSheetModal>
    </ScreenWrapper>
  );
}

// Shared shell for the invalid-link / login-required / unavailable / error
// states — a centered icon badge, title/subtitle, and one CTA pill.
function StateScreen({
  icon,
  tone = 'brand',
  title,
  subtitle,
  actionLabel = 'Go to Notes',
  onPress,
}: {
  icon: IconSymbolName;
  tone?: 'brand' | 'muted';
  title: string;
  subtitle: string;
  actionLabel?: string;
  onPress: () => void;
}) {
  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <View style={styles.centerState}>
        <View style={[styles.stateIconBadge, tone === 'muted' && styles.stateIconBadgeMuted]}>
          <IconSymbol name={icon} color={tone === 'muted' ? Colors.textMuted : Colors.primaryLight} size={26} />
        </View>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateSub}>{subtitle}</Text>
        <Pressable style={styles.primaryBtn} onPress={onPress}>
          <Text style={styles.primaryBtnText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    paddingTop: Spacing.lg,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  stateIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stateIconBadgeMuted: {
    backgroundColor: Colors.border,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  stateSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 6,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: Spacing.md,
    marginBottom: 14,
  },
  eyebrowIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  card: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  cardIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginTop: 14,
  },
  body: {
    marginTop: 14,
    fontSize: 15,
    lineHeight: 23,
    color: Colors.textPrimary,
  },
  bodyEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: 16,
    shadowColor: Colors.primaryLight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  secondaryBtn: {
    marginTop: 14,
    marginHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalContent: {
    alignItems: 'center',
    paddingBottom: 4,
  },
  modalIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  modalSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  modalCloseBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  modalCloseText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalOpenBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
  },
  modalOpenText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
