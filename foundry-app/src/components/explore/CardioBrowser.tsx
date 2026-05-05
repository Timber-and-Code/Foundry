import { useState, useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { CARDIO_WORKOUTS } from '../../data/constants';
import CardioProtocolDetail from './CardioProtocolDetail';
import CardioDesigner, { describeCardioComp, type CardioComposition } from './CardioDesigner';
import CardioApplySheet, { applyCardioScheduleUpdate } from './CardioApplySheet';
import { loadCardioPresets, deleteCardioPreset, saveProfile } from '../../utils/store';
import { useToast } from '../../contexts/ToastContext';
import type { CardioScheduleSlot, Profile, CardioPreset } from '../../types';

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
  const [showDesigner, setShowDesigner] = useState(false);
  const [userPresets, setUserPresets] = useState<CardioPreset[]>(() => loadCardioPresets());
  // Bundle G — when the lifter taps "Use this session today" inside the
  // Designer, we stash the composed session here and render
  // CardioApplySheet on top with `{ kind: 'composed', session }`.
  const [pendingApply, setPendingApply] = useState<CardioComposition | null>(null);
  const { showToast } = useToast();

  // Refresh presets when the Designer closes (it may have saved one).
  useEffect(() => {
    if (!showDesigner) setUserPresets(loadCardioPresets());
  }, [showDesigner]);

  // Bundle G — schedule-apply for composed sessions handed up from the
  // Designer. Mirrors CardioProtocolDetail.handleApply but accepts the
  // resolvedProtocolId from the sheet so the toast can read out the
  // freshly-minted preset's label / id.
  const handleComposedApply = (
    nextSchedule: CardioScheduleSlot[],
    addedCount: number,
    resolvedProtocolId: string,
  ) => {
    if (!profile) return;
    const updated = applyCardioScheduleUpdate(profile, nextSchedule);
    saveProfile(updated);
    if (onProfileUpdate) onProfileUpdate({ cardioSchedule: nextSchedule });
    setPendingApply(null);
    setShowDesigner(false);
    setUserPresets(loadCardioPresets());

    const scheduledCount = nextSchedule.filter((s) => s.protocol === resolvedProtocolId).length;
    if (scheduledCount === 0) {
      showToast('Removed from schedule', 'info');
    } else if (addedCount > 0) {
      showToast(
        `Session scheduled · ${scheduledCount} day${scheduledCount === 1 ? '' : 's'}/week`,
        'success',
      );
    } else {
      showToast('Schedule updated', 'info');
    }
  };

  if (showDesigner) {
    return (
      <>
        <CardioDesigner
          onClose={() => setShowDesigner(false)}
          onDone={() => setShowDesigner(false)}
          onApplyToSchedule={(comp) => setPendingApply(comp)}
        />
        {pendingApply && profile && (
          <CardioApplySheet
            payload={{ kind: 'composed', session: pendingApply }}
            protocolLabel={describeCardioComp(pendingApply).line}
            schedule={profile.cardioSchedule ?? []}
            onApply={handleComposedApply}
            onClose={() => setPendingApply(null)}
          />
        )}
      </>
    );
  }

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
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
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

        {/* Design your own — full-screen 4-axis composer (Group D / C2). */}
        <button
          onClick={() => setShowDesigner(true)}
          style={{
            background: `${tokens.colors.gold}10`,
            border: `1px dashed ${tokens.colors.gold}66`,
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
          <div
            aria-hidden="true"
            style={{
              fontSize: 18,
              color: tokens.colors.gold,
              fontWeight: 800,
              flexShrink: 0,
            }}
          >
            +
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: tokens.colors.gold,
                marginBottom: 2,
              }}
            >
              DESIGN YOUR OWN
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                lineHeight: 1.4,
              }}
            >
              Compose a session: intensity · workout · protocol · duration.
            </div>
          </div>
          <span aria-hidden="true" style={{ color: tokens.colors.gold, fontSize: 18, flexShrink: 0 }}>
            ›
          </span>
        </button>

        {/* My saved — user-created presets. Only renders if any exist. */}
        {userPresets.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: 'var(--text-muted)',
                margin: '4px 4px 8px',
              }}
            >
              MY SAVED
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {userPresets.map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: `1px solid ${tokens.colors.gold}33`,
                    borderRadius: tokens.radius.lg,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: 'var(--text-primary)',
                        marginBottom: 2,
                      }}
                    >
                      {p.label}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {p.intensity.toUpperCase()} · {(p.modalityCustom || p.modality).toUpperCase().replace('_', ' ')} ·{' '}
                      {p.protocol.toUpperCase().replace('_', ' ')} · {p.target.minutes} MIN
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // eslint-disable-next-line no-alert
                      if (window.confirm(`Delete preset "${p.label}"?`)) {
                        deleteCardioPreset(p.id);
                        setUserPresets(loadCardioPresets());
                      }
                    }}
                    aria-label={`Delete preset ${p.label}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      fontSize: 14,
                      padding: '4px 8px',
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

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
