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
import { parseRestSeconds, haptic } from '../utils/helpers';
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
  const restEndTimeRef = useRef<number | null>(null);
  const timerDayRef = useRef<TimerDayRef | null>(null);
  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);

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

  const fireTimerComplete = useCallback(() => {
    try { haptic('done'); } catch { /* haptic not available on desktop */ }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
  }, []);

  const startRestTimer = useCallback(
    (restStr: string, exName: string, dayIdx?: number, weekIdx?: number) => {
      // Onboarding v2: fire the first-rest-timer event once per user so the
      // CoachMarkOrchestrator can explain what the rest timer does.
      if (!store.get('foundry:first_rest_timer_emitted')) {
        store.set('foundry:first_rest_timer_emitted', '1');
        window.dispatchEvent(new Event('foundry:first-rest-timer'));
      }
      const secs = parseRestSeconds(restStr);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      const endTime = Date.now() + secs * 1000;
      restEndTimeRef.current = endTime;
      if (dayIdx !== undefined) timerDayRef.current = { dayIdx, weekIdx };
      // Default new rests to NOT minimized — DayView's full overlay
      // handles the in-workout UX. App-level toast renders only when the
      // user navigates away from /day/* (auto-minimize via route).
      setRestTimerMinimized(false);
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
    const onVisible = () => {
      if (document.visibilityState === 'visible' && restEndTimeRef.current) {
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
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fireTimerComplete, acquireWakeLock]);

  const dismissRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restEndTimeRef.current = null;
    timerDayRef.current = null;
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
