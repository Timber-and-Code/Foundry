import React from 'react';
import { tokens } from '../../styles/tokens';
import HammerIcon from '../shared/HammerIcon';

const TAG_COLORS: Record<string, string> = {
  PUSH: 'var(--push-accent,#5C1615)',
  PULL: 'var(--pull-accent,#4A3020)',
  LEGS: 'var(--legs-accent,#3D2A1A)',
};

interface ExerciseDetailModalProps {
  ex: any;
  onClose: () => void;
}

const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({ ex, onClose }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      background: tokens.colors.overlay,
      zIndex: 300,
      display: 'flex',
      alignItems: 'flex-end',
      justifyContent: 'center',
    }}
    onClick={onClose}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        background: 'var(--bg-card)',
        borderRadius: '12px 12px 0 0',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        width: '100%',
        maxWidth: 480,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {ex.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: TAG_COLORS[ex.tag] || 'var(--accent)',
              marginTop: 2,
              fontWeight: 700,
              letterSpacing: '0.06em',
            }}
          >
            {ex.tag} · {ex.muscle}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 22,
            cursor: 'pointer',
            padding: '4px 8px',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          WebkitOverflowScrolling: 'touch',
          padding: '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}
        >
          {ex.anchor && (
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                background: 'rgba(var(--accent-rgb),0.15)',
                color: 'var(--accent)',
                padding: '3px 8px',
                borderRadius: tokens.radius.sm,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <HammerIcon size={13} /> ANCHOR
            </span>
          )}
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'var(--bg-inset)',
              color: 'var(--text-secondary)',
              padding: '3px 8px',
              borderRadius: tokens.radius.sm,
            }}
          >
            {ex.equipment?.toUpperCase()}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'var(--bg-inset)',
              color: 'var(--text-secondary)',
              padding: '3px 8px',
              borderRadius: tokens.radius.sm,
            }}
          >
            {ex.sets} × {ex.reps}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.06em',
              background: 'var(--bg-inset)',
              color: 'var(--text-secondary)',
              padding: '3px 8px',
              borderRadius: tokens.radius.sm,
            }}
          >
            ⏱ {ex.rest}
          </span>
        </div>
        {ex.description ? (
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: 'var(--text-secondary)',
              margin: 0,
            }}
          >
            {ex.description}
          </p>
        ) : (
          <p
            style={{
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'center',
              margin: '24px 0',
            }}
          >
            Description coming soon.
          </p>
        )}
      </div>
      {ex.videoUrl && (
        <div
          style={{
            padding: '12px 20px 20px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <a
            href={ex.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              width: '100%',
              padding: '11px 16px',
              borderRadius: tokens.radius.lg,
              background: '#ff000018',
              border: '1px solid #ff000044',
              color: '#ff4444',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              textDecoration: 'none',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31.5 31.5 0 0 0 0 12a31.5 31.5 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31.5 31.5 0 0 0 24 12a31.5 31.5 0 0 0-.5-5.8z" />
              <polygon fill="white" points="9.6,15.6 15.8,12 9.6,8.4" />
            </svg>
            WATCH ON YOUTUBE
          </a>
        </div>
      )}
    </div>
  </div>
);

export default ExerciseDetailModal;
