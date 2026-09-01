import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SyllabusUploadModal } from '@/components/plan/SyllabusUploadModal';
import { EditSyllabusModal } from '@/components/plan/EditSyllabusModal';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListRow } from '@/components/ui/ListRow';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Colors, Spacing } from '@/constants/theme';
import { useSyllabi } from '@/hooks/useSyllabi';
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { confirmDelete } from '@/utils/confirmDelete';
import { formatShortDate } from '@/utils/date';
import type { Syllabus } from '@/types/syllabus.types';

export default function Syllabi() {
  const { syllabi, loading, updateSyllabus, deleteSyllabus } = useSyllabi();
  const [uploadOpen, setUploadOpen] = useState(false);
  const sheet = useEditableSheet<Syllabus>();

  const handleSave = async (courseName: string) => {
    if (!sheet.editing) return;
    await updateSyllabus(sheet.editing.id, { courseName });
  };

  const handleRemove = async () => {
    if (!sheet.editing) return;
    await deleteSyllabus(sheet.editing.id);
  };

  const handleDeleteFromActionSheet = (syllabus: Syllabus) => {
    confirmDelete(syllabus.courseName, () => {
      deleteSyllabus(syllabus.id).catch((err) => {
        console.error('[Syllabi] failed to delete syllabus', err);
      });
    });
  };

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
              onLongPress={() => sheet.setActionTarget(syllabus)}
              onMenuPress={() => sheet.setActionTarget(syllabus)}
            />
          ))
        )}

        <DashedAddButton label="Add syllabus" onPress={() => setUploadOpen(true)} />
      </View>

      <SyllabusUploadModal visible={uploadOpen} onClose={() => setUploadOpen(false)} />

      <EditSyllabusModal
        visible={sheet.open}
        onClose={sheet.close}
        onSave={handleSave}
        onRemove={handleRemove}
        editingSyllabus={sheet.editing}
      />

      <ItemActionSheet
        visible={!!sheet.actionTarget}
        onClose={() => sheet.setActionTarget(null)}
        onEdit={() => sheet.actionTarget && sheet.openEdit(sheet.actionTarget)}
        onDelete={() => sheet.actionTarget && handleDeleteFromActionSheet(sheet.actionTarget)}
      />
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
