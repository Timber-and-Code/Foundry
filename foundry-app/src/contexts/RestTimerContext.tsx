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
} from '../utils/restNotification';
import { store } from '../utils/store';

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
  startRestTimer: (restStr: string, exName: string, dayIdx?: number, weekIdx?: number) => void;
  dismissRestTimer: () => void;
  timerDayRef: MutableRefObject<TimerDayRef | null>;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

// Loose shape for the wake lock sentinel — TS lib has these types but
// they're behind a target lib that not every consumer of this file
// will pull in. Runtime presence is what matters; null-check at use.
interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [restTimerMinimized, setRestTimerMinimized] = useState(false);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // One-shot guard: the at-zero cue fires exactly once per rest period.
  const firedRef = useRef(false);
  const restEndTimeRef = useRef<number | null>(null);
  const timerDayRef = useRef<TimerDayRef | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  // Mirror the current exercise name so the visibilitychange handler can
  // populate the OS notification body without re-subscribing on every state
  // change. Updated alongside setRestTimer in startRestTimer.
  const lastExNameRef = useRef<string>('');

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

  /**
   * Fire the at-zero cue exactly once per rest period. The `firedRef` guard
   * makes this idempotent — the countdown tick and the visibilitychange
   * handler can both reach zero, but the lifter only ever hears one chime.
   * `firedRef` is re-armed by startRestTimer / dismissRestTimer.
   */
  const fireTimerComplete = useCallback(() => {
    if (firedRef.current) return;
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
    void cancelRestComplete();
  }, []);

  const startRestTimer = useCallback(
    (restStr: string, exName: string, dayIdx?: number, weekIdx?: number) => {
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
      // that this resolves from the cached outcome with no UI. The result
      // doesn't gate the timer itself — foreground chime works either way.
      void ensureNotificationPermission();
      const secs = parseRestSeconds(restStr);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      // Re-arm the one-shot cue for this new rest period.
      firedRef.current = false;
      const endTime = Date.now() + secs * 1000;
      restEndTimeRef.current = endTime;
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
      restIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current! - Date.now()) / 1000));
        setRestTimer((prev) => {
          if (!prev) { clearInterval(restIntervalRef.current!); return null; }
          if (remaining <= 0) { clearInterval(restIntervalRef.current!); fireTimerComplete(); return { ...prev, remaining: 0 }; }
          return { ...prev, remaining };
        });
      }, 500);
    },
    [fireTimerComplete, acquireWakeLock]
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && restEndTimeRef.current) {
        // Coming back to the foreground — cancel any OS notification we
        // queued on hide. If the timer already expired we fire the chime
        // inline (firedRef makes it a no-op if it already fired via the
        // interval before backgrounding).
        // Re-arm audio first: backgrounding/screen-lock leaves the
        // AudioContext 'interrupted' on iOS, which made the at-zero chime
        // a silent no-op until the next user gesture.
        unlockAudio();
        void cancelRestComplete();
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
        setRestTimer((prev) => {
          if (!prev) return null;
          if (remaining <= 0) { if (restIntervalRef.current) clearInterval(restIntervalRef.current); fireTimerComplete(); return { ...prev, remaining: 0 }; }
          return { ...prev, remaining };
        });
        // iOS releases the wake lock the moment the page hides. Re-acquire
        // when the lifter returns so the screen stays awake again.
        if (restEndTimeRef.current && Date.now() < restEndTimeRef.current) {
          void acquireWakeLock();
        }
      } else if (
        document.visibilityState === 'hidden' &&
        restEndTimeRef.current &&
        !firedRef.current
      ) {
        // Backgrounding with an active timer — hand off the at-zero alert
        // to the OS so the lifter still hears it with the phone locked.
        // Cancelled on return (above) so foreground chime owns the cue if
        // they come back before zero. No-op on web.
        void scheduleRestComplete(restEndTimeRef.current, lastExNameRef.current);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [fireTimerComplete, acquireWakeLock]);

  const dismissRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    firedRef.current = false;
    restEndTimeRef.current = null;
    timerDayRef.current = null;
    lastExNameRef.current = '';
    // Drop any OS notification that's still scheduled — happens when the
    // lifter taps "I'm Ready" before the timer ran out and never
    // backgrounded the app. No-op on web.
    void cancelRestComplete();
    releaseWakeLock();
    setRestTimer(null);
    setRestTimerMinimized(false);
  }, [releaseWakeLock]);

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
