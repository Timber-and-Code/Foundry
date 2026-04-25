// Parse a rest string like "3-4 min", "90 sec", "60-90 sec" → seconds (upper bound)
export function parseRestSeconds(restStr: string | undefined | null): number {
  if (!restStr) return 90;
  const s = restStr.toLowerCase();
  const matches = s.match(/\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return 90;
  const val = parseFloat(matches[matches.length - 1]); // Take LAST number (upper bound)
  if (s.includes('min')) return Math.round(val * 60);
  if (s.includes('sec')) return Math.round(val);
  return 90;
}

import { Capacitor } from '@capacitor/core';

type HapticType = 'tap' | 'done' | 'complete' | 'victory' | 'alarm' | 'alarm-heavy';

const HAPTIC: Record<HapticType, number[]> = {
  tap: [40],
  done: [50, 40, 80],
  complete: [80, 50, 80, 50, 120],
  victory: [60, 30, 60, 30, 60, 30, 200],
  // Rest-timer alarm cadence — single pulse repeated by the caller's loop
  alarm: [140, 90, 140],
  // Escalated cadence after 30s of overtime
  'alarm-heavy': [180, 80, 180, 80, 260],
};

export function haptic(type: HapticType): void {
  // iOS Safari/WKWebView does NOT implement navigator.vibrate — without the
  // native branch below, every haptic on TestFlight + production iOS is silent.
  if (Capacitor.isNativePlatform()) {
    void (async () => {
      try {
        const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
        if (type === 'complete' || type === 'victory') {
          await Haptics.notification({ type: NotificationType.Success });
          return;
        }
        if (type === 'alarm' || type === 'alarm-heavy') {
          await Haptics.notification({ type: NotificationType.Warning });
          return;
        }
        await Haptics.impact({
          style: type === 'tap' ? ImpactStyle.Light : ImpactStyle.Medium,
        });
      } catch (e) {
        console.warn('[Foundry]', 'Capacitor haptic failed', e);
      }
    })();
    return;
  }

  // Web fallback — Android Chrome supports this; iOS Safari ignores it.
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(HAPTIC[type] || HAPTIC.tap);
    }
  } catch (e) {
    console.warn('[Foundry]', 'Failed to trigger haptic feedback', e);
  }
}
