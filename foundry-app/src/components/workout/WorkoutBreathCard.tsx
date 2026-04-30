import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { store } from '../../utils/store';

type Rpe = 'Easy' | 'Good' | 'Hard';

interface WorkoutBreathCardProps {
  dayIdx: number;
  weekIdx: number;
  note: string;
  onNoteChange: (note: string) => void;
  onFinish: (rpe: Rpe | null) => void;
  onKeepGoing?: () => void;
}

const RPE_OPTIONS: { v: Rpe; label: string; hint: string; color: string }[] = [
  { v: 'Easy', label: 'Easy',  hint: 'Could keep going',     color: 'var(--success)' },
  { v: 'Good', label: 'Good',  hint: 'Hit my targets',       color: 'var(--text-accent)' },
  { v: 'Hard', label: 'Hard',  hint: 'Near or at the limit', color: 'var(--danger)' },
];

export default function WorkoutBreathCard({
  dayIdx,
  weekIdx,
  note,
  onNoteChange,
  onFinish,
  onKeepGoing,
}: WorkoutBreathCardProps) {
  const [rpe, setRpe] = useState<Rpe | null>(() => {
    const saved = store.get(`foundry:workout-rpe:d${dayIdx}:w${weekIdx}`);
    return saved === 'Easy' || saved === 'Good' || saved === 'Hard' ? saved : null;
  });
  const [noteOpen, setNoteOpen] = useState<boolean>(!!note);

  const commitRpe = (val: Rpe) => {
    setRpe(val);
    store.set(`foundry:workout-rpe:d${dayIdx}:w${weekIdx}`, val);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: tokens.colors.overlayHeavy,
        zIndex: 220,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        animation: 'breathCardFadeIn 320ms ease-out both',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="breath-card-title"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: tokens.radius.xxl,
          width: '100%',
          maxWidth: 440,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          padding: '32px 24px 24px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.45)',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.18em',
              color: 'var(--accent)',
              textTransform: 'uppercase',
            }}
          >
            Workout Complete
          </div>
          <div
            id="breath-card-title"
            style={{
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 32,
              fontWeight: 400,
              letterSpacing: '0.02em',
              color: 'var(--text-primary)',
              lineHeight: 1.05,
            }}
          >
            Take a breath.
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              lineHeight: 1.5,
            }}
          >
            How did that feel? Quick reflection — then we&rsquo;ll wrap.
          </div>
        </div>

        {/* RPE selector */}
        <div>
          <div
            id="breath-rpe-label"
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Effort
          </div>
          <div role="group" aria-labelledby="breath-rpe-label" style={{ display: 'flex', gap: 6 }}>
            {RPE_OPTIONS.map((opt) => {
              const sel = rpe === opt.v;
              return (
                <button
                  key={opt.v}
                  aria-pressed={sel}
                  onClick={() => commitRpe(opt.v)}
                  style={{
                    flex: 1,
                    padding: '12px 6px',
                    borderRadius: tokens.radius.md,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 700,
                    background: sel ? 'rgba(var(--accent-rgb),0.18)' : 'var(--bg-deep, #0e0c0a)',
                    border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-accent)'}`,
                    color: sel ? 'var(--accent)' : 'var(--text-primary)',
                    transition: 'all 0.12s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span style={{ color: opt.color, fontWeight: 800 }}>{opt.label}</span>
                  <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-muted)' }}>
                    {opt.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Add a note */}
        {!noteOpen ? (
          <button
            onClick={() => setNoteOpen(true)}
            style={{
              padding: '12px 14px',
              background: 'transparent',
              border: '1px dashed var(--border-accent)',
              borderRadius: tokens.radius.md,
              color: 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.04em',
              cursor: 'pointer',
            }}
          >
            + Add a note
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.16em',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              Note
            </div>
            <textarea
              autoFocus
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Anything to remember for next time?"
              rows={3}
              style={{
                background: 'var(--bg-deep, #0e0c0a)',
                border: '1px solid var(--border-accent)',
                borderRadius: tokens.radius.md,
                color: 'var(--text-primary)',
                fontSize: 13,
                padding: '10px 12px',
                fontFamily: 'inherit',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
          {onKeepGoing && (
            <button
              onClick={onKeepGoing}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-accent)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                padding: '10px 4px',
              }}
            >
              Keep going
            </button>
          )}
          <button
            onClick={() => onFinish(rpe)}
            style={{
              flex: 1,
              padding: 16,
              borderRadius: tokens.radius.md,
              // Solid dark fill + outlined-orange lettering — matches Home's
              // Start button visually (transparent on a dark card reads as
              // black; explicit bg-root removes ambiguity inside the modal).
              background: 'var(--bg-root)',
              border: '1px solid var(--accent)',
              color: 'var(--accent)',
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 22,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            Complete Workout <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <style>{`
        @keyframes breathCardFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
