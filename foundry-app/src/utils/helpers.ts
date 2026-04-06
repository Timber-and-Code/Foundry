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

type HapticType = 'tap' | 'done' | 'complete' | 'victory';

const HAPTIC: Record<HapticType, number[]> = {
  tap: [40],
  done: [50, 40, 80],
  complete: [80, 50, 80, 50, 120],
  victory: [60, 30, 60, 30, 60, 30, 200],
};

export function haptic(type: HapticType): void {
  try {
    navigator.vibrate && navigator.vibrate(HAPTIC[type] || HAPTIC.tap);
  } catch (e) {
    console.warn('[Foundry]', 'Failed to trigger haptic feedback', e);
  }
}
