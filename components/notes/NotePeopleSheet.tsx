import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal } from '@/components/ui/BottomSheetModal';
import { Colors, Spacing } from '@/constants/theme';
import { collaborationService } from '@/services/collaboration.service';
import type { CollabRole, NotePeople } from '@/types/collaboration.types';

interface NotePeopleSheetProps {
  visible: boolean;
  onClose: () => void;
  noteId: string;
}

const ROLE_BADGE: Record<CollabRole, string> = { editor: 'Can edit', viewer: 'View only' };

// The read-only "who has access" list for someone who was INVITED to a note: the owner and the
// other people who accepted, each with their role. It shows names (or a masked address for a
// person without one), never email addresses, and never pending or declined invitations: only
// the owner sees those.
export function NotePeopleSheet({ visible, onClose, noteId }: NotePeopleSheetProps) {
  const [data, setData] = useState<NotePeople | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setData(await collaborationService.people(noteId));
    } catch (err) {
      console.error('[NotePeopleSheet] failed to load people', err);
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  return (
    <BottomSheetModal visible={visible} onClose={onClose} maxHeightPct={70}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>People with access</Text>

        {loading && !data ? (
          <ActivityIndicator color={Colors.primaryLight} style={{ marginTop: 16 }} />
        ) : failed ? (
          <Pressable onPress={load}>
            <Text style={styles.retry}>Couldn&apos;t load the list. Tap to try again.</Text>
          </Pressable>
        ) : (
          !!data && (
            <>
              <View style={styles.row}>
                <Text style={styles.name} numberOfLines={1}>
                  {data.owner.label}
                </Text>
                <View style={[styles.badge, styles.badgeOwner]}>
                  <Text style={[styles.badgeText, styles.badgeTextOwner]}>Owner</Text>
                </View>
              </View>
              {data.people.map((p, index) => (
                <View key={`${p.label}-${index}`} style={styles.row}>
                  <Text style={styles.name} numberOfLines={1}>
                    {p.isYou ? 'You' : p.label}
                  </Text>
                  <View style={[styles.badge, p.role === 'viewer' && styles.badgeMuted]}>
                    <Text style={[styles.badgeText, p.role === 'viewer' && styles.badgeTextMuted]}>{ROLE_BADGE[p.role]}</Text>
                  </View>
                </View>
              ))}
              {data.people.length === 0 && <Text style={styles.empty}>Nobody else has joined this note yet.</Text>}
            </>
          )
        )}
      </ScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: Colors.textPrimary, paddingHorizontal: Spacing.md, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  name: { flex: 1, fontSize: 14.5, fontWeight: '600', color: Colors.textPrimary },
  badge: { backgroundColor: Colors.infoSoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeMuted: { backgroundColor: Colors.border },
  badgeOwner: { backgroundColor: Colors.successSoft },
  badgeText: { fontSize: 11.5, fontWeight: '700', color: Colors.primaryLight },
  badgeTextMuted: { color: Colors.textSecondary },
  badgeTextOwner: { color: Colors.success },
  empty: { fontSize: 13, color: Colors.textSecondary, paddingHorizontal: Spacing.md, paddingVertical: 10 },
  retry: { fontSize: 13, fontWeight: '700', color: Colors.primaryLight, paddingHorizontal: Spacing.md, paddingVertical: 12 },
});
