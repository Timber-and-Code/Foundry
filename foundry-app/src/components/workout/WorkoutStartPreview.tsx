/**
 * WorkoutStartPreview — interactive mockup of the simplified start flow.
 * Mounted at /preview/workout-start (DEV only).
 *
 * Click-through walks the user from Home tap → workout in progress, showing
 * how the new flow eliminates the splash gate and the 6-tap readiness sheet.
 */
import { useState } from 'react';
import { tokens } from '../../styles/tokens';

type Step = 'home' | 'preview' | 'workout-fresh' | 'workout-mood-set' | 'workout-logging';
type Mood = 'off' | 'ok' | 'strong';

const FAKE_EXERCISES = [
  { name: 'Incline Dumbbell Press', sets: 3, reps: '8–10', rest: '2 min' },
  { name: 'Cable Chest Fly', sets: 3, reps: '10–12', rest: '90 sec' },
  { name: 'Overhead Press (BB)', sets: 3, reps: '6–8', rest: '2 min' },
  { name: 'Lateral Raise', sets: 4, reps: '12–15', rest: '60 sec' },
  { name: 'Triceps Pushdown', sets: 3, reps: '10–12', rest: '90 sec' },
];

const PHASE = 'Hypertrophy';
const PHASE_COLOR = '#E89B3C';

type DetailReadiness = { sleep: string | null; soreness: string | null; energy: string | null };

