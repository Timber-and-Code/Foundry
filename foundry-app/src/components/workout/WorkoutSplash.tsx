import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { getMeso, getWeekPhase, PHASE_COLOR, getWeekRir } from '../../data/constants';
import { getWeekSets, store } from '../../utils/store';
import { findExercise } from '../../data/exerciseDB';
import FriendsStrip from '../social/FriendsStrip';
import FriendDashboardModal from '../social/FriendDashboardModal';
import type { Exercise, MesoMember, Profile } from '../../types';

interface WorkoutSplashProps {
  dayName: string;
  dayIdx: number;
  weekIdx: number;
  exercises: Exercise[];
  mesoId?: string | null;
  /** Used to size the friend-dashboard completion grid (days-per-week).
   *  Falls back to 6 if unknown — matches the default Foundry split. */
  profile?: Profile;
  onStart?: () => void;
  onBack: () => void;
  /** When true, hides the start CTA and disables tap-to-start — used by the
   * schedule tab's "View" affordance so users can peek at exercises/sets/reps
   * without accidentally starting the workout. */
  previewOnly?: boolean;
}

export default function WorkoutSplash({
  dayName,
  dayIdx,
  weekIdx,
  exercises,
  mesoId,
  profile,
  onStart,
  onBack,
  previewOnly = false,
}: WorkoutSplashProps) {
  const phase = getWeekPhase()[weekIdx] || 'Accumulation';
  const phaseColor = PHASE_COLOR[phase] || '#E8E4DC';
  const rir = getWeekRir()[weekIdx] || '';
  const totalWeeks = getMeso().totalWeeks;
  const daysPerWeek =
    profile?.workoutDays?.length || profile?.daysPerWeek || 6;
  const [dashboardMember, setDashboardMember] = useState<MesoMember | null>(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-splash-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
        background: 'var(--bg-root, #0A0A0C)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
      }}
    >
      <div
        style={{
          flex: 1,
          border: `2px solid ${phaseColor}`,
          borderRadius: tokens.radius.xxl,
          padding: '20px 22px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        {/* Header row: phase chip only — Back lives at the bottom alongside Start */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.12em',
              padding: '4px 10px',
              borderRadius: tokens.radius.pill,
              background: phaseColor + '22',
              color: phaseColor,
              border: `1px solid ${phaseColor}55`,
            }}
          >
            {phase.toUpperCase()}
          </div>
        </div>

        {/* Meta line */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.14em',
          }}
        >
          WEEK {weekIdx + 1} / {totalWeeks} &middot; DAY {/* dayIdx is 0-indexed */} {/* displays dayName below */}
        </div>

        {/* Title — Bebas display to match Focus Mode editorial header. */}
        <div>
          <div
            id="workout-splash-title"
            style={{
              fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
              fontSize: 40,
              fontWeight: 400,
              color: 'var(--text-primary)',
              lineHeight: 1.0,
              letterSpacing: '0.02em',
            }}
          >
            {dayName}
          </div>
        </div>

        {/* Target RIR chip */}
        {rir && (
          <div
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 8,
              padding: '8px 14px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: tokens.radius.pill,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'var(--text-muted)',
              }}
            >
              TARGET
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}
            >
              {rir}
            </span>
          </div>
        )}

        {/* Exercise overview — scrollable list of today's lifts */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: tokens.radius.lg,
          }}
        >
          {exercises.map((ex, i) => {
            const ovId = store.get(`foundry:exov:d${dayIdx}:ex${i}`) || null;
            const dbEx = ovId ? findExercise(ovId) : null;
            const setCount = getWeekSets(Number(ex.sets) || 0, weekIdx, totalWeeks);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  padding: '10px 14px',
                  borderBottom: i < exercises.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    width: 18,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {dbEx ? dbEx.name : ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {setCount} sets · {ex.reps} reps{ex.rest ? ` · ${ex.rest}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Friends strip (shared meso only) — anchored below the exercise
            list so the list is the first thing you read; keeps the Start
            button at the very bottom where thumbs land. Tapping a friend
            opens the FriendDashboardModal. */}
        {mesoId && (
          <div onClick={(e) => e.stopPropagation()}>
            <FriendsStrip
              mesoId={mesoId}
              onSelectFriend={(m) => setDashboardMember(m)}
            />
          </div>
        )}

        {/* Action row — Back (secondary, bordered) + Start (primary amber).
            No more tap-anywhere-to-start; the user gets a clear binary choice. */}
        {!previewOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onBack}
              aria-label="Go back without starting"
              style={{
                flex: '0 0 36%',
                padding: '14px 10px',
                borderRadius: tokens.radius.lg,
                background: 'transparent',
                border: '2px solid var(--border)',
                color: 'var(--text-primary)',
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
                padding: '16px',
                borderRadius: tokens.radius.lg,
                background: 'transparent',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 400,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                boxShadow: '0 0 0 1px var(--accent)',
              }}
            >
              Start Workout <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
        {previewOnly && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onBack}
              aria-label="Close preview"
              style={{
                flex: 1,
                padding: '14px 10px',
                borderRadius: tokens.radius.lg,
                background: 'transparent',
                border: '2px solid var(--border)',
                color: 'var(--text-primary)',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden="true">←</span> Close
            </button>
          </div>
        )}
      </div>

      {/* Friend dashboard — aggregate view opened from the FriendsStrip.
          Rendered at the root so its backdrop covers the splash. */}
      {mesoId && (
        <FriendDashboardModal
          open={dashboardMember !== null}
          onClose={() => setDashboardMember(null)}
          member={dashboardMember}
          mesoId={mesoId}
          totalWeeks={totalWeeks}
          daysPerWeek={daysPerWeek}
        />
      )}
    </div>
  );
}

