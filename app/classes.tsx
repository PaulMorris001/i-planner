import { View, Text, StyleSheet } from 'react-native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { AddClassModal } from '@/components/plan/AddClassModal';
import { ItemActionSheet } from '@/components/ui/ItemActionSheet';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { ListRow } from '@/components/ui/ListRow';
import { DashedAddButton } from '@/components/ui/DashedAddButton';
import { Colors, Spacing } from '@/constants/theme';
import { COURSE_COLORS } from '@/constants/classColors';
import { usePlan } from '@/hooks/usePlan';
import { useEditableSheet } from '@/hooks/useEditableSheet';
import { useClassActions } from '@/hooks/useClassActions';
import { formatClassDays } from '@/utils/date';
import type { ClassItem } from '@/types/plan.types';

export default function Classes() {
  const { plan } = usePlan();
  const sheet = useEditableSheet<ClassItem>();
  const { saveClass, deleteClass } = useClassActions();

  // Most-recent first: ids are Date.now() timestamps, so numeric sort = creation order.
  // Matches the Dashboard's "My Classes" ordering.
  const classes = [...plan.classes].sort((a, b) => Number(b.id) - Number(a.id));

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader title="Classes" subtitle={`${classes.length} class${classes.length === 1 ? '' : 'es'}`} />

      <View style={styles.list}>
        {classes.length === 0 ? (
          <Text style={styles.emptyText}>No classes added yet.</Text>
        ) : (
          classes.map((c) => {
            const color = COURSE_COLORS[plan.classes.indexOf(c) % COURSE_COLORS.length];
            return (
              <ListRow
                key={c.id}
                leading={{ type: 'bar', color }}
                title={c.courseName}
                meta={`${formatClassDays(c)}${c.time ? ` · ${c.time}` : ''}${c.venue ? ` · ${c.venue}` : ''}`}
                onLongPress={() => sheet.setActionTarget(c)}
                onMenuPress={() => sheet.setActionTarget(c)}
              />
            );
          })
        )}

        <DashedAddButton label="Add class" onPress={sheet.openNew} />
      </View>

      <AddClassModal
        visible={sheet.open}
        onClose={sheet.close}
        onAdd={saveClass}
        editingClass={sheet.editing}
      />

      <ItemActionSheet
        visible={!!sheet.actionTarget}
        onClose={() => sheet.setActionTarget(null)}
        onEdit={() => sheet.actionTarget && sheet.openEdit(sheet.actionTarget)}
        onDelete={() => sheet.actionTarget && deleteClass(sheet.actionTarget)}
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
