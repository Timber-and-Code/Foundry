import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { CARDIO_WORKOUTS } from '../../data/constants';
import CardioProtocolDetail from './CardioProtocolDetail';
import type { CardioScheduleSlot, Profile } from '../../types';

const INTENSITY_COLOR: Record<string, string> = {
  Easy: '#6BCB77',
  Moderate: '#4EA8DE',
  Hard: '#E8651A',
};

interface CardioBrowserProps {
  onBack: () => void;
  profile?: Profile | null;
  onProfileUpdate?: (updates: Partial<Profile>) => void;
}

function CardioBrowser({ onBack, profile, onProfileUpdate }: CardioBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <CardioProtocolDetail
        protocolId={selectedId}
        profile={profile ?? null}
        onProfileUpdate={onProfileUpdate}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const schedule: CardioScheduleSlot[] = profile?.cardioSchedule ?? [];
  const scheduledIds = new Set(schedule.map((s) => s.protocol));

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px 12px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          ‹
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'var(--text-secondary)',
          }}
        >
          CARDIO
        </span>
      </div>

      <div
        style={{
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            padding: '0 4px 4px',
          }}
        >
          Protocols from Zone 2 to Tabata. Tap one to read the details and add it to your week.
        </div>

        {CARDIO_WORKOUTS.map((w) => {
          const intensityColor = INTENSITY_COLOR[w.defaultIntensity] || 'var(--accent)';
          const isScheduled = scheduledIds.has(w.id);
          return (
            <button
              key={w.id}
              onClick={() => setSelectedId(w.id)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: tokens.radius.lg,
                textAlign: 'left',
                cursor: 'pointer',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {w.label}
                  </div>
                  {isScheduled && (
                    <span
                      aria-label="Scheduled"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        color: 'var(--accent)',
                        background: 'rgba(var(--accent-rgb),0.14)',
                        padding: '2px 6px',
                        borderRadius: tokens.radius.sm,
                      }}
                    >
                      SCHEDULED
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-inset)',
                      padding: '2px 7px',
                      borderRadius: tokens.radius.sm,
                    }}
                  >
                    {w.category.toUpperCase()}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: 'var(--text-secondary)',
                      background: 'var(--bg-inset)',
                      padding: '2px 7px',
                      borderRadius: tokens.radius.sm,
                    }}
                  >
                    {w.defaultDuration} MIN
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      color: intensityColor,
                      background: intensityColor + '1a',
                      padding: '2px 7px',
                      borderRadius: tokens.radius.sm,
                    }}
                  >
                    {w.defaultIntensity.toUpperCase()}
                  </span>
                </div>
              </div>
              <span
                aria-hidden="true"
                style={{
                  color: 'var(--text-dim)',
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                ›
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CardioBrowser;
