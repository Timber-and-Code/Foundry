import { useState } from 'react';
import { tokens } from '../../styles/tokens';
import { getWeekSets, store } from '../../utils/store';
import { findExercise } from '../../data/exerciseDB';
import { getMeso } from '../../data/constants';
import type { Exercise } from '../../types';

interface WorkoutOverviewAccordionProps {
  exercises: Exercise[];
  dayIdx: number;
  weekIdx: number;
}

export default function WorkoutOverviewAccordion({
  exercises,
  dayIdx,
  weekIdx,
}: WorkoutOverviewAccordionProps) {
  const [open, setOpen] = useState(false);
  const totalWeeks = getMeso().totalWeeks;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: tokens.radius.lg,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: '0.12em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span>TODAY&rsquo;S OVERVIEW · {exercises.length} EXERCISES</span>
        <span
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 200ms',
          }}
        >
          ⌄
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 12px' }}>
          {exercises.map((ex, i) => {
            const ovId = store.get(`foundry:exov:d${dayIdx}:ex${i}`) || null;
            const dbEx = ovId ? findExercise(ovId) : null;
            const setCount = getWeekSets(Number(ex.sets) || 0, weekIdx, totalWeeks);
            return (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderTop:
                    i > 0 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 800,
                    color: 'var(--text-muted)',
                    width: 16,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {i + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {dbEx ? dbEx.name : ex.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
                    {setCount} sets · {ex.reps} reps
                    {ex.rest ? ` · ${ex.rest}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
