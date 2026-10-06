import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ANDROID_CHANNEL_ID } from '@/utils/notifications';

// A "still studying?" reminder for a study run that has no scheduled end: a
// repeating notification every few hours while the timer is running, so a timer
// left on by accident doesn't quietly keep counting. Cancelled on pause and stop.
// (A scheduled session stops by itself at its end time, so it gets no nudge.)
const NUDGE_EVERY_SECONDS = 3 * 60 * 60;
const KEY = 'study:still-studying-notification';

async function storedId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function hasStillStudyingNudge(): Promise<boolean> {
  return !!(await storedId());
}

export async function cancelStillStudyingNudge(): Promise<void> {
  const id = await storedId();
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already gone: fine.
  }
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Nothing more to do.
  }
}

// Replaces any existing nudge with a fresh one that first fires NUDGE hours from now.
export async function scheduleStillStudyingNudge(): Promise<void> {
  await cancelStillStudyingNudge();
  try {
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Still studying?',
        body: "Your study timer is still running. Open the app to pause or stop it so only real study time is counted.",
        data: { kind: 'study-nudge' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: NUDGE_EVERY_SECONDS,
        repeats: true,
        channelId: Platform.OS === 'android' ? ANDROID_CHANNEL_ID : undefined,
      },
    });
    await AsyncStorage.setItem(KEY, id);
  } catch (err) {
    console.error('[studyNudge] could not schedule the still-studying reminder', err);
  }
}
