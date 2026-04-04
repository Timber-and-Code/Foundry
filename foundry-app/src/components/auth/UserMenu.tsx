import { useAuth } from '../../contexts/AuthContext';
import { tokens } from '../../styles/tokens';
import { useSyncState, useSyncDirtyCount } from '../../hooks/useSyncState';
import type { SyncState } from '../../hooks/useSyncState';

const SYNC_LABEL: Record<SyncState, { color: string; text: string }> = {
  idle:    { color: 'var(--text-muted, #888)', text: 'Cloud sync active' },
  syncing: { color: '#60a5fa',                 text: 'Syncing…' },
  synced:  { color: '#4ade80',                 text: 'Synced' },
  offline: { color: '#f87171',                 text: 'Offline — saved locally' },
};

export default function AccountSection() {
  const { user, logout } = useAuth();
  const syncState = useSyncState();
  const dirtyCount = useSyncDirtyCount();
  if (!user) return null;

  const { color: statusColor, text: statusText } = SYNC_LABEL[syncState];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Account email row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 12px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Account</span>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-primary)',
            fontWeight: 500,
            maxWidth: 180,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={user.email}
        >
          {user.email}
        </span>
      </div>

      {/* Sync status row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 12px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sync Status</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {dirtyCount > 0 && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                background: 'rgba(255,255,255,0.06)',
                padding: '1px 5px',
                borderRadius: tokens.radius.sm,
              }}
            >
              {dirtyCount} pending
            </span>
          )}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: statusColor,
              flexShrink: 0,
              transition: 'background 0.4s',
              boxShadow: syncState === 'syncing' ? `0 0 4px ${statusColor}` : 'none',
            }}
          />
          <span style={{ fontSize: 12, color: statusColor, fontWeight: 500, transition: 'color 0.4s' }}>
            {statusText}
          </span>
        </span>
      </div>

      {/* Sign out */}
      <button
        onClick={logout}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '9px 12px',
          background: 'var(--bg-inset)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.lg,
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sign Out</span>
        <span style={{ fontSize: 13, color: '#f87171', fontWeight: 500 }}>Logout</span>
      </button>
    </div>
  );
}
