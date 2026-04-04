import { useEffect, useState } from 'react';

export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline';

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  );

  useEffect(() => {
    const onSync = (e: any) => {
      if (!navigator.onLine) return;
      setState(e.detail.inflight > 0 ? 'syncing' : 'synced');
    };
    const onOnline = () => setState('idle');
    const onOffline = () => setState('offline');
    window.addEventListener('foundry:sync', onSync);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('foundry:sync', onSync);
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
      const raw = localStorage.getItem('foundry:sync:dirty');
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.length : 0;
    } catch { return 0; }
  };

  const [count, setCount] = useState(read);

  useEffect(() => {
    const handler = () => setCount(read());
    window.addEventListener('foundry:sync', handler);
    return () => window.removeEventListener('foundry:sync', handler);
  }, []);

  return count;
}
