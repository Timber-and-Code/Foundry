import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { CARDIO_WORKOUTS } from '../../data/constants';
import { useToast } from '../../contexts/ToastContext';
import { saveProfile } from '../../utils/store';
import CardioApplySheet, { applyCardioScheduleUpdate } from './CardioApplySheet';
import type { CardioScheduleSlot, Profile } from '../../types';

const INTENSITY_COLOR: Record<string, string> = {
  Easy: '#6BCB77',
  Moderate: '#4EA8DE',
  Hard: '#E8651A',
};

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface CardioProtocolDetailProps {
  protocolId: string;
  profile: Profile | null;
  onProfileUpdate?: (updates: Partial<Profile>) => void;
  onBack: () => void;
}

function CardioProtocolDetail({
  protocolId,
  profile,
  onProfileUpdate,
  onBack,
}: CardioProtocolDetailProps) {
  const { showToast } = useToast();
  const [showSheet, setShowSheet] = useState(false);
  // Local mirror for optimistic rendering when parent doesn't pass onProfileUpdate
  const [localSchedule, setLocalSchedule] = useState<CardioScheduleSlot[] | null>(null);

  const w = CARDIO_WORKOUTS.find((x) => x.id === protocolId);
  if (!w) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={onBack} style={{ color: 'var(--accent)' }}>
          ← Back
        </button>
        <div style={{ marginTop: 20, color: 'var(--text-muted)' }}>Protocol not found.</div>
      </div>
    );
  }

  const schedule = localSchedule ?? profile?.cardioSchedule ?? [];
  const scheduledDays = schedule.filter((s) => s.protocol === protocolId).map((s) => s.dayOfWeek);
  const intensityColor = INTENSITY_COLOR[w.defaultIntensity] || 'var(--accent)';

  const handleApply = (nextSchedule: CardioScheduleSlot[], addedCount: number) => {
    if (!profile) return;
    const updated = applyCardioScheduleUpdate(profile, nextSchedule);
    saveProfile(updated);
    setLocalSchedule(nextSchedule);
    if (onProfileUpdate) onProfileUpdate({ cardioSchedule: nextSchedule });
    setShowSheet(false);
    const scheduledCount = nextSchedule.filter((s) => s.protocol === protocolId).length;
    if (scheduledCount === 0) {
      showToast(`Removed ${w.label} from schedule`, 'info');
    } else if (addedCount > 0) {
      showToast(`${w.label} scheduled · ${scheduledCount} day${scheduledCount === 1 ? '' : 's'}/week`, 'success');
    } else {
      showToast(`Schedule updated`, 'info');
    }
  };

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 120 }}>
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

      <div style={{ padding: '20px 16px 16px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'var(--accent)',
            marginBottom: 6,
          }}
        >
          {w.category.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.15,
            marginBottom: 14,
          }}
        >
          {w.label}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              background: 'var(--bg-inset)',
              padding: '4px 10px',
              borderRadius: tokens.radius.sm,
            }}
          >
            {w.defaultDuration} MIN
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: intensityColor,
              background: intensityColor + '1a',
              padding: '4px 10px',
              borderRadius: tokens.radius.sm,
            }}
          >
            {w.defaultIntensity.toUpperCase()}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.05em',
              color: 'var(--text-secondary)',
              background: 'var(--bg-inset)',
              padding: '4px 10px',
              borderRadius: tokens.radius.sm,
            }}
          >
            {w.defaultType.toUpperCase()}
          </span>
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            marginBottom: 20,
          }}
        >
          {w.description}
        </div>

        {w.intervals && (
          <div
            style={{
              marginBottom: 20,
              padding: '14px 16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.lg,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 10,
              }}
            >
              INTERVALS
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>WORK</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {w.intervals.workSecs}s
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>REST</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {w.intervals.restSecs}s
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                  ROUNDS
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {w.intervals.rounds}
                </div>
              </div>
            </div>
          </div>
        )}

        {scheduledDays.length > 0 && (
          <div
            style={{
              marginBottom: 20,
              padding: '14px 16px',
              background: 'rgba(var(--accent-rgb),0.07)',
              border: '1px solid rgba(var(--accent-rgb),0.2)',
              borderRadius: tokens.radius.lg,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'var(--accent)',
                marginBottom: 6,
              }}
            >
              SCHEDULED
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--text-primary)',
                lineHeight: 1.6,
              }}
            >
              {scheduledDays
                .sort((a, b) => a - b)
                .map((d) => DOW_FULL[d])
                .join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '12px 16px 18px',
          background: 'var(--bg-deep)',
          borderTop: '1px solid var(--border)',
          zIndex: 20,
        }}
      >
        <button
          onClick={() => setShowSheet(true)}
          disabled={!profile}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: tokens.radius.lg,
            background: profile ? 'var(--btn-primary-bg)' : 'var(--bg-inset)',
            border: `1px solid ${profile ? 'var(--btn-primary-border)' : 'var(--border)'}`,
            color: profile ? 'var(--btn-primary-text)' : 'var(--text-muted)',
            fontSize: 14,
            fontWeight: 800,
            cursor: profile ? 'pointer' : 'not-allowed',
            letterSpacing: '0.04em',
          }}
        >
          {scheduledDays.length > 0 ? 'Edit schedule' : 'Add to schedule'}
        </button>
      </div>

      {showSheet && profile && (
        <CardioApplySheet
          protocolId={w.id}
          protocolLabel={w.label}
          schedule={schedule}
          onApply={handleApply}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  );
}

export default CardioProtocolDetail;
