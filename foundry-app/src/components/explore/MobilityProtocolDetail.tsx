import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { tokens } from '../../styles/tokens';
import { MOBILITY_PROTOCOLS } from '../../data/constants';
import { saveMobilitySession, saveProfile } from '../../utils/store';
import { useToast } from '../../contexts/ToastContext';
import MobilityApplySheet, { applyMobilityScheduleUpdate } from './MobilityApplySheet';
import type { MobilityScheduleSlot, Profile } from '../../types';

const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface MobilityProtocolDetailProps {
  protocolId: string;
  profile?: Profile | null;
  onProfileUpdate?: (updates: Partial<Profile>) => void;
  onBack: () => void;
}

function MobilityProtocolDetail({
  protocolId,
  profile,
  onProfileUpdate,
  onBack,
}: MobilityProtocolDetailProps) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [showSheet, setShowSheet] = useState(false);
  // Local mirror for optimistic rendering if parent doesn't provide onProfileUpdate
  const [localSchedule, setLocalSchedule] = useState<MobilityScheduleSlot[] | null>(null);

  const proto = MOBILITY_PROTOCOLS.find((p) => p.id === protocolId);

  if (!proto) {
    return (
      <div style={{ padding: 24 }}>
        <button onClick={onBack} style={{ color: 'var(--accent)' }}>
          ← Back
        </button>
        <div style={{ marginTop: 20, color: 'var(--text-muted)' }}>Protocol not found.</div>
      </div>
    );
  }

  const schedule = localSchedule ?? profile?.mobilitySchedule ?? [];
  const scheduledDays = schedule.filter((s) => s.protocol === protocolId).map((s) => s.dayOfWeek);

  const handleStart = () => {
    const today = new Date().toISOString().slice(0, 10);
    saveMobilitySession(today, {
      protocolId: proto.id,
      completed: false,
      completedAt: null,
    });
    navigate(`/mobility/${today}`);
  };

  const handleApply = (nextSchedule: MobilityScheduleSlot[], addedCount: number) => {
    if (!profile) return;
    const updated = applyMobilityScheduleUpdate(profile, nextSchedule);
    saveProfile(updated);
    setLocalSchedule(nextSchedule);
    if (onProfileUpdate) onProfileUpdate({ mobilitySchedule: nextSchedule });
    setShowSheet(false);
    const scheduledCount = nextSchedule.filter((s) => s.protocol === protocolId).length;
    if (scheduledCount === 0) {
      showToast(`Removed ${proto.name} from schedule`, 'info');
    } else if (addedCount > 0) {
      showToast(
        `${proto.name} scheduled · ${scheduledCount} day${scheduledCount === 1 ? '' : 's'}/week`,
        'success'
      );
    } else {
      showToast('Schedule updated', 'info');
    }
  };

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 180 }}>
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
          {proto.category.toUpperCase()}
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
          {proto.name}
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
            {proto.duration.toUpperCase()}
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
            {proto.moves.length} MOVES
          </span>
          {proto.dayTags?.map((t) => (
            <span
              key={t}
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
              {t}
            </span>
          ))}
        </div>
        <div
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            lineHeight: 1.65,
            marginBottom: 20,
          }}
        >
          {proto.description}
        </div>

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

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
            overflow: 'hidden',
          }}
        >
          {proto.moves.map((move, mi) => (
            <div
              key={mi}
              style={{
                padding: '14px 16px',
                borderBottom:
                  mi < proto.moves.length - 1 ? '1px solid var(--border-subtle)' : 'none',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                  }}
                >
                  {move.name}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  {move.reps}
                </span>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                  marginBottom: move.videoUrl ? 10 : 0,
                }}
              >
                {move.cue}
              </div>
              {move.videoUrl && (
                <a
                  href={move.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Watch ${move.name} technique on YouTube`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: tokens.radius.sm,
                    background: '#ff000018',
                    border: '1px solid #ff000044',
                    color: '#ff4444',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textDecoration: 'none',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#ff4444" aria-hidden="true">
                    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.8 15.5V8.5l6.3 3.5-6.3 3.5z" />
                  </svg>
                  Video
                </a>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky bottom CTAs — Start now + Add to schedule */}
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
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          onClick={handleStart}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: tokens.radius.lg,
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Start now
        </button>
        <button
          onClick={() => setShowSheet(true)}
          disabled={!profile}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: tokens.radius.lg,
            background: 'var(--bg-inset)',
            border: `1px solid ${profile ? 'var(--accent)' : 'var(--border)'}`,
            color: profile ? 'var(--accent)' : 'var(--text-muted)',
            fontSize: 13,
            fontWeight: 800,
            cursor: profile ? 'pointer' : 'not-allowed',
            letterSpacing: '0.04em',
          }}
        >
          {scheduledDays.length > 0 ? 'Edit schedule' : 'Add to schedule'}
        </button>
      </div>

      {showSheet && profile && (
        <MobilityApplySheet
          protocolId={proto.id}
          protocolLabel={proto.name}
          schedule={schedule}
          onApply={handleApply}
          onClose={() => setShowSheet(false)}
        />
      )}
    </div>
  );
}

export default MobilityProtocolDetail;
