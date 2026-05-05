/**
 * CardioTimerContext — persistent cardio session timer (Group D / C1).
 *
 * Mirrors RestTimerContext's surface but for cardio sessions: counts UP by
 * default; if a target duration is set, renders against that target and
 * fires a single chime + haptic when elapsed >= target. Critically, hitting
 * the target does NOT auto-end the session — the lifter must explicitly
 * tap COMPLETE. They can also `extendByMinutes` to push the target out.
 *
 * Background-tab survival: elapsed is ALWAYS recomputed from
 * `Math.floor((Date.now() - startedAt) / 1000)`. The setInterval tick is a
 * UI re-render trigger only — never the source of truth. A
 * `visibilitychange` listener bumps state on resume so iOS app-switch
 * flows pick up the right elapsed value immediately.
 *
 * Sits at the same layer as RestTimerContext (App.tsx wraps both in
 * sibling providers). Cardio + rest timers can co-exist (e.g. pause for a
 * rest set during a cardio session) — they're independent.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { haptic } from '../utils/helpers';

interface CardioTimerState {
  isActive: boolean;
  startedAt: number | null;
  protocolId: string | null;
  /** Target duration in seconds. null = open-ended count-up. */
  targetSeconds: number | null;
  /** Derived from Date.now() − startedAt. Set by the interval tick AND on
   *  visibilitychange resume so background tabs stay in sync. */
  elapsedSeconds: number;
  /** True after elapsed >= target (and we've fired the chime). The lifter
   *  can ignore this and keep going — completion is only ever explicit
   *  via `complete()`. */
  isComplete: boolean;
}

interface CardioTimerActions {
  startCardio: (opts: { protocolId: string; targetSeconds: number | null }) => void;
  extendByMinutes: (n: number) => void;
  /** Confirm + close session early (returns elapsedSeconds). The dialog is
   *  the caller's responsibility — this resolves immediately. */
  endEarly: () => number;
  /** Explicit "I'm done" — closes the session and returns final elapsed. */
  complete: () => number;
}

type CardioTimerContextValue = CardioTimerState & CardioTimerActions;

const NOOP: CardioTimerContextValue = {
  isActive: false,
  startedAt: null,
  protocolId: null,
  targetSeconds: null,
  elapsedSeconds: 0,
  isComplete: false,
  startCardio: () => {},
  extendByMinutes: () => {},
  endEarly: () => 0,
  complete: () => 0,
};

const CardioTimerContext = createContext<CardioTimerContextValue | null>(null);

/**
 * Plays the same 880Hz sine chime + haptic that RestTimerContext uses on
 * completion. Kept inline rather than imported so this file stays
 * standalone — RestTimerContext doesn't export the helper today, and
 * pulling in shared audio util would touch unrelated files for both
 * groups working on the timer surface (Group A + Group D).
 */
function fireCardioComplete(): void {
  try { haptic('done'); } catch { /* haptic not available */ }
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
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
  } catch { /* AudioContext not available */ }
}

export function CardioTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CardioTimerState>({
    isActive: false,
    startedAt: null,
    protocolId: null,
    targetSeconds: null,
    elapsedSeconds: 0,
    isComplete: false,
  });

  // Refs that mirror state for stable closures inside effects/callbacks.
  // Avoids re-binding the interval every render.
  const startedAtRef = useRef<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const completeFiredRef = useRef<boolean>(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Recompute elapsed from wall-clock and reconcile completion state.
  // Returns the next elapsed value so callers (visibilitychange handler)
  // can use it without waiting for the next render.
  const recompute = useCallback(() => {
    const startedAt = startedAtRef.current;
    if (startedAt == null) return 0;
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    const target = targetRef.current;
    let didComplete = false;
    if (target != null && elapsed >= target && !completeFiredRef.current) {
      completeFiredRef.current = true;
      fireCardioComplete();
      didComplete = true;
    }
    setState((prev) => {
      if (!prev.isActive) return prev;
      // Only update when there's a meaningful change to avoid render churn
      // on jsdom + raf throttling.
      if (
        prev.elapsedSeconds === elapsed &&
        prev.isComplete === (didComplete || prev.isComplete)
      ) {
        return prev;
      }
      return {
        ...prev,
        elapsedSeconds: elapsed,
        isComplete: didComplete || prev.isComplete,
      };
    });
    return elapsed;
  }, []);

  const startCardio = useCallback(
    ({ protocolId, targetSeconds }: { protocolId: string; targetSeconds: number | null }) => {
      const now = Date.now();
      startedAtRef.current = now;
      targetRef.current = targetSeconds;
      completeFiredRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState({
        isActive: true,
        startedAt: now,
        protocolId,
        targetSeconds,
        elapsedSeconds: 0,
        isComplete: false,
      });
      // Tick at 1Hz — the count-up display only needs second-level
      // resolution. Recompute (not increment) so a backgrounded tab
      // catches up the instant the page returns to foreground.
      intervalRef.current = setInterval(() => {
        recompute();
      }, 1000);
    },
    [recompute],
  );

  const extendByMinutes = useCallback((n: number) => {
    setState((prev) => {
      if (!prev.isActive) return prev;
      const currentTarget = prev.targetSeconds ?? prev.elapsedSeconds;
      const nextTarget = currentTarget + Math.round(n * 60);
      targetRef.current = nextTarget;
      // Pushing the target out clears the "complete" flag so the chime can
      // fire again when the new target is hit.
      completeFiredRef.current = prev.elapsedSeconds < nextTarget ? false : completeFiredRef.current;
      return {
        ...prev,
        targetSeconds: nextTarget,
        isComplete: prev.elapsedSeconds >= nextTarget ? prev.isComplete : false,
      };
    });
  }, []);

  const stopAndReset = useCallback((): number => {
    const final = recompute();
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startedAtRef.current = null;
    targetRef.current = null;
    completeFiredRef.current = false;
    setState({
      isActive: false,
      startedAt: null,
      protocolId: null,
      targetSeconds: null,
      elapsedSeconds: 0,
      isComplete: false,
    });
    return final;
  }, [recompute]);

  const endEarly = useCallback((): number => {
    // Caller owns the confirmation dialog. We just resolve with the actual
    // elapsed value at the moment of the call, then tear down.
    return stopAndReset();
  }, [stopAndReset]);

  const complete = useCallback((): number => {
    return stopAndReset();
  }, [stopAndReset]);

  // visibilitychange — re-derive elapsed from wall-clock the moment the
  // page returns. The setInterval keeps running while hidden on most
  // platforms but the WORST case (browser throttles it to once a minute)
  // is still correct: recompute() reads Date.now() not a counter.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        recompute();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [recompute]);

  // Cleanup on unmount (provider tear-down — should be rare in practice).
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const value: CardioTimerContextValue = {
    ...state,
    startCardio,
    extendByMinutes,
    endEarly,
    complete,
  };

  return (
    <CardioTimerContext.Provider value={value}>{children}</CardioTimerContext.Provider>
  );
}

export function useCardioTimer(): CardioTimerContextValue {
  return useContext(CardioTimerContext) ?? NOOP;
}

// Test-only export — lets unit tests verify the chime path is wired without
// reaching for window.AudioContext spies in every test file.
export const __test__fireCardioComplete = fireCardioComplete;