export default function WorkoutStartPreview() {
  const [step, setStep] = useState<Step>('home');
  const [mood, setMood] = useState<Mood | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<DetailReadiness>({
    sleep: null,
    soreness: null,
    energy: null,
  });

  const reset = () => {
    setStep('home');
    setMood(null);
    setOverviewOpen(false);
    setDetailOpen(false);
    setDetail({ sleep: null, soreness: null, energy: null });
  };

  const stepIdx = (['home', 'preview', 'workout-fresh', 'workout-mood-set', 'workout-logging'] as Step[]).indexOf(step);

  const detailComplete = !!(detail.sleep && detail.soreness && detail.energy);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-root, #0A0A0C)',
        color: 'var(--text-primary, #E8E4DC)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Sticky preview meta bar */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(10, 10, 12, 0.95)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border, rgba(255,255,255,0.08))',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', system-ui, sans-serif",
              fontSize: 16,
              letterSpacing: '0.08em',
              color: 'var(--accent, #E89B3C)',
            }}
          >
            START FLOW MOCKUP
          </div>
          <button
            onClick={reset}
            style={{
              background: 'transparent',
              border: '1px solid var(--border, rgba(255,255,255,0.15))',
              color: 'var(--text-secondary, #999)',
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 999,
              cursor: 'pointer',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Reset
          </button>
        </div>

        <StepIndicator stepIdx={stepIdx} total={5} />

        <div style={{ fontSize: 11, color: 'var(--text-muted, #777)', lineHeight: 1.4 }}>
          {step === 'home' && (
            <>
              <strong>Step 1.</strong> Home today card with TWO actions:{' '}
              <em style={{ color: 'var(--accent, #E89B3C)' }}>Preview</em> (full-screen workout
              breakdown — kept exactly as today&rsquo;s WorkoutSplash) or{' '}
              <em style={{ color: 'var(--accent, #E89B3C)' }}>Start →</em> (one tap straight in,
              skipping the splash gate).
            </>
          )}
          {step === 'preview' && (
            <>
              <strong>Step 1b.</strong> Workout Preview = current WorkoutSplash component, unchanged
              — phase chip, large day name, target RIR, full exercise list, friends strip. Just NO
              LONGER a forced gate. Tap{' '}
              <em style={{ color: 'var(--accent, #E89B3C)' }}>Start →</em> from here, or{' '}
              <em>← Back</em> to return to Home without committing.
            </>
          )}
          {step === 'workout-fresh' && (
            <>
              <strong>Step 2.</strong> NEW: lands directly in Focus Mode — no splash modal. Phase
              chip + ProgressStrip unchanged. Two new things slot in: a 1-tap mood strip (replacing
              the 6-tap readiness sheet) and a collapsible workout overview accordion. The active
              exercise card, UpNext, and FocusNav below are all unchanged from today.
            </>
          )}
          {step === 'workout-mood-set' && (
            <>
              <strong>Step 3.</strong> Mood logged in 1 tap. Strip collapses to{' '}
              <em>READINESS · STRONG ✓</em>. Tap a set checkbox to log.
            </>
          )}
          {step === 'workout-logging' && (
            <>
              <strong>Step 4.</strong> First set logged. Overview accordion auto-collapses, focus is
              on the work. Everything below the new top section is the existing Focus Mode chrome.
            </>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 80px' }}>
        {step === 'home' && (
          <HomeTodayCard
            onPreview={() => setStep('preview')}
            onStart={() => setStep('workout-fresh')}
          />
        )}

        {step === 'preview' && (
          <WorkoutPreview
            onBack={() => setStep('home')}
            onStart={() => setStep('workout-fresh')}
          />
        )}

        {(step === 'workout-fresh' || step === 'workout-mood-set' || step === 'workout-logging') && (
          <FocusModeView
            mood={mood}
            overviewOpen={overviewOpen}
            firstSetDone={step === 'workout-logging'}
            detailOpen={detailOpen}
            detail={detail}
            detailComplete={detailComplete}
            onMoodPick={(m) => {
              setMood(m);
              setDetailOpen(false);
              if (step === 'workout-fresh') setStep('workout-mood-set');
            }}
            onDetailOpen={() => setDetailOpen(true)}
            onDetailClose={() => setDetailOpen(false)}
            onDetailUpdate={(key, val) => {
              const next = { ...detail, [key]: val };
              setDetail(next);
              if (next.sleep && next.soreness && next.energy) {
                // detail-mode "complete" → derive a coarse mood for the collapsed status
                const score =
                  (next.sleep === 'good' ? 2 : next.sleep === 'ok' ? 1 : 0) +
                  (next.soreness === 'low' ? 2 : next.soreness === 'moderate' ? 1 : 0) +
                  (next.energy === 'high' ? 2 : next.energy === 'moderate' ? 1 : 0);
                const derived: Mood = score >= 5 ? 'strong' : score >= 3 ? 'ok' : 'off';
                setMood(derived);
                setDetailOpen(false);
                if (step === 'workout-fresh') setStep('workout-mood-set');
              }
            }}
            onOverviewToggle={() => setOverviewOpen((o) => !o)}
            onSetCheck={() => {
              if (step !== 'workout-logging') {
                setStep('workout-logging');
                setOverviewOpen(false);
              }
            }}
          />
        )}
      </div>

      <div
        style={{
          maxWidth: 480,
          margin: '24px auto 16px',
          padding: '16px',
          fontSize: 11,
          color: 'var(--text-muted, #777)',
          lineHeight: 1.6,
          borderTop: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
        }}
      >
        <div style={{ marginBottom: 8, color: 'var(--text-secondary, #999)', fontWeight: 700 }}>
          What changed vs. today
        </div>
        <div>• <strong style={{ color: 'var(--text-primary, #E8E4DC)' }}>WorkoutSplash preview is preserved as a first-class surface</strong> — phase chip, day name, target RIR, full exercise list, friends strip. Same component used today in Schedule tab&rsquo;s &ldquo;View&rdquo; mode. Now it&rsquo;s opt-in via the Preview button instead of being a forced gate before Start.</div>
        <div>• Workout overview accordion inside DayView is a SECONDARY surface — closed by default, available mid-workout if you want to scan ahead. The Home Preview is the primary preview moment.</div>
        <div>• ReadinessSheet (Sleep / Soreness / Energy × 3 buttons each = 6 taps) replaced with a 1-tap mood strip. Detailed form still reachable via &ldquo;more detail ›&rdquo;.</div>
        <div>• Workout never blocked on readiness — the strip is optional; tap a set to bypass.</div>
        <div>• Net: 1 tap to Start, optional 1 tap to Preview first.</div>
      </div>
    </div>
  );
}

/* ----- Step indicator ----- */

function StepIndicator({ stepIdx, total }: { stepIdx: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background: i <= stepIdx ? 'var(--accent, #E89B3C)' : 'rgba(255,255,255,0.1)',
            transition: 'background 200ms ease',
          }}
        />
      ))}
    </div>
  );
}

