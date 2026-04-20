import React from 'react';
import { PHASE_COLOR } from '../../data/constants';
import { tokens } from '../../styles/tokens';

export type Phase = 'Establish' | 'Accumulation' | 'Intensification' | 'Peak' | 'Deload';

const PHASES: Phase[] = ['Establish', 'Accumulation', 'Intensification', 'Peak', 'Deload'];

const PHASE_LABEL_FULL: Record<Phase, string> = {
  Establish: 'ESTABLISH',
  Accumulation: 'ACCUMULATE',
  Intensification: 'INTENSIFY',
  Peak: 'PEAK',
  Deload: 'DELOAD',
};

const PHASE_LABEL_SHORT: Record<Phase, string> = {
  Establish: 'ESTAB',
  Accumulation: 'ACCUM',
  Intensification: 'INTENS',
  Peak: 'PEAK',
  Deload: 'DELOAD',
};

export interface PhaseBarProps {
  currentPhase?: Phase;
  variant?: 'static' | 'live';
  onPhaseTap?: (phase: Phase) => void;
  animate?: 'fill' | null;
  showLabels?: boolean;
}

export default function PhaseBar({
  currentPhase,
  variant = 'static',
  onPhaseTap,
  animate = null,
  showLabels = true,
}: PhaseBarProps) {
  const [mounted, setMounted] = React.useState(animate !== 'fill');
  const [isNarrow, setIsNarrow] = React.useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth < 390 : false,
  );

  React.useEffect(() => {
    if (animate === 'fill') {
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
  }, [animate]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsNarrow(window.innerWidth < 390);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const height = variant === 'live' ? 8 : 6;
  const labelMap = isNarrow ? PHASE_LABEL_SHORT : PHASE_LABEL_FULL;
  const segmentTappable = !!onPhaseTap;

  return (
    <div
      data-coach="phase-bar"
      style={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div
        role="group"
        aria-label="Mesocycle phase progression"
        style={{
          display: 'flex',
          gap: 4,
          width: '100%',
          alignItems: 'stretch',
        }}
      >
        {PHASES.map((phase, idx) => {
          const isActive = currentPhase === phase;
          const color = PHASE_COLOR[phase];
          const radiusStart = idx === 0 ? tokens.radius.sm : 0;
          const radiusEnd = idx === PHASES.length - 1 ? tokens.radius.sm : 0;
          const isDeloadActive = isActive && phase === 'Deload' && variant === 'live';

          const segmentStyle: React.CSSProperties = {
            flex: 1,
            height,
            background: color,
            opacity: currentPhase ? (isActive ? 1 : 0.3) : 0.55,
            borderRadius: `${radiusStart}px ${radiusEnd}px ${radiusEnd}px ${radiusStart}px`,
            transition: `opacity 300ms ease ${animate === 'fill' ? idx * 80 : 0}ms, transform 200ms ease`,
            transform: animate === 'fill' && !mounted ? 'scaleX(0)' : 'scaleX(1)',
            transformOrigin: 'left center',
            cursor: segmentTappable ? 'pointer' : 'default',
            padding: 0,
            border: 'none',
            boxShadow: isActive ? `0 0 8px rgba(232,101,26,0.35)` : 'none',
            animation: isDeloadActive ? 'phaseBarDeloadPulse 2s ease-in-out infinite' : undefined,
          };

          const content = (
            <div key={phase} style={segmentStyle} aria-current={isActive ? 'step' : undefined} />
          );

          if (!segmentTappable) return content;
          return (
            <button
              key={phase}
              type="button"
              onClick={() => onPhaseTap?.(phase)}
              aria-label={labelMap[phase]}
              aria-pressed={isActive}
              style={{
                flex: 1,
                padding: 0,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{ ...segmentStyle, flex: 1 }} />
            </button>
          );
        })}
      </div>

      {showLabels && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            width: '100%',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: tokens.colors.textMuted,
            textTransform: 'uppercase',
            fontFamily: "'Inter', system-ui, sans-serif",
          }}
        >
          {PHASES.map((phase) => (
            <div
              key={phase}
              style={{
                flex: 1,
                textAlign: 'center',
                color: currentPhase === phase ? PHASE_COLOR[phase] : tokens.colors.textMuted,
                opacity: currentPhase && currentPhase !== phase ? 0.5 : 1,
                transition: 'color 300ms ease, opacity 300ms ease',
              }}
            >
              {labelMap[phase]}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes phaseBarDeloadPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
