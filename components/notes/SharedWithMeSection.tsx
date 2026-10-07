import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { Routes } from '@/constants/routes';
import { useNotes } from '@/hooks/useNotes';
import { formatShortDate } from '@/utils/date';

// Notes other people invited this account to (accepted invitations). Shown on the Notes
// screen only when there is at least one. Opening one uses the normal note editor: an
// editor can change it, a viewer can only read it.
export function SharedWithMeSection() {
  const { sharedNotes } = useNotes();
  if (sharedNotes.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>SHARED WITH ME</Text>
      {sharedNotes.map(({ note, role, ownerLabel }) => (
        <Pressable key={note.id} style={styles.card} onPress={() => router.push(`${Routes.NOTE_EDITOR}?id=${note.id}`)}>
          <View style={styles.iconBox}>
            <IconSymbol name="person.fill" color={Colors.primaryLight} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {note.title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              From {ownerLabel} · edited {formatShortDate(note.updatedAt)}
            </Text>
          </View>
          <View style={[styles.badge, role === 'viewer' && styles.badgeMuted]}>
            <Text style={[styles.badgeText, role === 'viewer' && styles.badgeTextMuted]}>{role === 'editor' ? 'Can edit' : 'View only'}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 22, paddingHorizontal: Spacing.md },
  eyebrow: { fontSize: 12, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5, marginBottom: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  iconBox: { width: 36, height: 36, borderRadius: 11, backgroundColor: Colors.infoSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14.5, fontWeight: '700', color: Colors.textPrimary },
  meta: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 2 },
  badge: { backgroundColor: Colors.infoSoft, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  badgeMuted: { backgroundColor: Colors.border },
  badgeText: { fontSize: 11.5, fontWeight: '700', color: Colors.primaryLight },
  badgeTextMuted: { color: Colors.textSecondary },
});
