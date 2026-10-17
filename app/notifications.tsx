import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BackButton } from '@/components/ui/BackButton';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PageHeader } from '@/components/ui/PageHeader';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useInbox } from '@/hooks/useInbox';
import type { InboxItem } from '@/services/inbox.service';
import { relativeTime } from '@/utils/relativeTime';

// What each kind of message is, shown as its small tag above the title.
const KIND_LABEL: Record<string, string> = {
  announcement: 'WHAT’S NEW',
  'invite-response': 'NOTE INVITATION',
  'access-change': 'NOTE ACCESS',
};

// Messages the server sent this account: announcements from the team, invitation answers and
// access changes. Reminders and alarms the phone sets for itself are not listed here. Unread ones
// carry a dot until opened; tapping one marks it read and goes where it points.
export default function Notifications() {
  const router = useRouter();
  const { items, unreadCount, refresh, markRead, markAllRead } = useInbox();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const open = (item: InboxItem) => {
    if (!item.read) markRead(item.id);
    if (item.route?.startsWith('/')) router.push(item.route as Parameters<typeof router.push>[0]);
  };

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent} onRefresh={handleRefresh} refreshing={refreshing}>
      <View style={styles.headerWrap}>
        <BackButton />
        <PageHeader title="Notifications" subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You’re all caught up.'} />
        {unreadCount > 0 && (
          <Pressable onPress={markAllRead} hitSlop={8} style={styles.markAll} accessibilityRole="button">
            <IconSymbol name="checkmark" color={Colors.primaryLight} size={16} />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.body}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <IconSymbol name="bell.fill" color={Colors.textMuted} size={26} />
            </View>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySub}>News from the i-Planner team and updates about your shared notes will show up here.</Text>
          </View>
        ) : (
          items.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.card, !item.read && styles.cardUnread, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.read ? '' : 'Unread. '}${item.title}`}
            >
              <View style={styles.dotColumn}>{!item.read && <View style={styles.dot} />}</View>
              <View style={styles.cardText}>
                <View style={styles.metaRow}>
                  <Text style={styles.kind}>{KIND_LABEL[item.kind] ?? 'NOTIFICATION'}</Text>
                  <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
                </View>
                <Text style={[styles.title, !item.read && styles.titleUnread]}>{item.title}</Text>
                {!!item.body && <Text style={styles.message}>{item.body}</Text>}
              </View>
              {!!item.route && <IconSymbol name="chevron.right" color={Colors.textMuted} size={16} />}
            </Pressable>
          ))
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 48 },
  headerWrap: { paddingHorizontal: Spacing.sm },
  body: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md, gap: Spacing.sm },
  markAll: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: Spacing.md },
  markAllText: { fontSize: 13.5, fontWeight: '700', color: Colors.primaryLight },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    padding: Spacing.md,
  },
  cardUnread: { borderColor: Colors.primaryLight, backgroundColor: '#F6F9FF' },
  pressed: { opacity: 0.85 },
  dotColumn: { width: 10, alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colors.primaryLight },
  cardText: { flex: 1 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  kind: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, color: Colors.textMuted },
  time: { fontSize: 11.5, color: Colors.textMuted },
  title: { fontSize: 15, fontWeight: '600', color: Colors.textPrimary },
  titleUnread: { fontWeight: '800' },
  message: { fontSize: 13.5, lineHeight: 19, color: Colors.textSecondary, marginTop: 3 },
  empty: { alignItems: 'center', paddingTop: 72, paddingHorizontal: Spacing.lg },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Colors.textPrimary },
  emptySub: { fontSize: 14, lineHeight: 20, color: Colors.textSecondary, textAlign: 'center', marginTop: 6, maxWidth: 300 },
});
