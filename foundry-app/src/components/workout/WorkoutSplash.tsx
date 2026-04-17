import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { getMeso, getWeekPhase, PHASE_COLOR, getWeekRir } from '../../data/constants';
import { getWeekSets, store } from '../../utils/store';
import { findExercise } from '../../data/exerciseDB';
import FriendsStrip from '../social/FriendsStrip';
import FriendWorkoutModal from '../social/FriendWorkoutModal';
import type { Exercise, MesoMember } from '../../types';

interface WorkoutSplashProps {
  dayName: string;
  dayIdx: number;
  weekIdx: number;
  exercises: Exercise[];
  mesoId?: string | null;
  onStart: () => void;
  onBack: () => void;
}

export default function WorkoutSplash({
  dayName,
  dayIdx,
  weekIdx,
  exercises,
  mesoId,
  onStart,
  onBack,
}: WorkoutSplashProps) {
  const [selectedFriend, setSelectedFriend] = useState<MesoMember | null>(null);
  const phase = getWeekPhase()[weekIdx] || 'Accumulation';
  const phaseColor = PHASE_COLOR[phase] || '#E8E4DC';
  const rir = getWeekRir()[weekIdx] || '';
  const totalWeeks = getMeso().weeks;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-splash-title"
      onClick={onStart}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
        background: 'var(--bg-root, #0A0A0C)',
        display: 'flex',
        flexDirection: 'column',
        padding: 16,
        cursor: 'pointer',
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
        {/* Header row: back, phase chip */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBack();
            }}
            aria-label="Go back"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-accent)',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              padding: '4px 6px',
            }}
          >
            <span aria-hidden="true">←</span> Back
          </button>
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

        {/* Title */}
        <div>
          <div
            id="workout-splash-title"
            style={{
              fontSize: 34,
              fontWeight: 900,
              color: 'var(--text-primary)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
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

        {/* Friends strip if shared meso */}
        {mesoId && (
          <div onClick={(e) => e.stopPropagation()}>
            <FriendsStrip mesoId={mesoId} onSelectFriend={setSelectedFriend} />
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

        {/* Start CTA */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStart();
          }}
          style={{
            width: '100%',
            padding: '20px',
            borderRadius: tokens.radius.lg,
            background: phaseColor,
            border: 'none',
            color: phaseColor === '#E8E4DC' || phaseColor === '#D4983C' ? '#0A0A0C' : '#0A0A0C',
            fontSize: 16,
            fontWeight: 900,
            letterSpacing: '0.06em',
            cursor: 'pointer',
          }}
        >
          START WORKOUT <span aria-hidden="true">→</span>
        </button>
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            textAlign: 'center',
            marginTop: -10,
          }}
        >
          Or tap anywhere to begin
        </div>
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

