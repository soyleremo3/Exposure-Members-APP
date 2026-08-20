// Notifications for the weekly 1:1 match.
//
// These are LOCAL notifications, scheduled on the device — not push. Real push
// (see lib/push.ts) needs an EAS project and a device token endpoint, and even
// with those, still needs the app to have opened at least once to learn a
// round exists. So: we read GET /api/members/match whenever the member opens
// the app or brings it to the foreground, and schedule reminders from what
// it says.
//
// Accepted limit: if the app is never opened, nothing new gets scheduled. The
// reminders themselves DO fire while the app is closed — they're queued with
// the OS in advance.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getMatch } from './api';
import type { MatchData } from '../types';

// Show notifications even when the app is in the foreground. Must be set at
// module scope (before one arrives), which is why App.tsx imports this file.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = 'match';
const LAST_MATCHED_ROUND_KEY = 'match-notify-last-matched-round';
// ponytail: one flat delay for both nudges. The API exposes no round deadline,
// so "a day after you last opened the app" is the best signal available.
const REMINDER_SECONDS = 24 * 60 * 60;

export type Planned = {
  kind: 'matched' | 'optin' | 'confirm';
  title: string;
  body: string;
  delaySeconds: number | null; // null = present immediately
};

// The decision, pure and separate so it can be reasoned about without a
// network, a session, or a device (same split as decideAccess in membership.ts).
export function decideMatchNotifications(
  m: MatchData,
  lastMatchedRound: string | null
): Planned[] {
  const planned: Planned[] = [];
  const round = m.currentRound;

  // You've been matched — tell them now, once per round.
  if (round?.id && round.status === 'matched' && m.myCurrentMatch && round.id !== lastMatchedRound) {
    const name = m.myCurrentMatch.name?.trim() || 'a fellow member';
    planned.push({
      kind: 'matched',
      title: `This week's 1:1 is ${name}`,
      body: m.isOpener
        ? "You're the one reaching out — send the first message."
        : `${name} will reach out. Say hi first if you get there before them.`,
      delaySeconds: null,
    });
  }

  // Round is open and you haven't opted in yet.
  if (round?.id && round.status !== 'matched' && m.myResponse?.opted_in !== true) {
    planned.push({
      kind: 'optin',
      title: 'Weekly 1:1 is open',
      body: 'Opt in to get matched with another member this week.',
      delaySeconds: REMINDER_SECONDS,
    });
  }

  // Last round's partner still needs a "we met" confirmation.
  if (m.pendingConfirmation) {
    const name = m.pendingConfirmation.member?.name?.trim();
    planned.push({
      kind: 'confirm',
      title: name ? `Did you meet ${name}?` : 'Did you meet your 1:1 partner?',
      body: 'Confirm it in the app so the next round can match you.',
      delaySeconds: REMINDER_SECONDS,
    });
  }

  return planned;
}

// Called on app mount (past the gate) and on every foreground. Never throws,
// never alerts — it's background housekeeping, and a failure just means no
// new reminders.
export async function syncMatchNotifications(): Promise<void> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted ||
      (existing.status === 'undetermined' && (await Notifications.requestPermissionsAsync()).granted);
    if (!granted) return;

    if (Platform.OS === 'android') {
      // Android needs a channel for anything to show. No-op in Expo Go, but
      // required once this runs in a dev build.
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Weekly 1:1',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const match = await getMatch();
    const lastMatchedRound = await AsyncStorage.getItem(LAST_MATCHED_ROUND_KEY);
    const planned = decideMatchNotifications(match, lastMatchedRound);

    // Wipe and rebuild: this IS the dedupe for the two reminders. Each app open
    // re-queues them 24h out, and anything already done simply isn't re-planned.
    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const p of planned) {
      await Notifications.scheduleNotificationAsync({
        content: { title: p.title, body: p.body, data: { kind: p.kind } },
        trigger:
          p.delaySeconds === null
            ? null
            : {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: p.delaySeconds,
                channelId: CHANNEL_ID,
              },
      });
      // The immediate one can't be deduped by cancel-and-rebuild (it's already
      // delivered), so remember the round it was for.
      if (p.kind === 'matched' && match.currentRound?.id) {
        await AsyncStorage.setItem(LAST_MATCHED_ROUND_KEY, match.currentRound.id);
      }
    }
  } catch {
    // Offline, server down, or a 401 (which apiFetch already turned into a
    // sign-out). Nothing to say to the member about a reminder that didn't get
    // scheduled.
  }
}
