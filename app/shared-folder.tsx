import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { openOnTopOf } from '@/utils/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFolders } from '@/hooks/useFolders';
import { useNotes } from '@/hooks/useNotes';
import {
  sharedFolderService,
  type ExistingFolderReason,
  type SharedFolderPreview,
} from '@/services/sharedFolder.service';

type Status = 'loading' | 'ready' | 'unavailable' | 'error';

// Reached via iplanner://shared-folder?token=... after tapping "Open in i-Planner" on the
// web preview page (backend/src/services/sharedFolderHtml.ts). Like the shared-note
// screen it can be a cold start with no back history, so it always routes forward.
export default function SharedFolder() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { user, initializing } = useAuth();
  const { refetch: refetchNotes } = useNotes();
  const { refetch: refetchFolders } = useFolders();
  const [status, setStatus] = useState<Status>('loading');
  const [preview, setPreview] = useState<SharedFolderPreview | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (initializing || !user || !token) return;
    let cancelled = false;
    sharedFolderService
      .getPreview(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[SharedFolder] failed to load preview', err);
        if (cancelled) return;
        setStatus(err?.status === 404 ? 'unavailable' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [initializing, user, token]);

  const goToNotes = () => router.replace(Routes.NOTES);

  // The folder was just created server-side, but the app's own folder and note lists
  // don't know yet (this bypassed their create calls): refresh them first, or the folder
  // would open blank.
  const openFolder = async (folderId: string) => {
    await Promise.all([refetchFolders(), refetchNotes()]);
    openOnTopOf(Routes.NOTES, `${Routes.NOTES_FOLDER}?id=${folderId}`);
  };

  const handleAdd = async () => {
    if (!token || adding) return;
    setAdding(true);
    setAddError('');
    try {
      const result = await sharedFolderService.importFolder(token);
      if (result.alreadyImported) {
        // Raced with another add, or it turned out to be theirs already: show the plain message.
        setPreview((p) => (p ? { ...p, existing: { folderId: result.folderId, reason: result.reason ?? 'imported' } } : p));
        setAdding(false);
        return;
      }
      await openFolder(result.folderId!);
      if (result.skipped > 0) {
        Alert.alert(
          'Folder added',
          `${result.added} note${result.added === 1 ? '' : 's'} added. ${result.skipped} you already had ${result.skipped === 1 ? 'was' : 'were'} left out.`
        );
      }
    } catch (err) {
      console.error('[SharedFolder] failed to add folder', err);
      setAddError(err instanceof Error && err.message ? err.message : "Couldn't add the folder. Try again.");
      setAdding(false);
    }
  };

  if (!token) {
    return <StateScreen icon="link" title="Invalid link" subtitle="This share link looks incomplete." onPress={goToNotes} />;
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
        title="Log in to add this folder"
        subtitle="Once you're logged in, reopen this link to add the folder to your account."
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
        title={status === 'unavailable' ? 'This folder is no longer available' : "Couldn't load this folder"}
        subtitle={status === 'unavailable' ? 'It may have been deleted, or the link may be incorrect.' : 'Check your connection and try again.'}
        onPress={goToNotes}
      />
    );
  }

  const data = preview!;
  const counts =
    `${data.noteCount} note${data.noteCount === 1 ? '' : 's'}` +
    (data.folderCount ? ` · ${data.folderCount} subfolder${data.folderCount === 1 ? '' : 's'}` : '');

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowIcon}>
            <IconSymbol name="link" color={Colors.primaryLight} size={14} />
          </View>
          <Text style={styles.eyebrowText}>Shared folder</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardIconBadge}>
            <IconSymbol name="folder.fill" color={Colors.primaryLight} size={24} />
          </View>
          <Text style={styles.title}>{data.name}</Text>
          <Text style={styles.counts}>{counts}</Text>
          <View style={styles.divider} />

          {data.sections.map((section, index) => (
            <View key={index} style={[styles.section, { marginLeft: Math.min(section.depth, 4) * 14 }]}>
              {section.depth > 0 && (
                <View style={styles.sectionHeader}>
                  <IconSymbol name="folder.fill" color={Colors.textMuted} size={14} />
                  <Text style={styles.sectionName}>{section.name}</Text>
                </View>
              )}
              {section.notes.map((title, i) => (
                <Text key={i} style={styles.noteTitle} numberOfLines={1}>
                  {title}
                </Text>
              ))}
              {section.moreNotes > 0 && <Text style={styles.more}>and {section.moreNotes} more</Text>}
              {section.notes.length === 0 && section.moreNotes === 0 && <Text style={styles.more}>No notes</Text>}
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {data.existing ? (
          <>
            {/* Nothing to add: the account already has this folder or all of its notes. */}
            <Text style={styles.notice}>{existingMessage(data.existing.reason)}</Text>
            <Pressable
              style={[styles.primaryBtn, styles.footerPrimaryBtn]}
              onPress={() => (data.existing!.folderId ? openFolder(data.existing!.folderId) : goToNotes())}
            >
              <Text style={styles.primaryBtnText}>{data.existing.folderId ? 'Open My Folder' : 'Back to Notes'}</Text>
            </Pressable>
          </>
        ) : data.tooLarge ? (
          <>
            <Text style={styles.notice}>This folder is too large to add (up to 100 notes and 50 folders).</Text>
            <Pressable style={[styles.primaryBtn, styles.footerPrimaryBtn]} onPress={goToNotes}>
              <Text style={styles.primaryBtnText}>Back to Notes</Text>
            </Pressable>
          </>
        ) : (
          <>
            {!!addError && <Text style={[styles.notice, styles.noticeError]}>{addError}</Text>}
            <Pressable style={[styles.primaryBtn, styles.footerPrimaryBtn]} onPress={handleAdd} disabled={adding}>
              {adding ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <IconSymbol name="plus" color={Colors.white} size={16} />
                  <Text style={styles.primaryBtnText}>Add Folder to My Notes</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={goToNotes}>
              <Text style={styles.secondaryBtnText}>Not now</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}

function existingMessage(reason: ExistingFolderReason): string {
  if (reason === 'own') return 'This is your own folder, so it is already in your notes.';
  if (reason === 'same') return 'You already have every note in this folder.';
  return "You've already added this folder to your notes.";
}

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
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 24, paddingTop: Spacing.lg },
  footer: {
    backgroundColor: Colors.offWhite,
    paddingTop: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  footerPrimaryBtn: { marginTop: 0 },
  notice: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', lineHeight: 19, marginHorizontal: Spacing.md, marginBottom: 12 },
  noticeError: { color: Colors.error },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: 10 },
  stateIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stateIconBadgeMuted: { backgroundColor: Colors.border },
  stateTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.2 },
  stateSub: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.md, marginBottom: 14 },
  eyebrowIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrowText: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
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
  title: { fontSize: 22, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.4 },
  counts: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginTop: 14, marginBottom: 4 },
  section: { marginTop: 12 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  sectionName: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  noteTitle: { fontSize: 14, color: Colors.textPrimary, paddingVertical: 5 },
  more: { fontSize: 12.5, color: Colors.textMuted, fontStyle: 'italic', paddingVertical: 3 },
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
  primaryBtnText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  secondaryBtn: { marginTop: 6, marginHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  secondaryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
});
