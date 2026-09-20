import { store } from './storage';

/**
 * In-progress meso setup, saved as the lifter goes.
 *
 * Setup state used to live only in React memory. iOS routinely kills a
 * backgrounded WKWebView to reclaim memory and reloads it on return, so
 * leaving the app mid-build — to check a message, look up an exercise —
 * threw away every choice: split, equipment, hand-picked exercises, swaps
 * made on the review screen. The builder "failed" every time someone
 * stepped away.
 *
 * The session is restored when the same kind of setup opens again, and App
 * reopens plan-next / after-meso setup on launch when one is pending. It is
 * cleared on finish and on cancel, dropped with the meso's session keys
 * (see MESO_SESSION_KEY_RE), and ignored once it's stale or belongs to a
 * different meso.
 */

export type SetupMode = 'new' | 'plan-next' | 'after-meso';

const KEY = 'foundry:setup_session';
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

export interface SetupSession {
  v: 1;
  mode: SetupMode;
  savedAt: number;
  /** The live meso this setup was opened on top of ('' for a first meso). */
  mesoKey: string;
  // Everything below is SetupPage's own state, stored as-is.
  state: Record<string, unknown>;
}

/** Identifies the meso underneath the setup, so a session never leaks into the next one. */
export function currentMesoKey(): string {
  const id = store.get('foundry:active_meso_id');
  if (id) return id;
  try {
    return String(JSON.parse(store.get('foundry:profile') || '{}').startDate || '');
  } catch {
    return '';
  }
}

export function loadSetupSession(mode?: SetupMode): SetupSession | null {
  try {
    const s = JSON.parse(store.get(KEY) || 'null') as SetupSession | null;
    if (!s || s.v !== 1 || !s.state) return null;
    if (mode && s.mode !== mode) return null;
    if (Date.now() - s.savedAt > MAX_AGE_MS) return null;
    if (s.mesoKey !== currentMesoKey()) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSetupSession(mode: SetupMode, state: Record<string, unknown>): void {
  try {
    const s: SetupSession = { v: 1, mode, savedAt: Date.now(), mesoKey: currentMesoKey(), state };
    store.set(KEY, JSON.stringify(s));
  } catch (e) {
    console.warn('[Foundry]', 'Failed to save setup session', e);
  }
}

export function clearSetupSession(): void {
  store.remove(KEY);
}
