import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { DUMMY_SYLLABI } from '@/constants/dummySyllabi';

export default function Syllabi() {
  const router = useRouter();

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <Pressable style={styles.backRow} onPress={() => router.back()}>
        <IconSymbol name="chevron.left" color={Colors.textSecondary} size={18} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Text style={styles.title}>Syllabi</Text>
      <Text style={styles.subtitle}>
        {DUMMY_SYLLABI.length} syllab{DUMMY_SYLLABI.length === 1 ? 'us' : 'i'} · placeholder data
      </Text>

      <View style={styles.list}>
        {DUMMY_SYLLABI.length === 0 ? (
          <Text style={styles.emptyText}>No syllabi added yet.</Text>
        ) : (
          DUMMY_SYLLABI.map((sy) => (
            <View key={sy.id} style={styles.row}>
              <View style={styles.iconBox}>
                <IconSymbol name="doc.fill" color={Colors.primaryLight} size={16} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{sy.courseName}</Text>
                <Text style={styles.rowMeta} numberOfLines={1}>{sy.fileName} · Added {sy.addedDate}</Text>
              </View>
            </View>
          ))
        )}

        <Pressable
          style={styles.addButton}
          onPress={() => Alert.alert('Coming soon', 'Syllabus upload & AI parsing is on the way.')}
        >
          <IconSymbol name="plus" color={Colors.primaryLight} size={18} />
          <Text style={styles.addButtonText}>Add syllabus</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginTop: 12,
    paddingHorizontal: Spacing.md,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 5,
    paddingHorizontal: Spacing.md,
  },
  list: {
    marginTop: 20,
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.infoSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  rowMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 16,
  },
  addButtonText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
});
