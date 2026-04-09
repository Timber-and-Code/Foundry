import { useEffect, useState } from 'react';
import { store } from '../utils/storage';
import { on } from '../utils/events';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline';

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  );

  useEffect(() => {
    const unsubSync = on('foundry:sync', (detail) => {
      if (!navigator.onLine) return;
      setState(detail.inflight > 0 ? 'syncing' : 'synced');
    });
    const onOnline = () => setState('idle');
    const onOffline = () => setState('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsubSync();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (state !== 'synced') return;
    const t = setTimeout(() => setState('idle'), 3000);
    return () => clearTimeout(t);
  }, [state]);

  return state;
}

export function useSyncDirtyCount(): number {
  const read = () => {
    try {
      const raw = store.get('foundry:sync:dirty');
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    } catch { return 0; }
  };

  const [count, setCount] = useState(read);

  useEffect(() => {
    const unsub = on('foundry:sync', () => setCount(read()));
    return unsub;
  }, []);

  return count;
}
