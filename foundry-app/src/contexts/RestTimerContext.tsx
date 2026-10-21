import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
  type MutableRefObject,
} from 'react';
import { parseRestSeconds } from '../utils/helpers';
import { playTimerCompleteChime, unlockAudio } from '../utils/audio';
import {
  ensureNotificationPermission,
  scheduleRestComplete,
  cancelRestComplete,
  clearDeliveredRestComplete,
} from '../utils/restNotification';
import { store } from '../utils/store';
import { emit } from '../utils/events';
import { recordRestEnd, undoRestLearn, formatRest } from '../utils/restOverride';
import type { Exercise } from '../types';

interface RestTimerState {
  remaining: number;
  total: number;
  exName: string;
}

interface TimerDayRef {
  dayIdx: number;
  weekIdx: number | undefined;
}

interface RestTimerContextValue {
  restTimer: RestTimerState | null;
  restTimerMinimized: boolean;
  setRestTimerMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  /** `exercise` lets the timer learn from an early end (utils/restOverride). */
  startRestTimer: (
    restStr: string,
    exName: string,
    dayIdx?: number,
    weekIdx?: number,
    exercise?: Exercise,
  ) => void;
  /** `user: true` when the lifter ended it (I'm Ready / Skip) — the only
   *  ends that teach a rest length. System ends (stop workout, auto-finish)
   *  pass nothing. */
  dismissRestTimer: (opts?: { user?: boolean }) => void;
  timerDayRef: MutableRefObject<TimerDayRef | null>;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

// Loose shape for the wake lock sentinel — TS lib has these types but
// they're behind a target lib that not every consumer of this file
// will pull in. Runtime presence is what matters; null-check at use.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

const isHidden = () =>
  typeof document !== 'undefined' && document.visibilityState === 'hidden';

/**
 * The rest timer. Rule: ONE chime + haptic at zero, every set, whether the
 * app is in front or not.
 *
 *   start ──tick──▶ zero ──▶ fired ──▶ cleared (dismiss / next start)
 *                 │
 *                 └─ hidden: ticking STOPS, the OS notification owns zero.
 *                    visible before zero: cancel it, resume ticking.
 *                    visible after zero: mark fired, no replay (it rang).
 *
 * Why ticking stops on hide: WKWebView keeps running JS for a few seconds
 * after the app backgrounds. If zero landed in that window the old code
 * "fired" into a suspended AudioContext (silent), the haptic was ignored,
 * and it then CANCELLED the OS notification it had just scheduled — no
 * cue at all. Locking the phone with ≲30 s left is the most common way to
 * end a rest, which is why the ding "only fired sometimes".
 */
export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [restTimerMinimized, setRestTimerMinimized] = useState(false);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // One-shot guard: the at-zero cue fires exactly once per rest period.
  const firedRef = useRef(false);
  const restEndTimeRef = useRef<number | null>(null);
  // The OS accepted a notification for the current period while hidden.
  // On return after zero, this is what tells us the cue already rang.
  const notifScheduledRef = useRef(false);
  const timerDayRef = useRef<TimerDayRef | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  // Mirror the current exercise name so the visibilitychange handler can
  // populate the OS notification body without re-subscribing on every state
  // change. Updated alongside setRestTimer in startRestTimer.
  const lastExNameRef = useRef<string>('');
  // The lift this rest belongs to and when it started — an early end by
  // the lifter is measured against these to learn the rest length.
  const restMetaRef = useRef<{ exercise: Exercise; startedAt: number } | null>(null);

