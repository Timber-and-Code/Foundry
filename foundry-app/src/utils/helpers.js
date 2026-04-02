// Parse a rest string like "3-4 min", "90 sec", "60-90 sec" → seconds (lower bound)
export function parseRestSeconds(restStr) {
  if (!restStr) return 90;
  const s = restStr.toLowerCase();
  const match = s.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 90;
  const val = parseFloat(match[1]);
  if (s.includes('min')) return Math.round(val * 60);
  if (s.includes('sec')) return Math.round(val);
  return 90;
}

// Haptic feedback — triggers vibration haptic feedback
// Patterns: tap = single light tap, done = two-tap, complete = triple, victory = PR/goal
// navigator.vibrate is silently ignored on iOS Safari/WKWebView — works on Android.
// Will activate properly on iOS once wrapped in Capacitor (v2.0).
const HAPTIC = {
  tap: [40],
  done: [50, 40, 80],
  complete: [80, 50, 80, 50, 120],
  victory: [60, 30, 60, 30, 60, 30, 200],
};

export function haptic(type) {
  try {
    navigator.vibrate && navigator.vibrate(HAPTIC[type] || HAPTIC.tap);
  } catch (e) {
    console.warn('[Foundry]', 'Failed to trigger haptic feedback', e);
  }
}
