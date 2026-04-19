import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import PhaseBar, { Phase } from '../shared/PhaseBar';
import { PHASE_COLOR } from '../../data/constants';
import MiniDemoCard from './MiniDemoCard';

interface MicroTourProps {
  onDone: () => void;
  onSkip: () => void;
}

type Slide = 'shape' | 'progress' | 'demo';

const PHASE_DESCRIPTION: Record<Phase, string> = {
  Establish: 'Dial in form and starting loads. Quality before volume.',
  Accumulation: 'Pile on volume. Moderate weight, many sets. Growth zone.',
  Intensification: 'Heavier loads, fewer sets. Strength shows up.',
  Peak: 'Your best lifts of the block. Go.',
  Deload: 'Lighter week. Recovery is where growth happens.',
};

export default function MicroTour({ onDone, onSkip }: MicroTourProps) {
  const [slide, setSlide] = useState<Slide>('shape');
  const [tappedPhase, setTappedPhase] = useState<Phase | null>(null);

  const progress = slide === 'shape' ? 33 : slide === 'progress' ? 66 : 100;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: tokens.colors.bgRoot,
        color: tokens.colors.textPrimary,
        fontFamily: "'Inter', system-ui, sans-serif",
        maxWidth: 480,
        margin: '0 auto',
        padding: '20px 24px 32px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top bar: progress + skip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            flex: 1,
            height: 2,
            background: 'rgba(232,101,26,0.12)',
            borderRadius: tokens.radius.pill,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: tokens.colors.accent,
              borderRadius: tokens.radius.pill,
              transition: 'width 350ms ease',
            }}
          />
        </div>
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            color: tokens.colors.textMuted,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: '0.04em',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          Skip
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {slide === 'shape' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                  fontSize: 36,
                  letterSpacing: '0.12em',
                  lineHeight: 1,
                  marginBottom: 14,
                }}
              >
                THE SHAPE OF A MESO
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.6,
                }}
              >
                Five phases, four to six weeks. You build, peak, and recover — and every
                rep sets up the next one.
              </div>
            </div>

            <div
              style={{
                background: tokens.colors.bgCard,
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: tokens.radius.xl,
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
              }}
            >
              <PhaseBar
                currentPhase={tappedPhase ?? undefined}
                variant="static"
                onPhaseTap={(phase) => setTappedPhase(phase)}
              />
              <div
                style={{
                  minHeight: 60,
                  padding: '12px 14px',
                  background: tappedPhase ? tokens.colors.bgInset : 'transparent',
                  borderRadius: tokens.radius.md,
                  transition: 'background 200ms ease',
                }}
              >
                {tappedPhase ? (
                  <>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: PHASE_COLOR[tappedPhase],
                        marginBottom: 6,
                      }}
                    >
                      {tappedPhase === 'Accumulation'
                        ? 'ACCUMULATE'
                        : tappedPhase === 'Intensification'
                          ? 'INTENSIFY'
                          : tappedPhase.toUpperCase()}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: tokens.colors.textPrimary,
                      }}
                    >
                      {PHASE_DESCRIPTION[tappedPhase]}
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: 12,
                      color: tokens.colors.textMuted,
                      fontStyle: 'italic',
                    }}
                  >
                    Tap a phase to see what it does.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {slide === 'progress' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <div
                style={{
                  fontFamily: "'Bebas Neue', 'Inter', sans-serif",
                  fontSize: 36,
                  letterSpacing: '0.12em',
                  lineHeight: 1,
                  marginBottom: 14,
                }}
              >
                PROGRESS, LOGGED
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.6,
                }}
              >
                You log sets. Foundry decides what next week asks of you — a little more, always.
              </div>
            </div>
            <ProgressionSVG />
          </div>
        )}

        {slide === 'demo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: tokens.colors.accent,
                  marginBottom: 10,
                }}
              >
                Demo · tap the set
              </div>
              <div
                style={{
                  fontSize: 15,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.6,
                }}
              >
                This is what logging looks like. Tap the set to mark it complete.
              </div>
            </div>
            <MiniDemoCard onComplete={onDone} />
          </div>
        )}
      </div>

      {/* CTA — only on non-demo slides (demo has its own) */}
      {slide !== 'demo' && (
        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            onClick={() => setSlide(slide === 'shape' ? 'progress' : 'demo')}
            style={{
              width: '100%',
              padding: '16px',
              fontSize: 15,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              borderRadius: tokens.radius.xl,
              background: tokens.colors.btnPrimaryBg,
              border: `1px solid ${tokens.colors.btnPrimaryBorder}`,
              color: tokens.colors.btnPrimaryText,
              cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(232,101,26,0.35)',
            }}
          >
            {slide === 'shape' ? 'Next' : 'Try a set'}
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressionSVG() {
  // Inline SVG: 5 bars W1-W5, amber dot climbing, dashed deload gap
  return (
    <div
      style={{
        background: tokens.colors.bgCard,
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: tokens.radius.xl,
        padding: 24,
      }}
    >
      <svg
        viewBox="0 0 320 180"
        width="100%"
        height="180"
        aria-label="Weekly progression — rising then deload"
      >
        {/* Baseline */}
        <line
          x1="24"
          y1="150"
          x2="296"
          y2="150"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
        {/* Bars: W1 shortest, climbing to W4; W5 is deload (dashed & shorter) */}
        {[
          { x: 36, h: 40, label: 'W1' },
          { x: 88, h: 60, label: 'W2' },
          { x: 140, h: 82, label: 'W3' },
          { x: 192, h: 104, label: 'W4' },
          { x: 244, h: 34, label: 'W5', deload: true },
        ].map((b) => (
          <g key={b.label}>
            <rect
              x={b.x}
              y={150 - b.h}
              width={40}
              height={b.h}
              rx={4}
              fill={b.deload ? 'transparent' : tokens.colors.accent}
              stroke={b.deload ? '#5B8FA8' : 'transparent'}
              strokeWidth={b.deload ? 2 : 0}
              strokeDasharray={b.deload ? '4 3' : undefined}
              opacity={b.deload ? 0.9 : 1 - Math.abs(4 - parseInt(b.label[1])) * 0.05}
            />
            <text
              x={b.x + 20}
              y={166}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              letterSpacing="0.08em"
              fill={tokens.colors.textMuted}
            >
              {b.label}
            </text>
          </g>
        ))}
        {/* Climbing dot */}
        {[
          { x: 56, y: 110 },
          { x: 108, y: 90 },
          { x: 160, y: 68 },
          { x: 212, y: 46 },
        ].map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={tokens.colors.accent}
            opacity={0.9}
          />
        ))}
        <polyline
          points="56,110 108,90 160,68 212,46"
          stroke={tokens.colors.accent}
          strokeWidth="2"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.6}
        />
      </svg>
    </div>
  );
}
