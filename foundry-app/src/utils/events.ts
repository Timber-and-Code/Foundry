/**
 * Typed event emitter — replaces raw window.dispatchEvent(new CustomEvent(...))
 * with type-safe emit() and on() helpers.
 */

import type { ToastType } from '../contexts/ToastContext';

// Event name → detail payload (void = no detail)
interface FoundryEventMap {
  'foundry:sync': { inflight: number };
  'foundry:toast': { message: string; type: ToastType };
  'foundry:pull-complete': void;
  'foundry:openCardio': { dateStr: string; protocolId?: string };
  'foundry:openMobility': { dateStr: string; protocolId?: string };
  'foundry:showPricing': void;
  'foundry:wants_auth': void;
  'foundry:welcomed': void;
  'foundry:resetToSetup': void;
  // Onboarding v2 — coach mark + save-sheet triggers
  'foundry:first-set-logged': void;
  'foundry:second-exercise-complete': void;
  'foundry:first-week-done': void;
  'foundry:meso-complete': void;
  'foundry:save-sheet-request': { trigger: 'first_set' | 'first_week_done' | 'meso_complete' | 'settings' };
  'foundry:coach-mark-dismissed': { conceptId: string };
  'foundry:schedule-tab-opened': void;
  // Phase 2 — end-of-meso takeover sheet actions
  'foundry:repeat-meso': void;
  'foundry:new-meso': void;
  'foundry:browse-samples': void;
}

type EventName = keyof FoundryEventMap;

/** Dispatch a typed Foundry event on `window`. */
export function emit<K extends EventName>(
  name: K,
  ...args: FoundryEventMap[K] extends void ? [] : [detail: FoundryEventMap[K]]
): void {
  const detail = args[0];
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      detail !== undefined
        ? new CustomEvent(name, { detail })
        : new Event(name),
    );
  }
}

/** Listen for a typed Foundry event. Returns an unsubscribe function. */
export function on<K extends EventName>(
  name: K,
  handler: FoundryEventMap[K] extends void
    ? () => void
    : (detail: FoundryEventMap[K]) => void,
): () => void {
  const wrapper = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    (handler as (detail?: unknown) => void)(detail);
  };
  window.addEventListener(name, wrapper);
  return () => window.removeEventListener(name, wrapper);
}
