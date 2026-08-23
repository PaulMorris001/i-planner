import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenWrapper } from '@/components/layout/ScreenWrapper';
import { BackButton } from '@/components/ui/BackButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing } from '@/constants/theme';
import { useSettings } from '@/hooks/useSettings';
import { useNewTaskModal } from '@/contexts/NewTaskModalContext';
import { calendarImportService } from '@/services/calendarImport.service';
import { readAppleCalendarEvents } from '@/utils/appleCalendarSync';
import { formatDatePickerLabel, formatTimeLabel } from '@/utils/date';
import type { ImportedCalendarEvent } from '@/types/calendarImport.types';

const IMPORT_WINDOW_DAYS = 60;

export default function ImportCalendar() {
  const { appleCalendarConnected, googleCalendarConnected } = useSettings();
  const { isOpen: taskModalOpen, openWithDraft } = useNewTaskModal();

  const [events, setEvents] = useState<ImportedCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [importingApple, setImportingApple] = useState(false);
  const [importingGoogle, setImportingGoogle] = useState(false);

  const fetchList = useCallback(async () => {
    try {
      setEvents(await calendarImportService.list());
    } catch (err) {
      console.error('[ImportCalendar] failed to load imported events', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetches whenever this screen regains focus — a real navigation away
  // and back (e.g. switching tabs and returning).
  useFocusEffect(
    useCallback(() => {
      fetchList();
    }, [fetchList])
  );

  // NewTaskModal is a plain React Native <Modal> (see BottomSheetModal),
  // not a route — opening/closing it never blurs or refocuses this screen,
  // so useFocusEffect above never fires for it. Refetching on the
  // open→closed transition instead covers both outcomes of "Convert to
  // task" correctly: saved (the row is now genuinely gone server-side) or
  // backed out without saving (the row was never actually removed
  // server-side, so it correctly reappears here).
  const wasTaskModalOpen = useRef(false);
  useEffect(() => {
    if (wasTaskModalOpen.current && !taskModalOpen) fetchList();
    wasTaskModalOpen.current = taskModalOpen;
  }, [taskModalOpen, fetchList]);

  const handleImportApple = async () => {
    setImportingApple(true);
    try {
      const start = new Date();
      const end = new Date(start.getTime() + IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const localEvents = await readAppleCalendarEvents(start, end);
      setEvents(await calendarImportService.importApple(localEvents));
    } catch (err) {
      console.error('[ImportCalendar] Apple import failed', err);
      Alert.alert("Couldn't import", 'Check your connection and try again.');
    } finally {
      setImportingApple(false);
    }
  };

  const handleImportGoogle = async () => {
    setImportingGoogle(true);
    try {
      setEvents(await calendarImportService.importGoogle());
    } catch (err) {
      console.error('[ImportCalendar] Google import failed', err);
      Alert.alert("Couldn't import", 'Check your connection and try again.');
    } finally {
      setImportingGoogle(false);
    }
  };

  const handleDismiss = (event: ImportedCalendarEvent) => {
    setEvents((prev) => prev.filter((e) => e.id !== event.id));
    calendarImportService.remove(event.id).catch((err) => {
      console.error('[ImportCalendar] failed to dismiss event', err);
    });
  };

  const handleConvert = (event: ImportedCalendarEvent) => {
    // Not optimistically removed here — the modal covers this screen while
    // open, and the open→closed effect above refetches the real state
    // either way once it closes (saved or cancelled), which is the only
    // way to know which actually happened.
    const start = new Date(event.startAt);
    openWithDraft({
      title: event.title,
      dueDate: event.startAt,
      time: event.allDay ? undefined : formatTimeLabel(start),
      notes: event.location ? `📍 ${event.location}` : undefined,
      // externalId, not id — id is this row's own Mongo document id, which
      // means nothing to expo-calendar/the Google API. externalId is the
      // real calendar-provider event id this should link to.
      appleEventIds: event.source === 'apple' ? [event.externalId] : undefined,
      googleEventId: event.source === 'google' ? event.externalId : undefined,
      draftSourceId: event.id,
    });
  };

  const noCalendarConnected = !appleCalendarConnected && !googleCalendarConnected;

  return (
    <ScreenWrapper backgroundColor={Colors.offWhite} scroll style={styles.scrollContent}>
      <BackButton />

      <PageHeader
        title="Import calendar"
        subtitle="Review events from your calendar and add the ones you want as tasks."
      />

      {noCalendarConnected ? (
        <Text style={styles.emptyText}>
          Connect Apple or Google Calendar in Profile → Calendar Sync first.
        </Text>
      ) : (
        <View style={styles.importRow}>
          {appleCalendarConnected && (
            <Button
              label="Import from Apple"
              variant="secondary"
              loading={importingApple}
              onPress={handleImportApple}
              style={styles.importButton}
            />
          )}
          {googleCalendarConnected && (
            <Button
              label="Import from Google"
              variant="secondary"
              loading={importingGoogle}
              onPress={handleImportGoogle}
              style={styles.importButton}
            />
          )}
        </View>
      )}

      <View style={styles.list}>
        {loading ? (
          <Text style={styles.emptyText}>Loading…</Text>
        ) : events.length === 0 ? (
          <Text style={styles.emptyText}>
            Nothing to review yet — tap Import above to pull in events from your calendar.
          </Text>
        ) : (
          events.map((event) => {
            const start = new Date(event.startAt);
            return (
              <Card key={event.id} style={styles.card}>
                <View style={styles.cardHeaderRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.eventTitle} numberOfLines={1}>{event.title}</Text>
                    <Text style={styles.eventMeta} numberOfLines={1}>
                      {formatDatePickerLabel(start)}
                      {event.allDay ? ' · All day' : ` · ${formatTimeLabel(start)}`}
                      {event.location ? ` · ${event.location}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.sourceBadge, event.source === 'apple' ? styles.sourceBadgeApple : styles.sourceBadgeGoogle]}>
                    <Text style={styles.sourceBadgeText}>{event.source === 'apple' ? 'Apple' : 'Google'}</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable style={styles.convertButton} onPress={() => handleConvert(event)}>
                    <Text style={styles.convertButtonText}>Convert to task</Text>
                  </Pressable>
                  <Pressable
                    style={styles.dismissButton}
                    onPress={() => handleDismiss(event)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <IconSymbol name="xmark" color={Colors.textMuted} size={16} />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  importRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    paddingHorizontal: Spacing.md,
  },
  importButton: {
    flex: 1,
    height: 46,
  },
  list: {
    marginTop: 20,
    paddingHorizontal: Spacing.md,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 16,
    paddingHorizontal: Spacing.md,
    lineHeight: 19,
  },
  card: {
    padding: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  eventMeta: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  sourceBadge: {
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  sourceBadgeApple: {
    backgroundColor: Colors.offWhite,
  },
  sourceBadgeGoogle: {
    backgroundColor: Colors.infoSoft,
  },
  sourceBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  convertButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLight,
    borderRadius: 11,
    paddingVertical: 11,
  },
  convertButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  dismissButton: {
    width: 40,
    height: 40,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
