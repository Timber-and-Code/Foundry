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
