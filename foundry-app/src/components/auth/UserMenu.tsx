import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { tokens } from '../../styles/tokens';

function useSyncState() {
  const [state, setState] = useState(() => (typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'));

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

function useSyncDirtyCount() {
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

const SYNC_DOT = {
  idle:    { color: 'rgba(255,255,255,0.15)', title: 'Cloud sync active' },
  syncing: { color: '#60a5fa',                title: 'Syncing…' },
  synced:  { color: '#4ade80',                title: 'Synced' },
  offline: { color: '#f87171',                title: 'Offline — changes saved locally' },
};

export default function UserMenu() {
  const { user, logout } = useAuth();
  const syncState = useSyncState();
  const dirtyCount = useSyncDirtyCount();
  if (!user) return null;

  const label = user.email ? user.email.split('@')[0] : 'account';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: tokens.spacing.sm,
        padding: `${tokens.spacing.xs}px ${tokens.spacing.sm}px`,
        borderRadius: tokens.radius.lg,
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <span
        title={(SYNC_DOT as Record<string, any>)[syncState].title}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: (SYNC_DOT as Record<string, any>)[syncState].color,
          flexShrink: 0,
          transition: 'background 0.4s',
          boxShadow: syncState === 'syncing' ? `0 0 4px ${SYNC_DOT.syncing.color}` : 'none',
        }}
      />
      {dirtyCount > 0 && (
        <span
          style={{
            fontSize: 10,
            color: 'var(--text-muted, #888)',
            background: 'rgba(255,255,255,0.06)',
            padding: '1px 5px',
            borderRadius: tokens.radius.sm,
            whiteSpace: 'nowrap',
          }}
          title={`${dirtyCount} change${dirtyCount === 1 ? '' : 's'} pending sync`}
        >
          {dirtyCount} pending
        </span>
      )}
      <span
        style={{
          fontSize: tokens.fontSize.xs,
          color: 'var(--text-muted, #666)',
          letterSpacing: '0.04em',
          maxWidth: 90,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={user.email}
      >
        {label}
      </span>
      <button
        onClick={logout}
        title="Sign out"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '2px',
          borderRadius: tokens.radius.sm,
          color: 'var(--text-muted, #666)',
          display: 'flex',
          alignItems: 'center',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted, #666)')}
      >
        {/* Log out icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </button>
    </div>
  );
}
