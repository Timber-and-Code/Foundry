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
  onProfileTap?: () => void;
  syncState?: SyncState;
}

function FoundryBanner({ subtitle, onProfileTap, syncState = 'idle' }: FoundryBannerProps) {
  const iconColor = SYNC_ICON_COLOR[syncState];
  const iconGlow = SYNC_ICON_GLOW[syncState];
  return (
    <header
      role="banner"
      style={{
        background: '#0f0f0f',
        padding: '14px 16px',
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
          {/* Typography pass: nav lockup uses tighter 0.12em — 0.18em was
              inherited from WelcomeScreen display size and reads too open
              at this 28px nav scale. */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: '0.12em',
              color: 'var(--text-primary)',
              lineHeight: 1,
              fontFamily: tokens.fontFamily.display,
            }}
          >
            THE FOUNDRY
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.08em',
                marginTop: 6,
                fontFamily: tokens.fontFamily.body,
                textTransform: 'uppercase',
                lineHeight: 1.4,
                color: 'var(--amber)',
              }}
            >
              {subtitle}
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
