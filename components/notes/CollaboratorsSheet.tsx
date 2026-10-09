import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Spacing } from '@/constants/theme';
import { collaborationService } from '@/services/collaboration.service';
import type { CollabRole, NotePerson } from '@/types/collaboration.types';

interface CollaboratorsSheetProps {
  visible: boolean;
  onClose: () => void;
  noteId: string;
}

const ROLE_LABEL: Record<CollabRole, string> = { viewer: 'Can view', editor: 'Can edit' };

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : (err as { message?: string } | null)?.message || fallback;
}

// "People with access" for a note the signed-in account owns: the owner (you) and everyone
// invited, each with their access status. Invite someone by email with a permission (view or
// edit), change a person's permission, resend an invitation, or remove someone. Invited
// people accept or decline from the email.
export function CollaboratorsSheet({ visible, onClose, noteId }: CollaboratorsSheetProps) {
  const [people, setPeople] = useState<NotePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CollabRole>('editor');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null);
  // The row currently being changed (resend / role / remove), so it can show a spinner.
  const [busyPersonId, setBusyPersonId] = useState<string | null>(null);
  // The row asking "are you sure?" before cancelling an invitation / removing access. Asked inline,
  // because a separate confirm popup can't open on top of this sheet (iOS ignores it).
  const [confirmingPersonId, setConfirmingPersonId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      setPeople((await collaborationService.people(noteId)).people);
    } catch (err) {
      console.error('[CollaboratorsSheet] failed to load people', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (!visible) return;
    setEmail('');
    setMessage(null);
    setConfirmingPersonId(null);
    load();
  }, [visible, load]);

  const handleInvite = async () => {
    const address = email.trim();
    if (!address || sending) return;
    setSending(true);
    setMessage(null);
    try {
      await collaborationService.invite(noteId, address, role);
      setEmail('');
      setMessage({ text: `Invitation sent to ${address.toLowerCase()}.`, tone: 'ok' });
      await load();
    } catch (err) {
      setMessage({ text: errorMessage(err, "Couldn't send the invitation."), tone: 'error' });
    } finally {
      setSending(false);
    }
  };

  const runPersonAction = async (personId: string, action: () => Promise<unknown>, failure: string) => {
    setBusyPersonId(personId);
    setMessage(null);
    try {
      await action();
      await load();
    } catch (err) {
      setMessage({ text: errorMessage(err, failure), tone: 'error' });
    } finally {
      setBusyPersonId(null);
    }
  };

  // Changes what an accepted person may do. They are told by a notification, and an open copy of
  // the note switches over on its own.
  const handleChangeRole = async (person: NotePerson) => {
    const id = person.id;
    if (!id) return;
    const newRole: CollabRole = person.role === 'editor' ? 'viewer' : 'editor';
    await runPersonAction(id, () => collaborationService.changeRole(noteId, id, newRole), "Couldn't change that.");
    setMessage((current) => current ?? { text: `${person.label} can now ${newRole === 'editor' ? 'edit' : 'only view'} this note. They've been notified.`, tone: 'ok' });
  };

  const handleRemove = (person: NotePerson) => {
    const id = person.id;
    if (!id) return;
    setConfirmingPersonId(null);
    runPersonAction(id, () => collaborationService.remove(noteId, id), "Couldn't remove them.");
  };

  const describeAccess = (p: NotePerson): string => {
    if (p.status === 'accepted') return ROLE_LABEL[p.role];
    if (p.status === 'declined') return 'Declined';
    if (p.expired) return 'Invitation expired';
    return `Invited · ${ROLE_LABEL[p.role].toLowerCase()}`;
  };

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={88}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>People with access</Text>
        <Text style={styles.hint}>Invite someone by email. They get a link to accept or decline, and you choose what they can do.</Text>

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="name@example.com"
          placeholderTextColor={Colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          onSubmitEditing={handleInvite}
          returnKeyType="send"
        />

        <View style={styles.roleRow}>
          {(['editor', 'viewer'] as CollabRole[]).map((value) => (
            <Pressable key={value} style={[styles.roleChip, role === value && styles.roleChipActive]} onPress={() => setRole(value)}>
              <Text style={[styles.roleChipText, role === value && styles.roleChipTextActive]}>{ROLE_LABEL[value]}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable style={[styles.sendButton, (!email.trim() || sending) && styles.sendButtonDisabled]} onPress={handleInvite} disabled={!email.trim() || sending}>
          {sending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.sendText}>Send invitation</Text>}
        </Pressable>

        {!!message && <Text style={[styles.message, message.tone === 'error' ? styles.messageError : styles.messageOk]}>{message.text}</Text>}

        <Text style={[styles.label, { marginTop: 22 }]}>WHO HAS ACCESS</Text>

        {/* The owner is always first: this account. */}
        <View style={styles.memberRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberEmail}>You</Text>
            <Text style={styles.memberStatus}>Owner · full access</Text>
          </View>
        </View>

        {loading && people.length === 0 ? (
          <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: 12 }} />
        ) : loadFailed ? (
          <Pressable onPress={load}>
            <Text style={styles.retry}>Couldn&apos;t load the list. Tap to try again.</Text>
          </Pressable>
        ) : people.length === 0 ? (
          <Text style={styles.empty}>Nobody else yet.</Text>
        ) : (
          people.map((p) => (
            <View key={p.id ?? p.label} style={styles.memberRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {p.label}
                </Text>
                {!!p.email && p.email !== p.label && (
                  <Text style={styles.memberEmailSub} numberOfLines={1}>
                    {p.email}
                  </Text>
                )}
                <Text style={[styles.memberStatus, (p.status === 'declined' || p.expired) && styles.memberStatusMuted]}>{describeAccess(p)}</Text>
              </View>
              {busyPersonId === p.id ? (
                <ActivityIndicator color={Colors.primaryLight} size="small" />
              ) : confirmingPersonId === p.id ? (
                <View style={styles.memberActions}>
                  <Text style={styles.confirmText}>{p.status === 'accepted' ? 'Remove access?' : 'Cancel invitation?'}</Text>
                  <View style={styles.confirmButtons}>
                    <Pressable hitSlop={8} onPress={() => setConfirmingPersonId(null)}>
                      <Text style={styles.action}>Keep</Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={() => handleRemove(p)}>
                      <Text style={styles.actionDanger}>Yes</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                !!p.id && (
                  <View style={styles.memberActions}>
                    {p.status === 'accepted' && (
                      <Pressable
                        hitSlop={6}
                        onPress={() => handleChangeRole(p)}
                      >
                        <Text style={styles.action}>{p.role === 'editor' ? 'Make viewer' : 'Make editor'}</Text>
                      </Pressable>
                    )}
                    {p.status !== 'accepted' && (
                      <Pressable hitSlop={6} onPress={() => runPersonAction(p.id!, () => collaborationService.resend(noteId, p.id!), "Couldn't resend.")}>
                        <Text style={styles.action}>{p.status === 'declined' ? 'Invite again' : 'Resend'}</Text>
                      </Pressable>
                    )}
                    <Pressable hitSlop={6} onPress={() => setConfirmingPersonId(p.id!)}>
                      <Text style={styles.actionDanger}>{p.status === 'accepted' ? 'Remove' : 'Cancel'}</Text>
                    </Pressable>
                  </View>
                )
              )}
            </View>
          ))
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: Spacing.md },
  hint: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, paddingHorizontal: Spacing.md, lineHeight: 19 },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginTop: 16, marginBottom: 6, paddingHorizontal: Spacing.md },
  input: {
    marginHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  roleRow: { flexDirection: 'row', gap: 8, marginTop: 10, paddingHorizontal: Spacing.md },
  roleChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border },
  roleChipActive: { borderColor: Colors.primaryLight, backgroundColor: Colors.infoSoft },
  roleChipText: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  roleChipTextActive: { color: Colors.primaryLight },
  sendButton: { marginHorizontal: Spacing.md, marginTop: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.primaryLight },
  sendButtonDisabled: { backgroundColor: Colors.border },
  sendText: { fontSize: 15, fontWeight: '700', color: Colors.white },
  message: { fontSize: 13, marginTop: 10, paddingHorizontal: Spacing.md, lineHeight: 18 },
  messageError: { color: Colors.error },
  messageOk: { color: Colors.success },
  empty: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  memberEmail: { fontSize: 14.5, fontWeight: '600', color: Colors.textPrimary },
  memberEmailSub: { fontSize: 12.5, color: Colors.textMuted, marginTop: 1 },
  memberStatus: { fontSize: 12.5, color: Colors.primaryLight, marginTop: 2 },
  memberStatusMuted: { color: Colors.textMuted },
  memberActions: { alignItems: 'flex-end', gap: 6 },
  action: { fontSize: 12.5, fontWeight: '700', color: Colors.primaryLight },
  confirmText: { fontSize: 12.5, color: Colors.textSecondary },
  confirmButtons: { flexDirection: 'row', gap: 16 },
  actionDanger: { fontSize: 12.5, fontWeight: '700', color: Colors.error },
});
