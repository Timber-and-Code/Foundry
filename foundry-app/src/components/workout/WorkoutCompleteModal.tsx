import React, { useState } from 'react';
import { tokens } from '../../styles/tokens';
import {
  randomCongrats,
  randomQuote,
  getWeekPhase,
  PHASE_COLOR,
  FOUNDRY_COOLDOWN,
} from '../../data/constants';
import { store } from '../../utils/store';
import FriendsStrip from '../social/FriendsStrip';
import FriendWorkoutModal from '../social/FriendWorkoutModal';
import type { MesoMember } from '../../types';

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
  dayIdx: number;
  weekIdx: number;
  onOk: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

function WorkoutCompleteModal({
  dayLabel,
  dayTag,
  gender,
  stats,
  dayIdx,
  weekIdx,
  onOk,
}: WorkoutCompleteModalProps) {
  const [cooldownOpen, setCooldownOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<MesoMember | null>(null);
  const mesoId = store.get('foundry:active_meso_id');

  const phases = getWeekPhase();
  const phase = phases[weekIdx] || 'Accumulation';
  const phaseColor = PHASE_COLOR[phase] || '#E8E4DC';

  const [congrats] = useState(() => randomCongrats());
  const [quote] = useState(() => randomQuote(gender));

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

        {/* SESSION COMPLETE label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.16em',
            color: phaseColor,
            textTransform: 'uppercase',
          }}
        >
          SESSION COMPLETE
        </div>

        {/* Day label */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginTop: -12,
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
            <FriendsStrip mesoId={mesoId} onSelectFriend={setSelectedFriend} />
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={onOk}
          style={{
            width: '100%',
            padding: '18px',
            borderRadius: tokens.radius.lg,
            background: phaseColor,
            border: 'none',
            color: phaseColor === '#E8E4DC' || phaseColor === '#D4983C' ? '#0A0A0C' : '#E8E4DC',
            fontSize: 15,
            fontWeight: 800,
            cursor: 'pointer',
            letterSpacing: '0.04em',
            marginTop: 4,
          }}
        >
          NEXT SESSION →
        </button>
      </div>
      {mesoId && (
        <FriendWorkoutModal
          open={!!selectedFriend}
          member={selectedFriend}
          mesoId={mesoId}
          dayIdx={dayIdx}
          weekIdx={weekIdx}
          onClose={() => setSelectedFriend(null)}
        />
      )}
    </div>
  );
}

export default React.memo(WorkoutCompleteModal);
