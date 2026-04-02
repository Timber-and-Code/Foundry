import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { parseRestSeconds, haptic } from '../utils/helpers';

const RestTimerContext = createContext(null);

export function RestTimerProvider({ children }) {
  const [restTimer, setRestTimer] = useState(null);
  const [restTimerMinimized, setRestTimerMinimized] = useState(false);
  const restIntervalRef = useRef(null);
  const restEndTimeRef = useRef(null);
  const timerDayRef = useRef(null);

  const fireTimerComplete = useCallback(() => {
    try {
      haptic('done');
    } catch {}
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    } catch {}
  }, []);

  const startRestTimer = useCallback(
    (restStr, exName, dayIdx, weekIdx) => {
      const secs = parseRestSeconds(restStr);
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
      const endTime = Date.now() + secs * 1000;
      restEndTimeRef.current = endTime;
      if (dayIdx !== undefined) timerDayRef.current = { dayIdx, weekIdx };
      setRestTimerMinimized(false);
      setRestTimer({ remaining: secs, total: secs, exName });
      restIntervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
        setRestTimer((prev) => {
          if (!prev) {
            clearInterval(restIntervalRef.current);
            return null;
          }
          if (remaining <= 0) {
            clearInterval(restIntervalRef.current);
            fireTimerComplete();
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining };
        });
      }, 500);
    },
    [fireTimerComplete]
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && restEndTimeRef.current) {
        const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
        setRestTimer((prev) => {
          if (!prev) return null;
          if (remaining <= 0) {
            if (restIntervalRef.current) clearInterval(restIntervalRef.current);
            fireTimerComplete();
            return { ...prev, remaining: 0 };
          }
          return { ...prev, remaining };
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [fireTimerComplete]);

  const dismissRestTimer = useCallback(() => {
    if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    restEndTimeRef.current = null;
    timerDayRef.current = null;
    setRestTimer(null);
    setRestTimerMinimized(false);
  }, []);

  return (
    <RestTimerContext.Provider
      value={{
        restTimer,
        restTimerMinimized,
        setRestTimerMinimized,
        startRestTimer,
        dismissRestTimer,
        timerDayRef,
      }}
    >
      {children}
    </RestTimerContext.Provider>
  );
}

export function useRestTimer() {
  const ctx = useContext(RestTimerContext);
  if (!ctx) throw new Error('useRestTimer must be used within RestTimerProvider');
  return ctx;
}
