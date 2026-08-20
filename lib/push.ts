// Remote push registration.
//
// Local (device-scheduled) reminders live in matchNotify.ts and work today.
// This file handles the other half: telling the server which device to push,
// so a member who hasn't opened the app all week still hears about their
// match.
//
// Inert until app.json's extra.eas.projectId exists — getExpoPushTokenAsync()
// cannot mint a token without it. Same for Expo Go on Android, which can't
// receive remote push at all since SDK 53 (a dev build can). Both cases exit
// quietly: local notifications keep working regardless.
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken as postPushToken } from './api';

export async function registerPushToken(): Promise<void> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return; // no EAS project yet — nothing to register

    // matchNotify's sync already asks for permission; don't ask a second time.
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;

    await postPushToken(token, Platform.OS);
  } catch {
    // Offline, no network permission, Expo Go on Android, revoked token — all
    // non-events. Push is an extra; the app must not care when it's missing.
  }
}
