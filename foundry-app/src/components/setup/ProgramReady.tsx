import { useEffect } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';
import { formatSplitName } from '../../utils/splitLabel';
import PhaseBar from '../shared/PhaseBar';
import type { Phase } from '../shared/PhaseBar';

interface ProgramReadyProps {
  profile: {
    name?: string;
    mesoLength?: number;
    splitType?: string;
    startDate?: string;
  };
  onContinue: () => void;
}

/**
 * First-meso interstitial. Shown once per user after SetupPage.onComplete.
 * Flag `foundry:program_ready_shown` gates it — subsequent mesos skip.
 *
 * Medium animation: PhaseBar segments fill left-to-right on mount (staggered).
 */
export default function ProgramReady({ profile, onContinue }: ProgramReadyProps) {
  useEffect(() => {
    store.set('foundry:program_ready_shown', '1');
  }, []);

  const splitLabel = formatSplitName(profile.splitType);

  const startLabel = (() => {
    if (!profile.startDate) return 'starting today';
    const d = new Date(profile.startDate + 'T00:00:00');
    const opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
    return `starting ${d.toLocaleDateString(undefined, opts)}`;
  })();

  const lengthLabel = profile.mesoLength ? `${profile.mesoLength}-week ${splitLabel.toLowerCase()} mesocycle` : splitLabel;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'center',
        padding: '32px 24px',
        maxWidth: 480,
        margin: '0 auto',
        gap: 36,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: tokens.colors.accent,
          }}
        >
          Program ready
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 'clamp(36px, 9vw, 48px)',
            letterSpacing: '0.1em',
            lineHeight: 1,
            color: tokens.colors.textPrimary,
          }}
        >
          YOUR PROGRAM IS READY
        </div>
        <div
          style={{
            fontSize: 15,
            color: tokens.colors.textSecondary,
            lineHeight: 1.5,
            maxWidth: 320,
          }}
        >
          {lengthLabel}
          {profile.startDate ? <><br />{startLabel}</> : null}
        </div>
      </div>

      <PhaseBar variant="static" animate="fill" currentPhase={'Establish' as Phase} />

      <button
        type="button"
        onClick={onContinue}
        style={{
          width: '100%',
          padding: '16px',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderRadius: tokens.radius.xl,
          background: tokens.colors.btnPrimaryBg,
          border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
          color: tokens.colors.btnPrimaryText,
          cursor: 'pointer',
          boxShadow: '0 4px 24px rgba(232,101,26,0.35)',
        }}
      >
        Let's go
      </button>
    </div>
  );
}
