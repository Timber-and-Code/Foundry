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

/** Schedule the two-note rising chime (G5 → C6) on a RUNNING context. */
function scheduleChimeNotes(ctx: AudioContext): void {
  // Two-note rising chime, louder and a touch longer than a single tone so
  // it cuts through with the phone in a pocket. Fired once — the looping
  // alarm was replaced by this single, stronger cue.
  const now = ctx.currentTime;
  const notes = [
    { freq: 784, start: 0, dur: 0.42 },     // G5
    { freq: 1047, start: 0.34, dur: 0.6 },  // C6 — overlaps the tail of G5
  ];
  for (const n of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = n.freq;
    osc.type = 'sine';
    const t0 = now + n.start;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.55, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur);
    osc.start(t0);
    osc.stop(t0 + n.dur);
  }
}

/**
 * Resume a non-running context, then schedule the chime — rebuilding the
 * context once if the old audio session is dead.
 *
 * iOS WKWebView parks the ctx in `'interrupted'` (a WebKit-only state the
 * spec union doesn't include) after a screen lock, phone call, Siri, a
 * route change, or backgrounding — and scheduling oscillators against a
 * non-running context is a silent no-op because its clock is frozen. That
 * was the "chime sometimes doesn't fire, no rhyme or reason" bug: rests
 * where the phone locked or an interruption occurred played nothing.
 */
async function resumeThenChime(ctx: AudioContext): Promise<void> {
  try {
    await Promise.race([
      ctx.resume(),
      new Promise((_, reject) => setTimeout(reject, 1000)),
    ]);
  } catch { /* fall through — try rebuild below */ }
  if ((ctx.state as string) === 'running') {
    scheduleChimeNotes(ctx);
    return;
  }
  // Old session killed by the OS — close it out and rebuild once.
  try { void ctx.close(); } catch { /* already closed */ }
  ctxRef = null;
  const fresh = getAudioContext();
  if (!fresh) return;
  try {
    if ((fresh.state as string) !== 'running') await fresh.resume();
  } catch { /* still blocked (no gesture yet) — give up quietly */ }
  if ((fresh.state as string) === 'running') scheduleChimeNotes(fresh);
}

/**
 * Fire the haptic + chime that signal a timer has hit zero (rest or cardio).
 * Safe to call from any platform — silently no-ops where unsupported.
 * The haptic always fires immediately; audio may lag a few ms behind a
 * context resume when iOS interrupted the session mid-workout.
 */
export function playTimerCompleteChime(): void {
  try { haptic('done'); } catch { /* haptic not available */ }
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if ((ctx.state as string) === 'running') {
      scheduleChimeNotes(ctx);
      return;
    }
    // 'suspended' (autoplay gate) or 'interrupted' / 'closed' (WebKit
    // interruptions). Resume FIRST, schedule after — the old code resumed
    // fire-and-forget and scheduled against the frozen clock.
    void resumeThenChime(ctx);
  } catch { /* AudioContext blew up — silent fail is fine */ }
}

/**
 * Pre-warm the AudioContext from inside a user-gesture handler (or on
 * return to foreground) so the chime fired later has unlocked audio
 * waiting for it. Safe to call repeatedly — idempotent. Handles the
 * WebKit 'interrupted' and 'closed' states, not just 'suspended'.
 */
export function unlockAudio(): void {
  try {
    let ctx = getAudioContext();
    if (!ctx) return;
    if ((ctx.state as string) === 'closed') {
      ctxRef = null;
      ctx = getAudioContext();
      if (!ctx) return;
    }
    if ((ctx.state as string) !== 'running') {
      void ctx.resume();
    }
  } catch {
    /* unsupported — silent */
  }
}

// Test-only export — lets unit tests verify the chime path is wired
// without needing window.AudioContext spies in every test file.
export const __test__playTimerCompleteChime = playTimerCompleteChime;
