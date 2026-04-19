import { tokens } from '../../styles/tokens';
import { FOUNDRY_ANVIL_IMG } from '../../data/images-core';
import type { SyncState } from '../../hooks/useSyncState';

const SYNC_ICON_COLOR: Record<SyncState, string> = {
  idle:    '#C0885A',
  syncing: '#60a5fa',
  synced:  '#4ade80',
  offline: 'var(--stalling)',
};

const SYNC_ICON_GLOW: Record<SyncState, string> = {
  idle:    'none',
  syncing: '0 0 8px rgba(96,165,250,0.5)',
  synced:  '0 0 8px rgba(74,222,128,0.4)',
  offline: '0 0 8px rgba(248,113,113,0.4)',
};

const SYNC_ICON_TITLE: Record<SyncState, string> = {
  idle:    'Cloud sync active',
  syncing: 'Syncing…',
  synced:  'Synced',
  offline: 'Offline — changes saved locally',
};

interface FoundryBannerProps {
  subtitle?: string;
  subtitleLine2?: string;
  onProfileTap?: () => void;
  syncState?: SyncState;
}

function FoundryBanner({ subtitle, subtitleLine2, onProfileTap, syncState = 'idle' }: FoundryBannerProps) {
  const iconColor = SYNC_ICON_COLOR[syncState];
  const iconGlow = SYNC_ICON_GLOW[syncState];
  return (
    <header
      role="banner"
      style={{
        background: '#0f0f0f',
        padding: '10px 16px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Ember glow divider */}
      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 0,
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(232,101,26,0.3), transparent)',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src={typeof FOUNDRY_ANVIL_IMG !== 'undefined' ? FOUNDRY_ANVIL_IMG : ''}
          alt=""
          style={{
            width: 40,
            height: 40,
            objectFit: 'cover',
            borderRadius: tokens.radius.lg,
            flexShrink: 0,
            boxShadow: '0 0 16px rgba(232,101,26,0.2)',
          }}
        />
        <div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 400,
              letterSpacing: '0.2em',
              color: 'var(--text-primary)',
              lineHeight: 1,
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            }}
          >
            THE FOUNDRY
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.15em',
                color: 'var(--phase-accum)',
                marginTop: 2,
                fontFamily: "'Inter', system-ui, sans-serif",
                textTransform: 'uppercase',
                lineHeight: 1.4,
              }}
            >
              <div>{subtitle}</div>
              {subtitleLine2 && (
                <div style={{ color: 'var(--text-muted)', marginTop: 1 }}>{subtitleLine2}</div>
              )}
            </div>
          )}
        </div>
      </div>
      {onProfileTap && (
        <button
          onClick={onProfileTap}
          title={SYNC_ICON_TITLE[syncState]}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: tokens.radius.lg,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: iconColor,
            transition: 'color 0.4s, filter 0.4s',
            filter: iconGlow !== 'none' ? `drop-shadow(${iconGlow})` : 'none',
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </button>
      )}
    </header>
  );
}

export default FoundryBanner;
