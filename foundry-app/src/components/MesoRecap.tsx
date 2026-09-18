/**
 * The end-of-meso summary — shown once when the deload's last session is
 * logged, before "What's next?".
 *
 * Speaks the same visual language as the exercise history sheet: Bebas
 * numbers, ember for the standout, and the shared WeekBars chart — volume
 * across the whole block, then one small chart per anchor lift showing its
 * top weight week by week.
 */
import { getMeso } from '../data/constants';
import { tokens } from '../styles/tokens';
import WeekBars from './shared/WeekBars';
import type { Profile } from '../types';
import type { WeekCompleteModalData } from './WeekCompleteModal';

interface MesoRecapProps {
  modal: WeekCompleteModalData;
  profile: Profile;
  /** Reveals MesoCompleteSheet, which owns the choice of what comes next. */
  onContinue: () => void;
}

const bebas = "'Bebas Neue', 'Inter', system-ui, sans-serif";

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

function fmtVolume(v: number): string {
  if (v >= 100000) return `${Math.round(v / 1000)}k`;
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return String(v);
}

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      style={{
        minWidth: 0,
        padding: '10px 12px',
        borderRadius: tokens.radius.md,
        background: accent ? 'rgba(var(--accent-rgb),0.10)' : 'var(--bg-surface)',
        border: `1px solid ${accent ? 'rgba(var(--accent-rgb),0.45)' : 'var(--border)'}`,
      }}
    >
      <div style={eyebrow}>{label}</div>
      <div
        style={{
          fontFamily: bebas,
          fontSize: 28,
          lineHeight: 1.05,
          marginTop: 4,
          letterSpacing: '0.02em',
          color: accent ? 'var(--accent)' : 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function MesoRecap({ modal, profile, onContinue }: MesoRecapProps) {
  const totalWeeks = getMeso().totalWeeks;
  const deloadIdx = totalWeeks - 1;
  const weekLabel = (w: number) => (w === deloadIdx ? 'DL' : `W${w + 1}`);
  const gains = modal.anchorGains || [];
  const totalGain = gains.reduce((sum, g) => sum + Math.max(0, g.delta), 0);
  const weeklyVolume = modal.mesoWeeklyVolume || [];
  const peakVolume = Math.max(0, ...weeklyVolume.slice(0, deloadIdx));
  const firstName = profile?.name ? profile.name.split(/\s+/)[0] : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meso-recap-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'var(--bg-root)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            maxWidth: 480,
            margin: '0 auto',
            padding: 'calc(28px + env(safe-area-inset-top, 0px)) 20px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: 22,
          }}
        >
          {/* Title */}
          <div>
            <div style={{ ...eyebrow, color: 'var(--accent)', marginBottom: 6 }}>Mesocycle complete</div>
            <h1
              id="meso-recap-title"
              style={{
                margin: 0,
                fontFamily: bebas,
                fontWeight: 400,
                fontSize: 'clamp(40px, 11vw, 52px)',
                lineHeight: 0.95,
                letterSpacing: '0.03em',
                color: 'var(--text-primary)',
              }}
            >
              {totalWeeks} weeks. Done.
            </h1>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {firstName ? `Good work, ${firstName}. ` : 'Good work. '}
              Here's what the block built.
            </p>
          </div>

          {/* Headline numbers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            <StatTile
              label="Strength"
              value={gains.length > 0 ? `+${fmt(totalGain)}` : '—'}
              sub={gains.length > 0 ? `lb across ${gains.length} lift${gains.length === 1 ? '' : 's'}` : 'No anchor data'}
              accent
            />
            <StatTile label="Sessions" value={`${modal.mesoCompletedSessions}/${modal.mesoTotalSessions}`} />
            <StatTile label="PRs" value={String(modal.mesoTotalPRs)} />
          </div>

          {/* Volume across the block */}
          {weeklyVolume.some((v) => v > 0) && (
            <div
              style={{
                padding: 14,
                borderRadius: tokens.radius.md,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                <div style={eyebrow}>Volume by week</div>
                <div style={{ fontFamily: bebas, fontSize: 20, letterSpacing: '0.03em', color: 'var(--text-primary)' }}>
                  {fmtVolume(modal.mesoTotalVolume)} <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>LB TOTAL</span>
                </div>
              </div>
              <WeekBars
                ariaLabel={`Volume by week: ${weeklyVolume.map((v, w) => `${weekLabel(w)} ${fmtVolume(v)} pounds`).join(', ')}`}
                format={fmtVolume}
                bars={weeklyVolume.map((v, w) => ({
                  key: w,
                  label: weekLabel(w),
                  value: v,
                  highlight: w !== deloadIdx && v > 0 && v === peakVolume,
                  muted: w === deloadIdx,
                }))}
              />
            </div>
          )}

          {/* Anchor lifts */}
          {gains.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={eyebrow}>Strength gained</div>
              {gains.map((g) => {
                const weekly = g.weekly || [];
                const up = g.delta > 0;
                return (
                  <div
                    key={g.name}
                    style={{
                      padding: 14,
                      borderRadius: tokens.radius.md,
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: bebas, fontSize: 22, lineHeight: 1, letterSpacing: '0.03em', color: 'var(--text-primary)' }}>
                          {g.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(g.start ?? 0)} → {fmt(g.peak ?? 0)} lb{g.peakWeek ? ` · peak week ${g.peakWeek}` : ''}
                        </div>
                      </div>
                      <span
                        style={{
                          flexShrink: 0,
                          padding: '5px 10px',
                          borderRadius: 999,
                          fontSize: 13,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          color: up ? 'var(--accent)' : 'var(--text-muted)',
                          background: up ? 'rgba(var(--accent-rgb),0.12)' : 'var(--bg-card)',
                          border: `1px solid ${up ? 'var(--accent)' : 'var(--border)'}`,
                        }}
                      >
                        {up ? `+${fmt(g.delta)} lb` : g.delta === 0 ? 'Held' : `${fmt(g.delta)} lb`}
                      </span>
                    </div>
                    {weekly.filter((v) => v > 0).length >= 2 && (
                      <WeekBars
                        height={44}
                        ariaLabel={`${g.name} top weight by week: ${weekly
                          .map((v, w) => (v > 0 ? `${weekLabel(w)} ${fmt(v)}` : null))
                          .filter(Boolean)
                          .join(', ')}`}
                        format={fmt}
                        bars={weekly.map((v, w) => ({
                          key: w,
                          label: weekLabel(w),
                          value: v,
                          highlight: w !== deloadIdx && v > 0 && v === g.peak,
                          muted: w === deloadIdx,
                        }))}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Coaching note */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: tokens.radius.md,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
            }}
          >
            <div style={{ ...eyebrow, color: 'var(--phase-accum)', marginBottom: 5 }}>What happens next</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Fatigue from this block clears in 3–5 days. Your first session of the next meso should
              feel stronger than your last peak week — that's supercompensation.
            </div>
          </div>
        </div>
      </div>

      {/* Thumb-reach continue */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 20px calc(14px + env(safe-area-inset-bottom, 0px))',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-root)',
        }}
      >
        <button
          type="button"
          onClick={onContinue}
          className="btn-primary"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 440,
            margin: '0 auto',
            minHeight: 54,
            borderRadius: tokens.radius.lg,
            background: 'var(--btn-primary-bg)',
            border: '1px solid var(--btn-primary-border)',
            color: 'var(--btn-primary-text)',
            fontFamily: bebas,
            fontSize: 22,
            letterSpacing: '0.1em',
            cursor: 'pointer',
          }}
        >
          WHAT'S NEXT <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
