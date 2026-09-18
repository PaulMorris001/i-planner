import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuth } from '@/hooks/useAuth';
import { sharedNoteService } from '@/services/sharedNote.service';
import { Routes } from '@/constants/routes';
import { Colors, Spacing, Radius } from '@/constants/theme';

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
  const [status, setStatus] = useState<Status>('loading');
  const [preview, setPreview] = useState<{ title: string; body: string } | null>(null);
  const [importing, setImporting] = useState(false);

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

  const handleImport = async () => {
    if (!token || importing) return;
    setImporting(true);
    try {
      const created = await sharedNoteService.importNote(token);
      router.replace(`${Routes.NOTE_EDITOR}?id=${created.id}`);
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
      <ScreenWrapper backgroundColor={Colors.offWhite}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Invalid link</Text>
          <Text style={styles.stateSub}>This share link looks incomplete.</Text>
          <Pressable style={styles.primaryBtn} onPress={goToNotes}>
            <Text style={styles.primaryBtnText}>Go to Notes</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  if (initializing) {
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
      <ScreenWrapper backgroundColor={Colors.offWhite}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>Log in to add this note</Text>
          <Text style={styles.stateSub}>
            Once you&apos;re logged in, reopen this link to add the note to your account.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace(Routes.LOGIN)}>
            <Text style={styles.primaryBtnText}>Log In</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  if (status === 'loading') {
    return (
      <ScreenWrapper backgroundColor={Colors.offWhite}>
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (status === 'unavailable' || status === 'error') {
    return (
      <ScreenWrapper backgroundColor={Colors.offWhite}>
        <View style={styles.centerState}>
          <Text style={styles.stateTitle}>
            {status === 'unavailable' ? 'This note is no longer available' : "Couldn't load this note"}
          </Text>
          <Text style={styles.stateSub}>
            {status === 'unavailable'
              ? 'It may have been deleted, or the link may be incorrect.'
              : 'Check your connection and try again.'}
          </Text>
          <Pressable style={styles.primaryBtn} onPress={goToNotes}>
            <Text style={styles.primaryBtnText}>Go to Notes</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <PageHeader title="Shared note" subtitle="Add a copy to your own notes" />

      <View style={styles.card}>
        <Text style={styles.title}>{preview!.title}</Text>
        {preview!.body.trim() ? (
          <Text style={styles.body}>{preview!.body}</Text>
        ) : (
          <Text style={[styles.body, styles.bodyEmpty]}>No additional text</Text>
        )}
      </View>

      <Pressable style={styles.primaryBtn} onPress={handleImport} disabled={importing}>
        <Text style={styles.primaryBtnText}>{importing ? 'Adding…' : 'Add to My Notes'}</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={goToNotes}>
        <Text style={styles.secondaryBtnText}>Not now</Text>
      </Pressable>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: 10,
  },
  stateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stateSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  card: {
    marginTop: 16,
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  body: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textPrimary,
  },
  bodyEmpty: {
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  primaryBtn: {
    marginTop: 24,
    marginHorizontal: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.full,
    paddingVertical: 15,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  secondaryBtn: {
    marginTop: 12,
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
});
