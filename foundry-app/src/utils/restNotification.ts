/**
 * Rest-timer local notification — fires an OS-level alert at rest-end so
 * the lifter still hears it with the phone locked or the app backgrounded.
 *
 * Design (see rest_timer_alarm_decision memory):
 *  - Foreground path stays WebAudio (`playTimerCompleteChime` in audio.ts).
 *    That's instant, no permission needed, and matches what the lifter sees
 *    on-screen.
 *  - Background path is this module. RestTimerContext schedules a single
 *    LocalNotification when the page hides with an active timer, cancels it
 *    on return-to-foreground (so we never double-ring), and re-schedules if
 *    the page hides again before zero.
 *  - Web (PWA / dev browser) no-ops every call — Capacitor's web shim uses
 *    the Notification API which is unreliable for delayed delivery while
 *    backgrounded. The in-app chime stays the only cue there.
 *
 * Permission flow is intentionally minimal: the iOS system dialog fires on
 * the first rest timer of any workout after install. The user's choice is
 * remembered by iOS forever; the cached flag in localStorage only saves us
 * a round-trip to the plugin on subsequent timer starts.
 */
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// Stable notification id. Re-using the same id means scheduling a new rest
// timer transparently replaces any pending one — we never get "ghost"
// notifications from a prior set that was already dismissed.
const REST_TIMER_NOTIF_ID = 1001;

// localStorage cache of the OS permission outcome so we don't re-check the
// plugin every time a rest starts. The plugin's checkPermissions() is cheap
// but does a JS↔native bridge hop; caching is a polite optimization.
const PERM_CACHE_KEY = 'foundry:rest_notif_permission';

type PermissionOutcome = 'granted' | 'denied' | 'unknown';

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function readCachedPermission(): PermissionOutcome {
  try {
    const raw = localStorage.getItem(PERM_CACHE_KEY);
    if (raw === 'granted' || raw === 'denied') return raw;
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function writeCachedPermission(outcome: PermissionOutcome): void {
  try {
    localStorage.setItem(PERM_CACHE_KEY, outcome);
  } catch {
    /* localStorage quota / private mode — silent */
  }
}

/**
 * Make sure the OS will let us post a notification. Returns true if the
 * user has granted permission, false otherwise. Safe to call on every
 * rest-timer start: cached result short-circuits the native bridge call
 * after the first answer.
 *
 * Web platforms: always returns false (no-op path; foreground chime owns).
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const cached = readCachedPermission();
  if (cached === 'granted') return true;
  if (cached === 'denied') return false;
  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === 'granted') {
      writeCachedPermission('granted');
      return true;
    }
    if (status.display === 'denied') {
      writeCachedPermission('denied');
      return false;
    }
    // 'prompt' or 'prompt-with-rationale' — fire the system dialog.
    const requested = await LocalNotifications.requestPermissions();
    const granted = requested.display === 'granted';
    writeCachedPermission(granted ? 'granted' : 'denied');
    return granted;
  } catch {
    // Plugin not registered (e.g. cap sync hasn't run) — treat as denied so
    // we don't trap callers in retry loops. Foreground chime still works.
    return false;
  }
}

/**
 * Schedule the "rest complete" OS notification to fire at `endTime` (ms
 * since epoch). Idempotent: scheduling again with the same id replaces any
 * previously-pending notification, so RestTimerContext can call this every
 * time it backgrounds without worrying about cleanup.
 *
 * Permission is assumed already granted by ensureNotificationPermission —
 * call that first if you're unsure. We re-check the cache here as a cheap
 * second gate; a no-op call is safer than a thrown promise on the audio
 * thread.
 */
export async function scheduleRestComplete(endTime: number, exName: string): Promise<void> {
  if (!isNative()) return;
  if (readCachedPermission() !== 'granted') return;
  const delayMs = endTime - Date.now();
  // Anything <=0 is "the timer already ended" — nothing to schedule. Also
  // skip wildly-large futures (>1 hour) — almost certainly a bug, and we
  // don't want a stale notification firing tomorrow.
  if (delayMs <= 0 || delayMs > 60 * 60 * 1000) return;
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: REST_TIMER_NOTIF_ID,
          title: 'Rest Complete',
          body: exName ? `Next set — ${exName}` : 'Next set',
          schedule: { at: new Date(endTime), allowWhileIdle: true },
          // System default sound — iOS tri-tone / Android default beep. A
          // bundled custom sound would go in ios/App/App/<file>.caf and be
          // referenced by filename; deferred for v1 per scoping discussion.
          sound: undefined,
          // Foreground delivery — Capacitor handles this; iOS shows the
          // banner-style notification while the app is foreground if the
          // foreground service permission was granted.
        },
      ],
    });
  } catch {
    /* Schedule failed — fall through silently. Foreground chime still owns. */
  }
}

/**
 * Cancel any pending rest-complete notification. Called when the lifter
 * comes back to the foreground (so the in-app chime fires, not the OS
 * notification) and when they explicitly dismiss the timer.
 */
export async function cancelRestComplete(): Promise<void> {
  if (!isNative()) return;
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: REST_TIMER_NOTIF_ID }],
    });
  } catch {
    /* No pending notification or plugin unavailable — silent */
  }
}
