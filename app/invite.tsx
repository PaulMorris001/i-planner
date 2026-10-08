import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { openOnTopOf } from '@/utils/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useNotes } from '@/hooks/useNotes';
import { collaborationService } from '@/services/collaboration.service';
import type { InvitePreview } from '@/types/collaboration.types';

type Status = 'loading' | 'ready' | 'unavailable' | 'error';

// Reached via iplanner://invite?token=... from the invitation email's page ("Open in
// i-Planner to accept"). A cold start through a tapped link has no back history, so this
// always routes forward explicitly.
export default function Invite() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { user, initializing } = useAuth();
  const { refetch: refetchNotes } = useNotes();
  const [status, setStatus] = useState<Status>('loading');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [pendingAction, setPendingAction] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initializing || !user || !token) return;
    let cancelled = false;
    collaborationService
      .previewInvite(token)
      .then((data) => {
        if (cancelled) return;
        setInvite(data);
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[Invite] failed to load the invitation', err);
        if (cancelled) return;
        setStatus(err?.status === 404 ? 'unavailable' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [initializing, user, token]);

  const goToNotes = () => router.replace(Routes.NOTES);

  const accept = async () => {
    if (!token || pendingAction) return;
    setPendingAction('accept');
    setError('');
    try {
      const { noteId } = await collaborationService.acceptInvite(token);
      // The note is new to this account: load it before opening, or the editor finds nothing.
      await refetchNotes();
      openOnTopOf(Routes.NOTES, `${Routes.NOTE_EDITOR}?id=${noteId}`);
    } catch (err) {
      console.error('[Invite] failed to accept', err);
      setError((err as { message?: string })?.message || "Couldn't accept the invitation. Try again.");
      setPendingAction(null);
    }
  };

  const decline = async () => {
    if (!token || pendingAction) return;
    setPendingAction('decline');
    setError('');
    try {
      await collaborationService.declineInvite(token);
      Alert.alert('Invitation declined', "You won't get access to this note.");
      goToNotes();
    } catch (err) {
      console.error('[Invite] failed to decline', err);
      setError((err as { message?: string })?.message || "Couldn't decline. Try again.");
      setPendingAction(null);
    }
  };

  if (!token) return <StateScreen icon="link" title="Invalid link" subtitle="This invitation link looks incomplete." onPress={goToNotes} />;

  if (initializing || (user && status === 'loading')) {
    return (
      <ScreenWrapper backgroundColor={Colors.offWhite}>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primaryLight} size="large" />
        </View>
      </ScreenWrapper>
    );
  }

  if (!user) {
    return (
      <StateScreen
        icon="person.fill"
        title="Log in to accept this invitation"
        subtitle="Once you're logged in, open the link in your invitation email again."
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
        title={status === 'unavailable' ? 'This invitation is no longer available' : "Couldn't load this invitation"}
        subtitle={status === 'unavailable' ? 'It may have been cancelled, or the link may be incorrect.' : 'Check your connection and try again.'}
        onPress={goToNotes}
      />
    );
  }

  const data = invite!;
  if (data.isOwner) {
    return <StateScreen icon="info.circle" tone="muted" title="This is your own note" subtitle="You don't need an invitation to open your own note." onPress={goToNotes} />;
  }
  if (data.alreadyYours || data.status === 'accepted') {
    return (
      <StateScreen
        icon="checkmark"
        title={data.alreadyYours ? 'You already have access' : 'This invitation was already used'}
        subtitle={data.alreadyYours ? `"${data.noteTitle}" is in Shared with me.` : 'Ask the sender to invite you again.'}
        actionLabel="Go to Notes"
        onPress={goToNotes}
      />
    );
  }
  if (data.status === 'declined' || data.expired) {
    return (
      <StateScreen
        icon="info.circle"
        tone="muted"
        title={data.expired ? 'This invitation has expired' : 'This invitation was declined'}
        subtitle="Ask the sender to invite you again."
        onPress={goToNotes}
      />
    );
  }

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite}>
      <View style={styles.center}>
        <View style={styles.badge}>
          <IconSymbol name="person.fill" color={Colors.primaryLight} size={26} />
        </View>
        <Text style={styles.eyebrow}>NOTE INVITATION</Text>
        <Text style={styles.title}>{data.inviterLabel} invited you</Text>
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle} numberOfLines={3}>
            {data.noteTitle}
          </Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{data.role === 'editor' ? 'You can view and edit' : 'You can view'}</Text>
          </View>
        </View>
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.primaryBtn} onPress={accept} disabled={!!pendingAction}>
          {pendingAction === 'accept' ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryText}>Accept</Text>}
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={decline} disabled={!!pendingAction}>
          {pendingAction === 'decline' ? <ActivityIndicator color={Colors.textSecondary} size="small" /> : <Text style={styles.secondaryText}>Decline</Text>}
        </Pressable>
      </View>
    </ScreenWrapper>
  );
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
      <View style={styles.center}>
        <View style={[styles.badge, tone === 'muted' && styles.badgeMuted]}>
          <IconSymbol name={icon} color={tone === 'muted' ? Colors.textMuted : Colors.primaryLight} size={26} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Pressable style={[styles.primaryBtn, { alignSelf: 'stretch', marginTop: 12 }]} onPress={onPress}>
          <Text style={styles.primaryText}>{actionLabel}</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: 10 },
  badge: { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.infoSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  badgeMuted: { backgroundColor: Colors.border },
  eyebrow: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.6 },
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', letterSpacing: -0.2 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  noteCard: { alignSelf: 'stretch', backgroundColor: Colors.white, borderRadius: Radius.xl, padding: Spacing.lg, alignItems: 'center', gap: 12, marginTop: 6, borderWidth: 1, borderColor: Colors.border },
  noteTitle: { fontSize: 18, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center' },
  rolePill: { backgroundColor: Colors.infoSoft, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  rolePillText: { fontSize: 12.5, fontWeight: '700', color: Colors.primaryLight },
  error: { fontSize: 13, color: Colors.error, textAlign: 'center', marginTop: 4 },
  footer: { paddingBottom: 4, gap: 4 },
  primaryBtn: { alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.md, backgroundColor: Colors.primaryLight, borderRadius: Radius.full, paddingVertical: 16 },
  primaryText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  secondaryBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  secondaryText: { fontSize: 14.5, fontWeight: '700', color: Colors.textSecondary },
});
