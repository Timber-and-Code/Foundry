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
      if (_markDirty && SYNC_TRACKED.test(key)) _markDirty(key);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to write to localStorage', e);
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
