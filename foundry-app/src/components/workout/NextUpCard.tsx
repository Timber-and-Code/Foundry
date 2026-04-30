import { tokens } from '../../styles/tokens';
import { findExercise } from '../../data/exerciseDB';
import { store, getWeekSets } from '../../utils/store';
import { getMeso } from '../../data/constants';
import type { Exercise } from '../../types';

interface NextUpCardProps {
  exercise: Exercise;
  exIdx: number;
  dayIdx: number;
  weekIdx: number;
  onReady: () => void;
}

export default function NextUpCard({
  exercise,
  exIdx,
  dayIdx,
  weekIdx,
  onReady,
}: NextUpCardProps) {
  const ovId = store.get(`foundry:exov:d${dayIdx}:ex${exIdx}`) || null;
  const dbEx = ovId ? findExercise(ovId) : null;
  const totalWeeks = getMeso().totalWeeks;
  const setCount = getWeekSets(Number(exercise.sets) || 0, weekIdx, totalWeeks);
  const name = dbEx ? dbEx.name : exercise.name;
  const muscles =
    (dbEx && Array.isArray(dbEx.muscles) && dbEx.muscles.length > 0
      ? dbEx.muscles
      : exercise.muscles) || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="next-up-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
        background: 'var(--bg-root, #0A0A0C)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bg-card)',
          border: '1px solid var(--accent)',
          borderRadius: tokens.radius.xxl,
          padding: '32px 24px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: '0.18em',
            color: 'var(--text-muted)',
          }}
        >
          UP NEXT
        </div>
        <div
          id="next-up-title"
          style={{
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 32,
            color: 'var(--text-primary)',
            lineHeight: 1.05,
            letterSpacing: '0.02em',
            textAlign: 'center',
          }}
        >
          {name.toUpperCase()}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center' }}>
          {setCount} sets · {exercise.reps} reps
          {exercise.rest ? ` · ${exercise.rest}` : ''}
        </div>
        {muscles.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              justifyContent: 'center',
            }}
          >
            {muscles.slice(0, 4).map((m: string, i: number) => (
              <span
                key={i}
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'var(--bg-deep, rgba(255,255,255,0.04))',
                  color: 'var(--text-secondary)',
                }}
              >
                {m}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onReady}
          autoFocus
          style={{
            width: '100%',
            marginTop: 8,
            padding: 16,
            background: 'transparent',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            borderRadius: tokens.radius.lg,
            fontFamily: "'Bebas Neue', 'Inter', system-ui, sans-serif",
            fontSize: 22,
            letterSpacing: '0.12em',
            cursor: 'pointer',
            boxShadow: '0 0 0 1px var(--accent)',
            textTransform: 'uppercase',
          }}
        >
          I&rsquo;m Ready <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}
