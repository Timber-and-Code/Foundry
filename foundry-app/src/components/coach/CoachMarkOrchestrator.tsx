import { useEffect, useRef, useState } from 'react';
import { store } from '../../utils/store';
import { emit } from '../../utils/events';
import CoachMark from './CoachMark';
import { COACH_MARKS, CoachMarkDef, coachFlagKey } from './marks';

/**
 * Mounts near the root of the app. Listens for coach-mark triggers (window
 * events and dwell timers), gates on foundry:coach:{id}, queues marks so
 * only one is open at a time.
 *
 * Generic orchestrator — does not import or know about specific marks
 * beyond what's in marks.ts.
 *
 * Cooldown: after a mark is dismissed, the next queued mark is held for
 * COOLDOWN_MS so users aren't dogpiled by tips during the first session.
 */
const COOLDOWN_MS = 30_000;

export default function CoachMarkOrchestrator() {
  const [activeMarkId, setActiveMarkId] = useState<string | null>(null);
  const activeRef = useRef<string | null>(null);
  const queueRef = useRef<string[]>([]);
  const dwellTimersRef = useRef<Map<string, number>>(new Map());
  const lastDismissedAtRef = useRef<number>(0);
  const cooldownTimerRef = useRef<number | null>(null);

  // Keep activeRef in sync with state (used for synchronous decisions in
  // enqueue that can't rely on stale closures).
  useEffect(() => {
    activeRef.current = activeMarkId;
  }, [activeMarkId]);

  const showNextOrSchedule = () => {
    if (activeRef.current) return;
    if (queueRef.current.length === 0) return;
    const elapsed = Date.now() - lastDismissedAtRef.current;
    if (lastDismissedAtRef.current && elapsed < COOLDOWN_MS) {
      // Still cooling down — schedule a single retry for when cooldown elapses
      if (cooldownTimerRef.current) return;
      cooldownTimerRef.current = window.setTimeout(() => {
        cooldownTimerRef.current = null;
        showNextOrSchedule();
      }, COOLDOWN_MS - elapsed);
      return;
    }
    const next = queueRef.current.shift()!;
    activeRef.current = next;
    setActiveMarkId(next);
  };

  const enqueue = (id: string) => {
    if (store.get(coachFlagKey(id)) === '1') return;
    if (activeRef.current === id) return;
    if (queueRef.current.includes(id)) return;
    queueRef.current.push(id);
    showNextOrSchedule();
  };

  // Set up listeners per mark
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    COACH_MARKS.forEach((m) => {
      const trig = m.trigger;
      if (trig.type === 'event') {
        const handler = () => enqueue(m.id);
        window.addEventListener(trig.name, handler as EventListener);
        unsubs.push(() => window.removeEventListener(trig.name, handler as EventListener));
      } else if (trig.type === 'dwell') {
        const startDwell = () => {
          // If already dismissed, do nothing
          if (store.get(coachFlagKey(m.id)) === '1') return;
          // Clear any pending dwell for this id so we don't accumulate timers
          const existing = dwellTimersRef.current.get(m.id);
          if (existing) clearTimeout(existing);
          const timer = window.setTimeout(() => {
            const el = document.querySelector(m.anchor);
            if (el) enqueue(m.id);
          }, trig.ms);
          dwellTimersRef.current.set(m.id, timer);
        };
        window.addEventListener(trig.name, startDwell as EventListener);
        unsubs.push(() => window.removeEventListener(trig.name, startDwell as EventListener));
      }
    });

    return () => {
      unsubs.forEach((u) => u());
      dwellTimersRef.current.forEach((t) => clearTimeout(t));
      dwellTimersRef.current.clear();
    };
  }, []);

  // Clicking on an anchor can surface a dwell mark immediately (bypass timer)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      COACH_MARKS.forEach((m) => {
        if (m.trigger.type !== 'dwell') return;
        if (store.get(coachFlagKey(m.id)) === '1') return;
        const anchorEl = target.closest?.(m.anchor);
        if (anchorEl) enqueue(m.id);
      });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  const handleDismiss = () => {
    if (!activeMarkId) return;
    store.set(coachFlagKey(activeMarkId), '1');
    emit('foundry:coach-mark-dismissed', { conceptId: activeMarkId });
    lastDismissedAtRef.current = Date.now();
    activeRef.current = null;
    setActiveMarkId(null);
    showNextOrSchedule();
  };

  // Clean up any pending cooldown timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  if (!activeMarkId) return null;
  const mark: CoachMarkDef | undefined = COACH_MARKS.find((m) => m.id === activeMarkId);
  if (!mark) return null;

  return (
    <CoachMark
      anchorSelector={mark.anchor}
      title={mark.title}
      copy={mark.copy}
      onDismiss={handleDismiss}
    />
  );
}
