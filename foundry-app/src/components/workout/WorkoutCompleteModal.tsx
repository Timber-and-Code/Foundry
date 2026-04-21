import React, { useRef, useState } from 'react';
import { tokens } from '../../styles/tokens';
import {
  randomCongrats,
  randomQuote,
  getWeekPhase,
  PHASE_COLOR,
  FOUNDRY_COOLDOWN,
  TAG_ACCENT,
} from '../../data/constants';
import { store } from '../../utils/store';
import FriendsStrip from '../social/FriendsStrip';
import ShareCard from './ShareCard';
import { shareWorkoutCard } from '../../utils/shareWorkout';

// Local-time YYYY-MM-DD (not UTC) — matches the dateStr format used across
// the codebase for per-day localStorage keys (mobility sessions, cardio
// sessions, readiness blobs, etc.).
function todayLocalStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkoutCompleteStats {
  sets: number;
  reps: number;
  volume: number;
  exercises: number;
  duration: number | null;
  prs: { name: string; newBest: number; prevBest: number }[];
  anchorComparison: { name: string; today: number; prev: number; delta: number }[];
}

interface WorkoutCompleteModalProps {
  dayLabel: string;
  dayTag?: string;
  gender?: string;
  stats: WorkoutCompleteStats;
  weekIdx: number;
  onOk: () => void;
  /** Tap handler for the post-workout "Cool down?" prompt. When provided,
   *  the card is rendered after the volume recap unless the user has
   *  dismissed it for today. */
  onStartCooldown?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

function WorkoutCompleteModal({
  dayLabel,
  dayTag,
  gender,
  stats,
  weekIdx,
  onOk,
  onStartCooldown,
}: WorkoutCompleteModalProps) {
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const mesoId = store.get('foundry:active_meso_id');

  // Post-workout mobility prompt — per-day dismissal so the nudge doesn't
  // re-surface if the user closes and reopens the completion modal today.
  const todayStr = todayLocalStr();
  const cooldownDismissKey = `foundry:cooldown_dismissed:${todayStr}`;
  const [cooldownDismissed, setCooldownDismissed] = useState(
    () => store.get(cooldownDismissKey) === '1',
  );
  const mobilityAccent = TAG_ACCENT.MOBILITY || tokens.colors.gold;

  const phases = getWeekPhase();
  const phase = phases[weekIdx] || 'Accumulation';
  const phaseColor = PHASE_COLOR[phase] || '#E8E4DC';

  const [congrats] = useState(() => randomCongrats());
  const [quote] = useState(() => randomQuote(gender));
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const handleShare = async () => {
    const node = shareCardRef.current;
    if (!node || sharing) return;
    setSharing(true);
    try {
      const prLine =
        stats.prs.length > 0
          ? `🏆 NEW PR: ${stats.prs[0].name} ${stats.prs[0].newBest} lbs\n`
          : '';
      const text =
        `${prLine}Crushed ${dayLabel} — Week ${weekIdx + 1} · ${phase}.\n` +
        `${stats.sets} sets · ${stats.reps} reps · ${Math.round(stats.volume).toLocaleString()} lbs total.\n\n` +
        `🔨 thefoundry.coach`;
      const safeDay = dayLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await shareWorkoutCard(node, {
        title: `Crushed ${dayLabel}`,
        text,
        fileName: `foundry-${safeDay}-w${weekIdx + 1}.png`,
      });
    } catch (e) {
      // Toast-style banner isn't wired in this modal; log for diagnostics.
      // Sentry already captured it from inside shareWorkoutCard.
      console.warn('[Foundry] Share failed', e);
    } finally {
      setSharing(false);
    }
  };

  // Cooldown moves from tag
  const tag = (dayTag || 'FULL').toUpperCase();
  const cooldownMoves =
    FOUNDRY_COOLDOWN[tag] ||
    FOUNDRY_COOLDOWN['PUSH'] || // fallback
    [];

  // Format duration
  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Build stats grid items
  const gridItems: { label: string; value: string }[] = [
    { label: 'SETS', value: String(stats.sets) },
    { label: 'REPS', value: String(stats.reps) },
  ];
  if (stats.volume > 0) {
    gridItems.push({
      label: 'VOLUME',
      value:
        stats.volume >= 1000
          ? `${(stats.volume / 1000).toFixed(1)}k`
          : String(Math.round(stats.volume)),
    });
  }
  if (stats.duration && stats.duration > 0) {
    gridItems.push({ label: 'TIME', value: formatDuration(stats.duration) });
  }

  const gridCols = gridItems.length <= 2 ? 2 : gridItems.length <= 3 ? 3 : 4;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 250,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
        }}
      >
        {/* Checkmark circle */}
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: tokens.radius.full,
            border: `3px solid ${phaseColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 4,
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 13l4 4L19 7"
              stroke={phaseColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Day · Week · Phase meta (phase-colored) */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: phaseColor,
          }}
        >
          {dayLabel} &middot; Week {weekIdx + 1} &middot; {phase}
        </div>

        {/* Congrats headline */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: 'var(--text-primary)',
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {congrats.headline}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            lineHeight: 1.5,
            marginTop: -8,
          }}
        >
          {congrats.sub}
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: 12,
            width: '100%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.xl,
            padding: '16px 12px',
          }}
        >
          {gridItems.map((item) => (
            <div key={item.label} style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 900,
                  color: 'var(--text-primary)',
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.value}
              </div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {/* Cool-down prompt — appears AFTER the volume recap so the user
            gets the emotional payoff first, then a gentle nudge toward
            parasympathetic recovery. Dismissal is per-day via localStorage. */}
        {onStartCooldown && !cooldownDismissed && (
          <div
            role="status"
            aria-label="Cool down prompt"
            data-testid="cooldown-prompt"
            style={{
              width: '100%',
              position: 'relative',
              background: `${mobilityAccent}14`,
              border: `1px solid ${mobilityAccent}55`,
              borderRadius: tokens.radius.xl,
              padding: '16px 18px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                store.set(cooldownDismissKey, '1');
                setCooldownDismissed(true);
              }}
              aria-label="Dismiss cool-down prompt"
              style={{
                position: 'absolute',
                top: 8,
                right: 10,
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                padding: '6px 8px',
                textTransform: 'uppercase',
              }}
            >
              Dismiss
            </button>
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.14em',
                color: mobilityAccent,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Cool Down
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--text-primary)',
                lineHeight: 1.25,
                marginBottom: 6,
                paddingRight: 64,
              }}
            >
              Post-Training Downshift
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 12,
              }}
            >
              8-minute parasympathetic flow. Eases you out of sympathetic drive.
            </div>
            <button
              type="button"
              onClick={onStartCooldown}
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: tokens.radius.lg,
                background: mobilityAccent,
                border: 'none',
                color: '#0A0A0C',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: '0.04em',
              }}
            >
              Start cool-down →
            </button>
          </div>
        )}

        {/* PRs section */}
        {stats.prs.length > 0 && (
          <div
            style={{
              width: '100%',
              background: 'rgba(212,152,60,0.08)',
              border: '1px solid rgba(212,152,60,0.3)',
              borderRadius: tokens.radius.xl,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: '#D4983C',
                marginBottom: 10,
              }}
            >
              PERSONAL RECORDS
            </div>
            {stats.prs.map((pr, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderTop: i > 0 ? '1px solid rgba(212,152,60,0.15)' : undefined,
                }}
              >
                <span
                  style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}
                >
                  {pr.name}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#D4983C' }}>
                  {pr.prevBest} → {pr.newBest} lbs
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Anchor comparison */}
        {stats.anchorComparison.length > 0 && (
          <div
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              padding: '14px 16px',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.12em',
                color: 'var(--text-muted)',
                marginBottom: 10,
              }}
            >
              VS LAST WEEK
            </div>
            {stats.anchorComparison.map((a, i) => {
              const sign = a.delta > 0 ? '+' : '';
              const color =
                a.delta > 0
                  ? '#4caf50'
                  : a.delta < 0
                    ? '#f44336'
                    : 'var(--text-muted)';
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 0',
                    borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  <span
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}
                  >
                    {a.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>
                    {sign}
                    {a.delta} lbs
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Cooldown moves accordion */}
        {cooldownMoves.length > 0 && (
          <div
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.xl,
              overflow: 'hidden',
            }}
          >
            <button
              onClick={() => setCooldownOpen(!cooldownOpen)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
                COOL-DOWN STRETCHES
              </span>
              <span style={{ fontSize: 14, color: 'var(--text-muted)', transform: cooldownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>
                ▼
              </span>
            </button>
            {cooldownOpen && (
              <div style={{ padding: '0 16px 14px' }}>
                {cooldownMoves.map((move, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '8px 0',
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {move.name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
                      {move.cue}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Motivational quote — closing beat before the CTA */}
        <div
          style={{
            width: '100%',
            position: 'relative',
            padding: '20px 20px 20px 28px',
            borderLeft: `3px solid ${phaseColor}`,
            marginTop: 4,
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -8,
              left: 14,
              fontSize: 56,
              lineHeight: 1,
              color: phaseColor,
              opacity: 0.35,
              fontFamily: 'Georgia, serif',
              pointerEvents: 'none',
            }}
          >
            &ldquo;
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text-primary)',
              lineHeight: 1.45,
              letterSpacing: '-0.005em',
              position: 'relative',
            }}
          >
            {quote.text}
          </div>
          <div
            style={{
              fontSize: 11,
              color: phaseColor,
              marginTop: 12,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
            }}
          >
            — {quote.author}
          </div>
        </div>

        {/* Friends strip — presence of crew members on this shared meso */}
        {mesoId && (
          <div style={{ width: '100%' }}>
            <FriendsStrip mesoId={mesoId} onSelectFriend={() => { /* #8: Friend Progress View */ }} />
          </div>
        )}

        {/* CTA row — SHARE + NEXT SESSION side by side. Share button is
            the accent color (warm orange) so it reads as a secondary action
            calling attention without competing with the phase-colored primary. */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            gap: 10,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={handleShare}
            disabled={sharing}
            aria-label="Share this workout"
            data-testid="share-workout-button"
            style={{
              flex: '0 0 auto',
              padding: '18px 20px',
              borderRadius: tokens.radius.lg,
              background: 'transparent',
              border: `1.5px solid ${tokens.colors.accent}`,
              color: tokens.colors.accent,
              fontSize: 13,
              fontWeight: 800,
              cursor: sharing ? 'default' : 'pointer',
              letterSpacing: '0.08em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: sharing ? 0.6 : 1,
            }}
          >
            {sharing ? (
              <span
                aria-hidden="true"
                data-testid="share-spinner"
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${tokens.colors.accent}`,
                  borderTopColor: 'transparent',
                  display: 'inline-block',
                  animation: 'foundry-spin 0.8s linear infinite',
                }}
              />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 3v12m0-12l-4 4m4-4l4 4M5 21h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            SHARE
          </button>
          <button
            onClick={onOk}
            style={{
              flex: 1,
              padding: '18px',
              borderRadius: tokens.radius.lg,
              background: phaseColor,
              border: 'none',
              color: phaseColor === '#E8E4DC' || phaseColor === '#D4983C' ? '#0A0A0C' : '#E8E4DC',
              fontSize: 15,
              fontWeight: 800,
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            NEXT SESSION →
          </button>
        </div>
        {/* Keyframe for the SHARE spinner. Scoped <style> is fine for a
            modal-level one-off; avoids a cross-file CSS edit. */}
        <style>{'@keyframes foundry-spin { to { transform: rotate(360deg); } }'}</style>
      </div>

      {/* Off-screen ShareCard — DOM-present so html-to-image can walk it,
          but pushed far off the visual viewport. aria-hidden + inert to
          keep it out of the a11y tree / tab order. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -99999,
          top: 0,
          width: 1080,
          height: 1350,
          pointerEvents: 'none',
        }}
      >
        <ShareCard
          ref={shareCardRef}
          dayLabel={dayLabel}
          weekIdx={weekIdx}
          phase={phase}
          phaseColor={phaseColor}
          stats={{
            sets: stats.sets,
            reps: stats.reps,
            volume: stats.volume,
            duration: stats.duration,
          }}
          prs={stats.prs.map((pr) => ({
            name: pr.name,
            weight: pr.newBest,
            // Completion stats don't track the rep count that produced the
            // PR (only newBest/prevBest). Default to 1 for display; future
            // work: thread the rep count through from session logs.
            reps: 1,
          }))}
          congratsHeadline={congrats.headline}
          congratsSub={congrats.sub}
        />
      </div>
    </div>
  );
}

export default React.memo(WorkoutCompleteModal);
