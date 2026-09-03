import { Platform, PermissionsAndroid, Linking, Alert } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Request all permissions the app needs to work properly.
 * Safe to call multiple times.
 */
export async function requestAllAppPermissions() {
  if (Platform.OS !== 'android') {
    // iOS: notifications only for now
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  }

  try {
    // 1. Notifications (Android 13+)
    const { status: notifStatus } = await Notifications.requestPermissionsAsync();
    if (notifStatus !== 'granted') {
      console.log('Notification permission not granted');
    }

    // 2. Storage (Android 12 and below)
    if (Platform.Version < 33) {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ]);
    }

    // QUERY_ALL_PACKAGES is declared in the manifest.
    // No extra runtime dialog is required for it.

    return true;
  } catch (error) {
    console.warn('Permission request failed:', error);
    return false;
  }
}

/**
 * Open the system settings page for this app
 * (so the user can manually enable denied permissions).
 */
export async function openAppSettings() {
  try {
    await Linking.openSettings();
  } catch (e) {
    Alert.alert('Error', 'Could not open app settings.');
  }
}

/**
 * Check current notification permission status
 */
export async function getNotificationStatus() {
  const settings = await Notifications.getPermissionsAsync();
  return settings.status; // 'granted' | 'denied' | 'undetermined'
}