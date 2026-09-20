import { store } from './storage.js';

/**
 * The coach sends program inputs to a third-party AI (Anthropic's Claude, via
 * our worker). App Review 5.1.2(i) wants that disclosed and agreed to BEFORE
 * the first send — so both coach entry points gate on this, once per device.
 * Not a meso-session key: it survives new mesos and resets.
 */
const KEY = 'foundry:coach_ai_consent';

export function hasCoachConsent(): boolean {
  return store.get(KEY) === '1';
}

export function grantCoachConsent(): void {
  store.set(KEY, '1');
}
