import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { MOBILITY_PROTOCOLS } from '../../data/constants';
import type { MobilityCategory } from '../../data/constants';
import MobilityProtocolDetail from './MobilityProtocolDetail';
import type { MobilityScheduleSlot, Profile } from '../../types';

interface MobilityBrowserProps {
  onBack: () => void;
  profile?: Profile | null;
  onProfileUpdate?: (updates: Partial<Profile>) => void;
}

const SUB_TABS: { id: MobilityCategory; label: string }[] = [
  { id: 'warmup', label: 'WARMUP' },
  { id: 'recovery', label: 'RECOVERY' },
  { id: 'targeted', label: 'TARGETED' },
];

const TAB_COPY: Record<MobilityCategory, string> = {
  warmup: 'Short, split-aware primers to run before your session.',
  recovery: 'Downshift, foam-roll, and off-day flows that help you bounce back.',
  targeted: 'Longer prehab / rehab work for shoulders, hips, spine, and full-body mobility.',
};

function MobilityBrowser({ onBack, profile, onProfileUpdate }: MobilityBrowserProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<MobilityCategory>('warmup');

  if (selectedId) {
    return (
      <MobilityProtocolDetail
        protocolId={selectedId}
        profile={profile ?? null}
        onProfileUpdate={onProfileUpdate}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  const schedule: MobilityScheduleSlot[] = profile?.mobilitySchedule ?? [];
  const scheduledIds = new Set(schedule.map((s) => s.protocol));
  const filtered = MOBILITY_PROTOCOLS.filter((p) => p.category === tab);

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
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
          }}
        >
          MOBILITY
        </span>
      </div>

      {/* Sub-tabs */}
      <div
        role="tablist"
        aria-label="Mobility categories"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${SUB_TABS.length}, 1fr)`,
          gap: 6,
          padding: '14px 16px 4px',
        }}
      >
        {SUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              aria-controls={`mobility-panel-${t.id}`}
              id={`mobility-tab-${t.id}`}
              onClick={() => setTab(t.id)}
              style={{
                padding: '10px 0',
                borderRadius: tokens.radius.md,
                border: active
                  ? '1px solid var(--accent)'
                  : '1px solid var(--border)',
                background: active
                  ? 'rgba(var(--accent-rgb),0.14)'
                  : 'var(--bg-inset)',
                color: active ? 'var(--accent)' : 'var(--text-primary)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        id={`mobility-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`mobility-tab-${tab}`}
        style={{
          padding: '8px 16px 16px',
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
            padding: '4px 4px 4px',
          }}
        >
          {TAB_COPY[tab]}
        </div>

        {filtered.map((proto) => {
          const isScheduled = scheduledIds.has(proto.id);
          return (
            <button
              key={proto.id}
              onClick={() => setSelectedId(proto.id)}
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
                    {proto.name}
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
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    marginBottom: 8,
                  }}
                >
                  {proto.description}
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
                    {proto.duration.toUpperCase()}
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
                    {proto.moves.length} MOVES
                  </span>
                  {proto.dayTags?.map((t) => (
                    <span
                      key={t}
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
                      {t}
                    </span>
                  ))}
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

export default MobilityBrowser;