  // Acquire a screen wake lock so the iPhone (or Android) doesn't dim /
  // sleep while the lifter is between sets. iOS releases the lock when
  // the page is hidden — the visibilitychange effect below re-acquires
  // on return so it survives app-switch / lock screen scenarios.
  const acquireWakeLock = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined') return;
      const wakeLock = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
      if (!wakeLock) return;
      // Already held — don't double-request.
      if (wakeLockRef.current) return;
      wakeLockRef.current = await wakeLock.request('screen');
    } catch {
      // Silent — wake lock isn't critical for rest correctness, just nice
      // to have. Older iOS / unsupported environments fall back to the
      // OS auto-lock behavior.
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    const lock = wakeLockRef.current;
    wakeLockRef.current = null;
    if (lock) {
      try { void lock.release(); } catch { /* no-op */ }
    }
  }, []);

  const stopTicking = useCallback(() => {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }
  }, []);

  /**
   * Fire the at-zero cue exactly once per rest period. The `firedRef` guard
   * makes this idempotent — the countdown tick and the visibilitychange
   * handler can both reach zero, but the lifter only ever hears one chime.
   * `firedRef` is re-armed by startRestTimer / dismissRestTimer.
   *
   * Never fires while hidden: a chime into a suspended AudioContext is
   * silent and would also consume the one-shot. The OS notification owns
   * zero in the background; the visible handler reconciles on return.
   */
  const fireTimerComplete = useCallback(() => {
    if (firedRef.current || isHidden()) return;
    firedRef.current = true;
    playTimerCompleteChime();
    // At zero, always surface the full alarm — never leave the timer hidden
    // behind the minimized chip on /day/*. The off-day path (App.tsx's
    // MinimizedTimerBar) already swaps to its own alarm dialog at remaining=0,
    // but DayView's minimized chip is gated on `remaining > 0` and so vanishes
    // unless we force the full overlay back. firedRef makes this idempotent
    // alongside the chime, so the unminimize fires exactly once per period.
    setRestTimerMinimized(false);
    // Foreground fired the chime — drop any pending OS notification so the
    // lifter doesn't get a duplicate ring a beat later. No-op on web.
    notifScheduledRef.current = false;
    void cancelRestComplete();
  }, []);

  /**
   * Drive the countdown from the wall-clock deadline. Side effects (stop,
   * chime) run in the tick itself, never inside the state updater — an
   * updater can be replayed by React after a later startRestTimer has
   * already re-armed the refs, and the old code then cleared the NEW
   * interval and marked the NEW period fired: a frozen, silent rest.
   */
  const startTicking = useCallback(() => {
    stopTicking();
    restIntervalRef.current = setInterval(() => {
      const end = restEndTimeRef.current;
      if (end == null) { stopTicking(); return; }
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      if (remaining <= 0) {
        stopTicking();
        fireTimerComplete();
      }
      setRestTimer((prev) => (prev ? { ...prev, remaining } : null));
    }, 500);
  }, [stopTicking, fireTimerComplete]);

  const startRestTimer = useCallback(
    (restStr: string, exName: string, dayIdx?: number, weekIdx?: number, exercise?: Exercise) => {
      const secs = parseRestSeconds(restStr);
      // "0 sec" is the zero-rep skip — the lifter bailed on the exercise,
      // there is no rest to time and nothing to ding about.
      if (secs <= 0) return;
      // Onboarding v2: fire the first-rest-timer event once per user so the
      // CoachMarkOrchestrator can explain what the rest timer does.
      if (!store.get('foundry:first_rest_timer_emitted')) {
        store.set('foundry:first_rest_timer_emitted', '1');
        window.dispatchEvent(new Event('foundry:first-rest-timer'));
      }
      // Prewarm: this call site is a user-gesture path (lifter just tapped a
      // set checkmark). Unlocking now lets a chime fire reliably at zero, even
      // if the OS has briefly suspended the context by then.
      unlockAudio();
      // Fire-and-forget the OS notification permission ask on the first rest
      // timer post-install. iOS only surfaces the system sheet once; after
      // that this resolves without UI. The result doesn't gate the timer
      // itself — foreground chime works either way.
      void ensureNotificationPermission();
      stopTicking();
      // Re-arm the one-shot cue for this new rest period.
      firedRef.current = false;
      notifScheduledRef.current = false;
      // A previous period's notification must not ring over this one.
      void cancelRestComplete();
      const endTime = Date.now() + secs * 1000;
      restEndTimeRef.current = endTime;
      restMetaRef.current = exercise ? { exercise, startedAt: Date.now() } : null;
      if (dayIdx !== undefined) timerDayRef.current = { dayIdx, weekIdx };
      // Default new rests to NOT minimized — DayView's full overlay
      // handles the in-workout UX. App-level toast renders only when the
      // user navigates away from /day/* (auto-minimize via route).
      setRestTimerMinimized(false);
      lastExNameRef.current = exName;
      setRestTimer({ remaining: secs, total: secs, exName });
      // Keep the screen awake while resting — released on dismiss /
      // visibilitychange handles re-acquire after backgrounding.
      void acquireWakeLock();
      if (isHidden()) {
        // Started while already hidden (a background flush, a test): hand
        // straight to the OS — there is no foreground tick to run.
        void scheduleRestComplete(endTime, exName).then((ok) => {
          notifScheduledRef.current = ok;
        });
      } else {
        startTicking();
      }
    },
    [stopTicking, startTicking, acquireWakeLock]
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      const end = restEndTimeRef.current;
      if (!end) return;
      if (document.visibilityState === 'visible') {
        // Re-arm audio first: backgrounding/screen-lock leaves the
        // AudioContext 'interrupted' on iOS, which made the at-zero chime
        // a silent no-op until the next user gesture.
        unlockAudio();
        const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        if (remaining <= 0) {
          stopTicking();
          if (notifScheduledRef.current && !firedRef.current) {
            // Zero passed while hidden and the OS rang for it. One cue
            // per period — mark fired, surface the alarm, no replay.
            firedRef.current = true;
            notifScheduledRef.current = false;
            setRestTimerMinimized(false);
            void clearDeliveredRestComplete();
          } else {
            // No OS cue was possible (web, permission off, scheduled too
            // late): the chime is late but it is still the one cue.
            fireTimerComplete();
          }
          setRestTimer((prev) => (prev ? { ...prev, remaining: 0 } : null));
          return;
        }
        // Back before zero — the foreground chime owns the cue again.
        notifScheduledRef.current = false;
        void cancelRestComplete();
        setRestTimer((prev) => (prev ? { ...prev, remaining } : null));
        if (!firedRef.current) startTicking();
        // iOS releases the wake lock the moment the page hides. Re-acquire
        // when the lifter returns so the screen stays awake again.
        void acquireWakeLock();
      } else if (document.visibilityState === 'hidden' && !firedRef.current) {
        // Backgrounding with a live timer — the OS owns zero from here.
        // Stop ticking so a zero inside WKWebView's few-second grace
        // window can't consume the cue (silent chime + cancelled
        // notification = nothing). Re-scheduled on every hide; cancelled
        // on return before zero (above). No-op on web.
        stopTicking();
        void scheduleRestComplete(end, lastExNameRef.current).then((ok) => {
          notifScheduledRef.current = ok;
        });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fireTimerComplete, acquireWakeLock, stopTicking, startTicking]);

  const dismissRestTimer = useCallback((opts?: { user?: boolean }) => {
    // The lifter ended the rest before zero: that teaches the rest length.
    // Two matching early ends in a row set the lift's rest; the toast's
    // UNDO puts it back. No question asked (utils/restOverride).
    const meta = restMetaRef.current;
    if (opts?.user && meta && restEndTimeRef.current && !firedRef.current) {
      const actualSecs = Math.round((Date.now() - meta.startedAt) / 1000);
      const learned = recordRestEnd(meta.exercise, actualSecs);
      if (learned) {
        emit('foundry:toast', {
          message: `${learned.exName} rest set to ${formatRest(learned.secs)}.`,
          type: 'info',
          durationMs: 8000,
          action: { label: 'Undo', onClick: () => undoRestLearn(learned) },
        });
      }
    }
    restMetaRef.current = null;
    stopTicking();
    firedRef.current = false;
    notifScheduledRef.current = false;
    restEndTimeRef.current = null;
    timerDayRef.current = null;
    lastExNameRef.current = '';
    // Drop any OS notification that's still scheduled — happens when the
    // lifter taps "I'm Ready" before the timer ran out and never
    // backgrounded the app — and any banner that already rang. No-op on web.
    void cancelRestComplete();
    void clearDeliveredRestComplete();
    releaseWakeLock();
    setRestTimer(null);
    setRestTimerMinimized(false);
  }, [stopTicking, releaseWakeLock]);

  return (
    <RestTimerContext.Provider
      value={{ restTimer, restTimerMinimized, setRestTimerMinimized, startRestTimer, dismissRestTimer, timerDayRef }}
    >
      {children}
    </RestTimerContext.Provider>
  );
}

// Safe noop fallback so callers that may render outside a provider
// (e.g. HomeTab in tests, or the storybook-like preview routes) don't
// crash. Mirrors the pattern used by ActiveSessionContext.
const NOOP_REST_TIMER_CONTEXT: RestTimerContextValue = {
  restTimer: null,
  restTimerMinimized: false,
  setRestTimerMinimized: () => {},
  startRestTimer: () => {},
  dismissRestTimer: () => {},
  timerDayRef: { current: null },
};

export function useRestTimer(): RestTimerContextValue {
  return useContext(RestTimerContext) ?? NOOP_REST_TIMER_CONTEXT;
}
