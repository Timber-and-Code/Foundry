import { useState, useRef, useEffect, useCallback } from 'react';
import { store } from '../utils/store';

/**
 * Shared workout session timer logic used by both DayView and ExtraDayView.
 * Manages session start/end timestamps, elapsed time display, and begin-workout action.
 */
export function useWorkoutTimer(opts: {
  /** localStorage key for session start timestamp */
  startKey: string;
  /** localStorage key for strength-end timestamp */
  strengthEndKey: string;
  /** Whether the session is already complete */
  isDone: boolean;
  /** Whether the session is locked (future week) */
  isLocked?: boolean;
}) {
  const { startKey, strengthEndKey, isDone, isLocked = false } = opts;

  const sessionStartRef = useRef<number | null>(null);
  const strengthEndRef = useRef<number | null>(null);
  const elapsedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [workoutStarted, setWorkoutStarted] = useState(() => {
    const saved = store.get(startKey);
    return !!saved && !isDone && !isLocked;
  });
  const [elapsedSecs, setElapsedSecs] = useState(0);

  // Restore timestamps from localStorage on mount
  useEffect(() => {
    const savedStart = store.get(startKey);
    if (savedStart && !isDone && !isLocked) {
      sessionStartRef.current = parseInt(savedStart, 10);
      const savedEnd = store.get(strengthEndKey);
      if (savedEnd) strengthEndRef.current = parseInt(savedEnd, 10);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Elapsed timer — runs while workout is active and not complete
  useEffect(() => {
    if (!workoutStarted || isDone) return;
    const tick = () => {
      if (sessionStartRef.current) {
        setElapsedSecs(Math.floor((Date.now() - sessionStartRef.current) / 1000));
      }
    };
    tick();
    elapsedIntervalRef.current = setInterval(tick, 1000);
    return () => {
      if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    };
  }, [workoutStarted, isDone]);

  const beginWorkout = useCallback(() => {
    const now = Date.now();
    sessionStartRef.current = now;
    store.set(startKey, String(now));
    setWorkoutStarted(true);
  }, [startKey]);

  const stampStrengthEnd = useCallback(() => {
    strengthEndRef.current = Date.now();
    store.set(strengthEndKey, String(strengthEndRef.current));
  }, [strengthEndKey]);

  const clearTimers = useCallback(() => {
    if (elapsedIntervalRef.current) clearInterval(elapsedIntervalRef.current);
    store.set(startKey, '');
    store.set(strengthEndKey, '');
  }, [startKey, strengthEndKey]);

  return {
    workoutStarted,
    setWorkoutStarted,
    elapsedSecs,
    sessionStartRef,
    strengthEndRef,
    beginWorkout,
    stampStrengthEnd,
    clearTimers,
  };
}

/** Format elapsed seconds as M:SS or H:MM:SS */
export function formatElapsed(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
