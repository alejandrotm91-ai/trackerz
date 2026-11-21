import { NotificationItem } from "../types";
import { saveNotificationToCloud } from "./nube";

// Web Audio API polite alert sound synthesizer
let audioCtx: AudioContext | null = null;

export function playNotificationChime() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    if (!audioCtx) return;

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {
    console.warn("Audio chime not allowed or supported yet:", e);
  }
}

// Request Browser Push Notification permission
export async function requestPushNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications.");
    return "denied";
  }
  return await Notification.requestPermission();
}

// Send browser native notification
export function triggerBrowserPushNotification(title: string, body: string, icon = "/favicon.ico") {
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon,
        badge: icon,
      });
      playNotificationChime();
    } catch (e) {
      console.warn("Could not display native notification:", e);
    }
  }
}

// Dispatch notification both to Firestore and browser
export async function dispatchCustomNotification(
  title: string,
  message: string,
  senderName: string,
  type: NotificationItem['type'] = 'general',
  targetMemberId?: string,
  activityId?: string,
  activityCode?: string
): Promise<NotificationItem> {
  const notification: NotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    message,
    timestamp: new Date().toISOString(),
    senderName,
    ...(targetMemberId ? { targetMemberId } : {}),
    ...(activityId ? { activityId } : {}),
    ...(activityCode ? { activityCode } : {}),
    read: false,
    type,
  };

  // Save to Firestore for multi-device sync
  await saveNotificationToCloud(notification);

  // Trigger browser push notification if permitted
  triggerBrowserPushNotification(title, message);

  return notification;
}
