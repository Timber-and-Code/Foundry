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
  // Overtime: timer crossed zero. While > 0 the alarm pulses on a loop and
  // the overlay surfaces a blocking "I'm Ready" / "+30s" choice.
  overtimeSeconds: number;
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
  snoozeRestTimer: (extraSeconds?: number) => void;
  timerDayRef: MutableRefObject<TimerDayRef | null>;
}

const RestTimerContext = createContext<RestTimerContextValue | null>(null);

// Lazy AudioContext for the overtime alarm. Instantiated on first set log so
// the user gesture satisfies browser autoplay policy.
let _alarmAudio: AudioContext | null = null;
function getAlarmAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (_alarmAudio) return _alarmAudio;
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    _alarmAudio = new Ctor();
    return _alarmAudio;
  } catch { return null; }
}

/**
 * One alarm pulse — short double-beep + haptic. Heavy mode adds a third beep
 * at +1175Hz and a longer vibration pattern; used after 30s of overtime to
 * escalate the urgency.
 */
function fireAlarmPulse(heavy: boolean) {
  // haptic() routes to native @capacitor/haptics on iOS (Warning notification
  // for alarm/alarm-heavy) and falls back to navigator.vibrate patterns on
  // Android Chrome / PWA.
  try { haptic(heavy ? 'alarm-heavy' : 'alarm'); } catch { /* no-op */ }
  const ctx = getAlarmAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const beep = (offset: number, freq: number, dur: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(heavy ? 0.32 : 0.24, now + offset + 0.02);
    gain.gain.linearRampToValueAtTime(0, now + offset + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + dur + 0.02);
  };
  beep(0, 880, 0.22);
  beep(0.28, 880, 0.22);
  if (heavy) beep(0.56, 1175, 0.24);
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  const [restTimerMinimized, setRestTimerMinimized] = useState(false);
  const restIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alarmIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const overtimeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const restEndTimeRef = useRef<number | null>(null);
  const timerDayRef = useRef<TimerDayRef | null>(null);

  const stopAlarmLoop = useCallback(() => {
    if (alarmIntervalRef.current) { clearInterval(alarmIntervalRef.current); alarmIntervalRef.current = null; }
    if (overtimeIntervalRef.current) { clearInterval(overtimeIntervalRef.current); overtimeIntervalRef.current = null; }
  }, []);

  const startAlarmLoop = useCallback(() => {
    stopAlarmLoop();
    // Initial pulse fires immediately on entering overtime
    fireAlarmPulse(false);
    // Pulse cadence ≈ iPhone alarm. Heavier pattern after 30s overtime.
    let elapsed = 0;
    let interval = 1400;
    const schedule = () => {
      alarmIntervalRef.current = setInterval(() => {
        const heavy = elapsed >= 30;
        fireAlarmPulse(heavy);
        // If we cross the heavy threshold, switch to faster cadence
        if (heavy && interval !== 900) {
          interval = 900;
          if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
          schedule();
        }
      }, interval);
    };
    schedule();
    // 1Hz overtime counter — drives the overlay's "+0:05" display
    overtimeIntervalRef.current = setInterval(() => {
      elapsed += 1;
      setRestTimer((prev) => prev ? { ...prev, overtimeSeconds: prev.overtimeSeconds + 1 } : null);
    }, 1000);
  }, [stopAlarmLoop]);

  const fireTimerComplete = useCallback(() => {
    // Single pulse + start the alarm loop. The loop continues until the user
    // taps "I'm Ready" or "+30s".
    startAlarmLoop();
  }, [startAlarmLoop]);

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
      stopAlarmLoop();
      const endTime = Date.now() + secs * 1000;
      restEndTimeRef.current = endTime;
      if (dayIdx !== undefined) timerDayRef.current = { dayIdx, weekIdx };
      setRestTimerMinimized(false);
      setRestTimer({ remaining: secs, total: secs, exName, overtimeSeconds: 0 });
      // Resume the AudioContext if it's suspended — must happen on a user
      // gesture, which a set log is.
      const audio = getAlarmAudio();
      if (audio && audio.state === 'suspended') audio.resume().catch(() => {});
      restIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current! - Date.now()) / 1000));
        setRestTimer((prev) => {
          if (!prev) { clearInterval(restIntervalRef.current!); return null; }
          if (remaining <= 0) {
            clearInterval(restIntervalRef.current!);
            // Only kick off the alarm once: when we first cross zero
            if (prev.remaining > 0) fireTimerComplete();
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining };
        });
      }, 500);
    },
    [fireTimerComplete, stopAlarmLoop]
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
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fireTimerComplete]);

  const dismissRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    stopAlarmLoop();
    restEndTimeRef.current = null;
    timerDayRef.current = null;
    setRestTimer(null);
    setRestTimerMinimized(false);
  }, [stopAlarmLoop]);

  /**
   * Snooze the timer — pushes the end time forward and clears overtime so the
   * alarm goes quiet. Used by the "+30s" button on the overtime alertdialog.
   */
  const snoozeRestTimer = useCallback(
    (extraSeconds = 30) => {
      stopAlarmLoop();
      const now = Date.now();
      restEndTimeRef.current = now + extraSeconds * 1000;
      setRestTimer((prev) =>
        prev
          ? { ...prev, remaining: extraSeconds, total: extraSeconds, overtimeSeconds: 0 }
          : prev
      );
      // Restart the countdown interval if it had cleared at zero
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      restIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current! - Date.now()) / 1000));
        setRestTimer((prev) => {
          if (!prev) { clearInterval(restIntervalRef.current!); return null; }
          if (remaining <= 0) {
            clearInterval(restIntervalRef.current!);
            if (prev.remaining > 0) fireTimerComplete();
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining };
        });
      }, 500);
    },
    [stopAlarmLoop, fireTimerComplete]
  );

  return (
    <RestTimerContext.Provider
      value={{ restTimer, restTimerMinimized, setRestTimerMinimized, startRestTimer, dismissRestTimer, snoozeRestTimer, timerDayRef }}
    >
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer(): RestTimerContextValue {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within RestTimerProvider');
  return ctx;
}
