// localStorage wrapper with error handling
// Separated from store.js to break circular dependency with training.js

// markDirty is imported lazily to avoid circular dependency: storage ← sync ← storage
let _markDirty: ((key: string) => void) | null = null;
export function _setMarkDirty(fn: (key: string) => void): void {
  _markDirty = fn;
}

const SYNC_TRACKED = /^foundry:(profile|day\d+:week\d+|readiness:|cardio:session:|bwlog)/;

export const store = {
  get: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to read from localStorage', e);
      return null;
    }
  },
  set: (key: string, val: string): void => {
    try {
      localStorage.setItem(key, val);
      if (SYNC_TRACKED.test(key)) {
        localStorage.setItem('foundry:ts:' + key, new Date().toISOString());
        if (_markDirty) _markDirty(key);
      }
    } catch (e) {
      console.warn('[Foundry]', 'Failed to write to localStorage', e);
    }
  },
  /** Write from remote sync — sets the value and timestamp without marking dirty */
  setFromRemote: (key: string, val: string, remoteTs: string): void => {
    try {
      localStorage.setItem(key, val);
      localStorage.setItem('foundry:ts:' + key, remoteTs);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to write from remote', e);
    }
  },
  remove: (key: string): void => {
    try {
      localStorage.removeItem(key);
      localStorage.removeItem('foundry:ts:' + key);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to remove from localStorage', e);
    }
  },
  /** Return all localStorage keys matching an optional prefix */
  keys: (prefix?: string): string[] => {
    try {
      const result: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) result.push(k);
      }
      return result;
    } catch {
      return [];
    }
  },
  getTimestamp: (key: string): string | null => {
    try {
      return localStorage.getItem('foundry:ts:' + key);
    } catch {
      return null;
    }
  },
};

/**
 * One-time migration: rename all "ppl:" localStorage keys to "foundry:".
 * Safe to call multiple times — skips if already migrated.
 */
export function migrateKeys(): void {
  try {
    if (localStorage.getItem('foundry:migrated_from_ppl') === '1') return;
    const toMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ppl:')) toMigrate.push(k);
    }
    for (const oldKey of toMigrate) {
      const newKey = 'foundry:' + oldKey.slice(4);
      const val = localStorage.getItem(oldKey);
      if (val !== null) localStorage.setItem(newKey, val);
      localStorage.removeItem(oldKey);
    }
    if (toMigrate.length > 0) {
      console.log(`[Foundry] Migrated ${toMigrate.length} keys from ppl: → foundry:`);
    }
    localStorage.setItem('foundry:migrated_from_ppl', '1');
  } catch (e) {
    console.warn('[Foundry] Key migration failed:', e);
  }
}

// ─── MESO SESSION KEY SWEEP ──────────────────────────────────────────────────

// Every localStorage key scoped to a session (day×week) of the current
// program, plus per-meso bookkeeping (tde id maps, re-entry deload flags,
// resumption-handled marker), the active-session bar blob (it points at a
// day/week that stops existing), and the `foundry:ts:` sync mirrors of the
// day blobs. Deliberately NOT matched: `foundry:cardio:session:*` (dated
// cross-meso logs), `foundry:setcount` (per-exercise preference),
// `foundry:archive`, `foundry:meso_transition`,
// `foundry:resumption_archive:*`.
//
// Lives here, at the bottom of the dependency graph, because BOTH archive.ts
// and sync.ts need it and they already point at each other. Hand-rolled
// prefix lists are what caused "new meso starts on week 3": they listed keys
// that don't exist (foundry:completedSets:, foundry:setLog:, …) while the
// real ones survived. There should be exactly one of these.
const MESO_SESSION_KEY_RE =
  /^foundry:(ts:foundry:)?(day\d+:week\d+$|day_v2:|notes:d|exnotes:|done:d|completedDate:d|cardio:d\d+:w\d+$|skip:d|sessionStart:d|strengthEnd:d|exov:d|ws_id:|tde_ids:|reentry_deload:|resumption_handled$|active_session$)/;

// Wipe all per-session data of the current meso and zero the stored week.
// Purely local — remote pointer handling is the callers' concern.
export function wipeMesoSessionData(): void {
  let keys: string[] = [];
  try {
    keys = Object.keys(localStorage);
  } catch (e) {
    console.warn('[Foundry]', 'Failed to enumerate keys during meso wipe', e);
    return;
  }
  keys.forEach((k) => {
    if (!MESO_SESSION_KEY_RE.test(k)) return;
    try {
      localStorage.removeItem(k);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to remove key during meso wipe', e);
    }
  });
  try {
    localStorage.setItem('foundry:currentWeek', '0');
  } catch (e) {
    console.warn('[Foundry]', 'Failed to reset current week', e);
  }
}
