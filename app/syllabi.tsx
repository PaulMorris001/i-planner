import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SyllabusUploadModal } from '@/components/plan/SyllabusUploadModal';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListRow } from '@/components/ui/ListRow';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Colors, Spacing } from '@/constants/theme';
import { useSyllabi } from '@/hooks/useSyllabi';
import { formatShortDate } from '@/utils/date';

export default function Syllabi() {
  const { syllabi, loading } = useSyllabi();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title="Syllabi" subtitle={`${syllabi.length} syllab${syllabi.length === 1 ? 'us' : 'i'}`} />

      <View style={styles.list}>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : syllabi.length === 0 ? (
          <Text style={styles.emptyText}>No syllabi added yet.</Text>
        ) : (
          syllabi.map((syllabus) => (
            <ListRow
              key={syllabus.id}
              leading={{ type: 'icon', name: 'doc.fill', color: Colors.primaryLight, background: Colors.infoSoft }}
              title={syllabus.courseName}
              meta={`${syllabus.fileName} · Added ${formatShortDate(syllabus.createdAt)}`}
            />
          ))
        )}

        <DashedAddButton label="Add syllabus" onPress={() => setUploadOpen(true)} />
      </View>

      <SyllabusUploadModal visible={uploadOpen} onClose={() => setUploadOpen(false)} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
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
});
