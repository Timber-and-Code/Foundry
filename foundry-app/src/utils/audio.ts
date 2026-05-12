/**
 * Shared audio cue for "timer hit zero".
 *
 * Plays an 880Hz sine chime (~600ms with exponential gain ramp-down) and
 * fires the standard `done` haptic. Both rest-timer and cardio-timer
 * completion paths use this so they stay perceptually identical.
 *
 * Implementation notes:
 *  - We lazily create a single AudioContext and reuse it across calls so
 *    every chime doesn't allocate a new ctx (Safari leaks them on iOS).
 *  - The first call after a fresh page load creates the ctx; if the
 *    browser blocks autoplay until a gesture, the resume() call surfaces
 *    that — but the vast majority of triggers happen mid-session after
 *    the user has tapped at least once, so resume() is a no-op.
 *  - Fully wrapped in try/catch — desktop browsers without
 *    AudioContext + iOS web views without haptics both fall through
 *    silently. Timer correctness never depends on the cue firing.
 */
import { haptic } from './helpers';

let ctxRef: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (ctxRef) return ctxRef;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    ctxRef = new AudioCtx();
    return ctxRef;
  } catch {
    return null;
  }
}

/**
 * Fire the haptic + chime that signal a timer has hit zero (rest or cardio).
 * Safe to call from any platform — silently no-ops where unsupported.
 */
export function playTimerCompleteChime(): void {
  try { haptic('done'); } catch { /* haptic not available */ }
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    // Some browsers suspend the ctx on creation until a user gesture.
    // resume() is idempotent and safe — if it rejects we still try to play.
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* AudioContext blew up — silent fail is fine */ }
}

/**
 * Pre-warm the AudioContext from inside a user-gesture handler so the chime
 * fired later (possibly while the app is backgrounded) has unlocked audio
 * waiting for it. Safe to call repeatedly — idempotent. iOS Safari/WKWebView
 * suspends the ctx until a gesture; without this prewarm the first chime
 * after a fresh app launch can be silent.
 */
export function unlockAudio(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
  } catch {
    /* unsupported — silent */
  }
}

// Test-only export — lets unit tests verify the chime path is wired
// without needing window.AudioContext spies in every test file.
export const __test__playTimerCompleteChime = playTimerCompleteChime;
