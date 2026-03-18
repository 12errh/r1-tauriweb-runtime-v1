/**
 * R1 Frontend Shim for @tauri-apps/api/notification
 */

export async function sendNotification(options: { title: string; body?: string }): Promise<void> {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(options.title, { body: options.body });
  }
}

export async function requestPermission(): Promise<string> {
  if (!('Notification' in window)) return 'denied';
  return Notification.requestPermission();
}

export async function isPermissionGranted(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  return Notification.permission === 'granted';
}
