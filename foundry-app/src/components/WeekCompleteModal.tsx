import { tokens } from '../styles/tokens';
import MesoRecap from './MesoRecap';
import type { Profile } from '../types';

export interface WeekCompleteModalData {
  isFinal: boolean;
  week?: number;
  weekIdx: number;
  volume: number;
  sets: number;
  sessions: number;
  totalSessions: number;
  prs: number;
  mesoTotalVolume: number;
  mesoCompletedSessions: number;
  mesoTotalSessions: number;
  mesoTotalPRs: number;
  anchorGains: { name: string; delta: number; start?: number; peak?: number; peakWeek?: number; weekly?: number[] }[];
  /** Volume per week of the meso, deload last. Final week only. */
  mesoWeeklyVolume?: number[];
}

interface WeekCompleteModalProps {
  modal: WeekCompleteModalData;
  profile: Profile;
  onDismiss: () => void;
  onViewSummary?: () => void;
}

export default function WeekCompleteModal({ modal, profile, onDismiss, onViewSummary }: WeekCompleteModalProps) {
  if (modal.isFinal) {
    // Dismissing reveals MesoCompleteSheet, which owns the choice of what
    // comes next and archives the meso as COMPLETED.
    return <MesoRecap modal={modal} profile={profile} onContinue={onDismiss} />;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(0,0,0,0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xl,
          padding: '28px 24px',
          width: '100%',
          maxWidth: 380,
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🗓️</div>
          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--text-primary)',
              letterSpacing: '-0.01em',
            }}
          >
            {profile?.name ? `Strong week, ${profile.name}.` : `Week ${modal.weekIdx + 1} Done`}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            {`Week ${modal.weekIdx + 1} · ${modal.sessions} sessions completed`}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 8,
            marginBottom: 22,
          }}
        >
          {[
            { label: 'SETS', value: modal.sets },
            {
              label: 'VOLUME',
              value: modal.volume >= 1000 ? `${(modal.volume / 1000).toFixed(1)}k` : modal.volume,
              unit: 'lbs',
            },
            { label: 'PRs', value: modal.prs || 0 },
          ].map(({ label, value, unit }) => (
            <div
              key={label}
              style={{
                background: 'var(--bg-inset)',
                borderRadius: tokens.radius.lg,
                padding: '12px 8px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: 'var(--phase-intens)',
                  lineHeight: 1,
                }}
              >
                {value}
              </div>
              {unit && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text-dim)',
                    marginTop: 1,
                  }}
                >
                  {unit}
                </div>
              )}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                {label}
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={onViewSummary}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: 14,
              fontWeight: 700,
              borderRadius: tokens.radius.lg,
              background: 'var(--btn-primary-bg)',
              border: '1px solid var(--btn-primary-border)',
              color: 'var(--btn-primary-text)',
            }}
          >
            View Meso Overview →
          </button>
          <button
            onClick={onDismiss}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: tokens.radius.lg,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
            }}
          >
            Continue Training
          </button>
        </div>
      </div>
    </div>
  );
}
