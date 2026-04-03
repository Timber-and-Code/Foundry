import React from 'react';
import { FOUNDRY_ANVIL_IMG } from '../../data/images-core';

interface FoundryBannerProps {
  subtitle?: string;
  onProfileTap?: () => void;
  userMenu?: React.ReactNode;
}

function FoundryBanner({ subtitle, onProfileTap, userMenu }: FoundryBannerProps) {
  return (
    <div
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
            borderRadius: 8,
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
                marginTop: 3,
                fontFamily: "'Inter', system-ui, sans-serif",
                textTransform: 'uppercase',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {userMenu}
        {onProfileTap && (
        <button
          onClick={onProfileTap}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 8,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#C0885A',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#F29A52')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#C0885A')}
        >
          <svg
            width="20"
            height="20"
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
      </div>
    </div>
  );
}

export default FoundryBanner;