/* ----- Step 1: Home today card (Preview + Start, two affordances) ----- */

function HomeTodayCard({
  onPreview,
  onStart,
}: {
  onPreview: () => void;
  onStart: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card, #16161A)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: tokens.radius.xl,
        padding: 18,
        marginTop: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: 'var(--text-muted, #777)',
          }}
        >
          TODAY · WK 4 / 7
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            padding: '3px 8px',
            borderRadius: 999,
            background: PHASE_COLOR + '22',
            color: PHASE_COLOR,
          }}
        >
          {PHASE.toUpperCase()}
        </div>
      </div>

      <div
        style={{
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontSize: 38,
          color: 'var(--text-primary, #E8E4DC)',
          lineHeight: 1,
          marginBottom: 4,
          letterSpacing: '0.02em',
        }}
      >
        PUSH A
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-secondary, #aaa)', marginBottom: 16 }}>
        5 exercises · ~50 min · target 1–2 RIR
      </div>

      {/* Two buttons — Preview (secondary) + Start (primary) */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onPreview}
          style={{
            flex: '0 0 38%',
            padding: 14,
            background: 'transparent',
            border: '2px solid var(--border, rgba(255,255,255,0.18))',
            color: 'var(--text-primary, #E8E4DC)',
            borderRadius: tokens.radius.lg,
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 16,
            letterSpacing: '0.1em',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Preview
        </button>
        <button
          onClick={onStart}
          style={{
            flex: 1,
            padding: 14,
            background: 'transparent',
            border: '1px solid #E8651A',
            color: '#E8651A',
            borderRadius: tokens.radius.lg,
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 18,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            boxShadow: '0 0 0 1px #E8651A',
          }}
        >
          Start <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

/* ----- Step 1b: Workout Preview (mirrors current WorkoutSplash) ----- */

function WorkoutPreview({
  onBack,
  onStart,
}: {
  onBack: () => void;
  onStart: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-root, #0A0A0C)',
        border: `2px solid ${PHASE_COLOR}`,
        borderRadius: tokens.radius.xxl,
        padding: '20px 22px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        marginTop: 16,
      }}
    >
      {/* Phase chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            padding: '4px 10px',
            borderRadius: 999,
            background: PHASE_COLOR + '22',
            color: PHASE_COLOR,
            border: `1px solid ${PHASE_COLOR}55`,
          }}
        >
          {PHASE.toUpperCase()}
        </div>
      </div>

      {/* Meta line */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--text-muted, #777)',
          letterSpacing: '0.14em',
        }}
      >
        WEEK 4 / 7 · DAY 1
      </div>

      {/* Title */}
      <div
        style={{
          fontFamily: "'Bebas Neue', system-ui, sans-serif",
          fontSize: 40,
          color: 'var(--text-primary, #E8E4DC)',
          lineHeight: 1.0,
          letterSpacing: '0.02em',
        }}
      >
        PUSH A
      </div>

      {/* Target RIR pill */}
      <div
        style={{
          alignSelf: 'flex-start',
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '8px 14px',
          background: 'var(--bg-card, #16161A)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: 999,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.1em',
            color: 'var(--text-muted, #777)',
          }}
        >
          TARGET
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 800,
            color: 'var(--text-primary, #E8E4DC)',
          }}
        >
          1–2 RIR
        </span>
      </div>

      {/* Exercise list */}
      <div
        style={{
          background: 'var(--bg-card, #16161A)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
        }}
      >
        {FAKE_EXERCISES.map((ex, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              padding: '10px 14px',
              borderBottom:
                i < FAKE_EXERCISES.length - 1
                  ? '1px solid var(--border-subtle, rgba(255,255,255,0.06))'
                  : 'none',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'var(--text-muted, #777)',
                width: 18,
              }}
            >
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--text-primary, #E8E4DC)',
                }}
              >
                {ex.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary, #888)', marginTop: 1 }}>
                {ex.sets} sets · {ex.reps} reps · {ex.rest}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Friends strip placeholder */}
      <div
        style={{
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.02)',
          borderRadius: tokens.radius.md,
          fontSize: 11,
          color: 'var(--text-muted, #777)',
          letterSpacing: '0.06em',
          textAlign: 'center',
        }}
      >
        FRIENDS STRIP · (mockup placeholder — real impl shows shared-meso members)
      </div>

      {/* Back + Start */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onBack}
          style={{
            flex: '0 0 36%',
            padding: '14px 10px',
            borderRadius: tokens.radius.lg,
            background: 'transparent',
            border: '2px solid var(--border, rgba(255,255,255,0.18))',
            color: 'var(--text-primary, #E8E4DC)',
            fontSize: 13,
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          <span aria-hidden="true">←</span> Back
        </button>
        <button
          onClick={onStart}
          style={{
            flex: 1,
            padding: 16,
            borderRadius: tokens.radius.lg,
            background: 'transparent',
            border: '1px solid #E8651A',
            color: '#E8651A',
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 22,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '0 0 0 1px #E8651A',
          }}
        >
          Start Workout <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

/* ----- Steps 2-4: Focus Mode shell with new mood + overview slotted on top ----- */

function FocusModeView({
  mood,
  overviewOpen,
  firstSetDone,
  detailOpen,
  detail,
  detailComplete,
  onMoodPick,
  onDetailOpen,
  onDetailClose,
  onDetailUpdate,
  onOverviewToggle,
  onSetCheck,
}: {
  mood: Mood | null;
  overviewOpen: boolean;
  firstSetDone: boolean;
  detailOpen: boolean;
  detail: DetailReadiness;
  detailComplete: boolean;
  onMoodPick: (m: Mood) => void;
  onDetailOpen: () => void;
  onDetailClose: () => void;
  onDetailUpdate: (key: keyof DetailReadiness, val: string) => void;
  onOverviewToggle: () => void;
  onSetCheck: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ── Phase chip + meta line — small, top of view ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: '0.12em',
            padding: '3px 8px',
            borderRadius: 999,
            background: PHASE_COLOR + '22',
            color: PHASE_COLOR,
            border: `1px solid ${PHASE_COLOR}55`,
          }}
        >
          {PHASE.toUpperCase()}
        </div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text-muted, #777)',
            letterSpacing: '0.14em',
          }}
        >
          WK 4 / 7 · TARGET 1–2 RIR · PUSH A
        </div>
      </div>

      {/* ── ProgressStrip (unchanged from today) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${FAKE_EXERCISES.length}, 1fr)`,
          gap: 4,
          marginTop: 4,
        }}
      >
        {FAKE_EXERCISES.map((_, i) => (
          <div
            key={i}
            style={{
              height: 8,
              borderRadius: 2,
              background:
                i === 0
                  ? 'var(--text-secondary, #aaa)'
                  : 'var(--border-subtle, rgba(255,255,255,0.08))',
            }}
          />
        ))}
      </div>

      {/* ── NEW: 1-tap mood strip (replaces ReadinessSheet) ── */}
      {!mood && !detailOpen && (
        <div
          style={{
            background: 'var(--bg-card, #16161A)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: tokens.radius.lg,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted, #777)',
              }}
            >
              HOW ARE YOU FEELING?
            </div>
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #666)',
                fontSize: 11,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              skip ›
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['off', 'ok', 'strong'] as Mood[]).map((m) => (
              <button
                key={m}
                onClick={() => onMoodPick(m)}
                style={{
                  flex: 1,
                  padding: '12px 8px',
                  background: 'transparent',
                  border: '1px solid var(--border, rgba(255,255,255,0.12))',
                  borderRadius: tokens.radius.md,
                  color: 'var(--text-primary, #E8E4DC)',
                  fontFamily: "'Bebas Neue', system-ui, sans-serif",
                  fontSize: 16,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={onDetailOpen}
            style={{
              fontSize: 10,
              color: 'var(--text-muted, #888)',
              textAlign: 'center',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              letterSpacing: '0.06em',
            }}
          >
            more detail ›
          </button>
        </div>
      )}

      {/* ── Detail mode: full Sleep/Soreness/Energy form (existing ReadinessSheet, inline) ── */}
      {detailOpen && (
        <div
          style={{
            background: 'var(--bg-card, #16161A)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderRadius: tokens.radius.lg,
            padding: '14px 14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted, #777)',
              }}
            >
              READINESS DETAIL
            </div>
            <button
              onClick={onDetailClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted, #888)',
                fontSize: 11,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              ‹ back to mood
            </button>
          </div>

          {(
            [
              { key: 'sleep', label: 'SLEEP', opts: [{ v: 'poor', l: 'Poor' }, { v: 'ok', l: 'OK' }, { v: 'good', l: 'Good' }] },
              { key: 'soreness', label: 'SORENESS', opts: [{ v: 'high', l: 'High' }, { v: 'moderate', l: 'Moderate' }, { v: 'low', l: 'Low' }] },
              { key: 'energy', label: 'ENERGY', opts: [{ v: 'low', l: 'Low' }, { v: 'moderate', l: 'Moderate' }, { v: 'high', l: 'High' }] },
            ] as { key: keyof DetailReadiness; label: string; opts: { v: string; l: string }[] }[]
          ).map((sig) => (
            <div key={sig.key}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.16em',
                  color: 'var(--text-muted, #777)',
                  marginBottom: 8,
                }}
              >
                {sig.label}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {sig.opts.map((opt) => {
                  const sel = detail[sig.key] === opt.v;
                  return (
                    <button
                      key={opt.v}
                      onClick={() => onDetailUpdate(sig.key, opt.v)}
                      style={{
                        flex: 1,
                        padding: '11px 6px',
                        borderRadius: tokens.radius.md,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 700,
                        background: sel ? 'rgba(232,155,60,0.18)' : 'transparent',
                        border: `1px solid ${sel ? 'var(--accent, #E89B3C)' : 'var(--border, rgba(255,255,255,0.12))'}`,
                        color: sel ? 'var(--accent, #E89B3C)' : 'var(--text-primary, #E8E4DC)',
                      }}
                    >
                      {opt.l}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {!detailComplete && (
            <div style={{ fontSize: 10, color: 'var(--text-muted, #666)', textAlign: 'center' }}>
              Pick all three to log readiness
            </div>
          )}
        </div>
      )}

      {mood && (
        <button
          onClick={() => onMoodPick(mood)}
          style={{
            background: 'var(--bg-card, #16161A)',
            border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))',
            borderRadius: tokens.radius.md,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: 'var(--text-secondary, #aaa)',
            fontSize: 11,
            letterSpacing: '0.08em',
          }}
        >
          <span>READINESS · {mood.toUpperCase()} ✓</span>
          <span style={{ color: 'var(--text-muted, #555)' }}>change</span>
        </button>
      )}

      {/* ── NEW: workout overview accordion (replaces splash content) ── */}
      <div
        style={{
          background: 'var(--bg-card, #16161A)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          borderRadius: tokens.radius.lg,
          overflow: 'hidden',
        }}
      >
        <button
          onClick={onOverviewToggle}
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted, #888)',
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.12em',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>TODAY&rsquo;S OVERVIEW · {FAKE_EXERCISES.length} EXERCISES</span>
          <span style={{ transform: overviewOpen ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            ⌄
          </span>
        </button>
        {overviewOpen && (
          <div style={{ padding: '0 14px 10px' }}>
            {FAKE_EXERCISES.map((ex, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderTop: i > 0 ? '1px solid var(--border-subtle, rgba(255,255,255,0.04))' : 'none',
                  opacity: i === 0 ? 1 : 0.7,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: i === 0 ? 'var(--accent, #E89B3C)' : 'var(--text-muted, #666)',
                    width: 16,
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, fontSize: 13 }}>{ex.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary, #888)' }}>
                  {ex.sets} × {ex.reps}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Active exercise card (Focus Mode treatment — unchanged from today) ── */}
      <div style={{ marginTop: 4 }}>
        <FakeExerciseCard
          exercise={FAKE_EXERCISES[0]}
          active
          sets={[
            { weight: '85', reps: '10', done: firstSetDone },
            { weight: '85', reps: '', done: false },
            { weight: '85', reps: '', done: false },
          ]}
          onSetCheck={onSetCheck}
        />
      </div>

      {/* ── UpNextCard (unchanged from today) ── */}
      <button
        type="button"
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 14px',
          background: 'var(--bg-card, #16161A)',
          border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
          borderRadius: tokens.radius.md,
          color: 'var(--text-secondary, #aaa)',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted, #777)', letterSpacing: '0.14em' }}>
            UP NEXT
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-primary, #E8E4DC)' }}>
            {FAKE_EXERCISES[1].name}
          </div>
        </div>
        <span style={{ color: 'var(--text-muted, #666)' }}>→</span>
      </button>

      {/* ── FocusNav (unchanged from today) ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 40px',
          gap: 8,
          alignItems: 'center',
          padding: '6px 0',
        }}
      >
        <button
          type="button"
          aria-label="Previous exercise"
          style={{
            height: 40,
            background: 'transparent',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: tokens.radius.md,
            color: 'var(--text-muted, #666)',
            cursor: 'pointer',
          }}
        >
          ◀
        </button>
        <button
          type="button"
          style={{
            height: 40,
            background: 'transparent',
            border: '1px solid var(--border, rgba(255,255,255,0.12))',
            borderRadius: tokens.radius.md,
            color: 'var(--text-primary, #E8E4DC)',
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 14,
            letterSpacing: '0.12em',
            cursor: 'pointer',
          }}
        >
          PUSH A <span style={{ color: 'var(--text-muted, #666)' }}>· OVERVIEW</span>
        </button>
        <button
          type="button"
          aria-label="Next exercise"
          style={{
            height: 40,
            background: 'transparent',
            border: '1px solid var(--border, rgba(255,255,255,0.1))',
            borderRadius: tokens.radius.md,
            color: 'var(--text-muted, #666)',
            cursor: 'pointer',
          }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}

function FakeExerciseCard({
  exercise,
  active,
  sets,
  onSetCheck,
}: {
  exercise: { name: string; sets: number; reps: string; rest: string };
  active: boolean;
  sets: { weight: string; reps: string; done: boolean }[];
  onSetCheck: () => void;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card, #16161A)',
        border: `1px solid ${active ? 'var(--accent, #E89B3C)' : 'var(--border, rgba(255,255,255,0.08))'}`,
        borderRadius: tokens.radius.lg,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
        <div
          style={{
            fontFamily: "'Bebas Neue', system-ui, sans-serif",
            fontSize: 18,
            color: 'var(--text-primary, #E8E4DC)',
            letterSpacing: '0.02em',
          }}
        >
          {exercise.name.toUpperCase()}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>
          {exercise.sets} × {exercise.reps}
        </div>
      </div>
      {active && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sets.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 8px',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 10, color: 'var(--text-muted, #666)', width: 18 }}>{i + 1}</div>
              <input
                value={s.weight}
                readOnly
                placeholder="lbs"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  borderRadius: 4,
                  color: 'var(--text-primary, #E8E4DC)',
                  fontSize: 13,
                  padding: '6px 8px',
                  textAlign: 'center',
                }}
              />
              <input
                value={s.reps}
                readOnly
                placeholder="reps"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid var(--border-subtle, rgba(255,255,255,0.06))',
                  borderRadius: 4,
                  color: 'var(--text-primary, #E8E4DC)',
                  fontSize: 13,
                  padding: '6px 8px',
                  textAlign: 'center',
                }}
              />
              <button
                onClick={onSetCheck}
                aria-label={`Mark set ${i + 1} done`}
                style={{
                  width: 32,
                  height: 32,
                  background: s.done ? 'var(--accent, #E89B3C)' : 'transparent',
                  border: `1.5px solid ${s.done ? 'var(--accent, #E89B3C)' : 'var(--border, rgba(255,255,255,0.2))'}`,
                  borderRadius: 999,
                  color: s.done ? '#000' : 'var(--text-muted, #666)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                {s.done ? '✓' : ''}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
