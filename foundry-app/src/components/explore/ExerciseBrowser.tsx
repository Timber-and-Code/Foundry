import { useMemo, useState } from 'react';
import { useExerciseDB, type ExerciseEntry } from '../../data/exerciseDB';
import SharedExerciseBrowser from '../shared/ExerciseBrowser';
import ExerciseDetailModal from './ExerciseDetailModal';
import type { Exercise } from '../../types';

/**
 * Canonical muscle ordering — roughly head-to-toe, mirrors the rest of the
 * app's filter menus. Anything not in this list drops to the bottom.
 */
const MUSCLE_ORDER = [
  'Chest',
  'Back',
  'Lats',
  'Shoulders',
  'Traps',
  'Biceps',
  'Triceps',
  'Forearms',
  'Core',
  'Abs',
  'Obliques',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'LowerBack',
];

interface ExerciseBrowserProps {
  onBack: () => void;
}

/**
 * ExerciseBrowser — Explore tab's exercise library.
 *
 * Renders the shared `ExerciseBrowser` primitive in `mode="browse"`. Each
 * exercise row opens a detail modal (how-to, cues, video) rather than
 * firing a swap callback.
 *
 * Used to expose a pill-heavy filter panel (MUSCLE GROUP / EQUIPMENT /
 * MOVEMENT / SPLIT TAG). The search bar + collapsible muscle rows make
 * the same filtering flow achievable without covering the screen in
 * pills, so the filter panel has been retired — this is the same browse
 * primitive the swap menu uses, just without the SWAP affordance.
 */
function ExerciseBrowser({ onBack }: ExerciseBrowserProps) {
  const EXERCISE_DB = useExerciseDB();
  const [detail, setDetail] = useState<ExerciseEntry | null>(null);

  // Group EXERCISE_DB by primary muscle, ordered head-to-toe.
  const groups = useMemo<Record<string, ExerciseEntry[]>>(() => {
    const byMuscle = new Map<string, ExerciseEntry[]>();
    for (const ex of EXERCISE_DB) {
      const key = ex.muscle || 'Other';
      const list = byMuscle.get(key) || [];
      list.push(ex);
      byMuscle.set(key, list);
    }
    const ordered = [...byMuscle.entries()].sort(([a], [b]) => {
      const ai = MUSCLE_ORDER.indexOf(a);
      const bi = MUSCLE_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
    const out: Record<string, ExerciseEntry[]> = {};
    for (const [muscle, list] of ordered) out[muscle] = list;
    return out;
  }, [EXERCISE_DB]);

  const totalCount = EXERCISE_DB.length;

  return (
    <div style={{ animation: 'tabFadeIn 0.15s ease-out', paddingBottom: 90 }}>
      {detail && (
        <ExerciseDetailModal ex={detail as unknown as Exercise} onClose={() => setDetail(null)} />
      )}

      {/* Sub-header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px 12px',
          background: 'var(--bg-deep)',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button
          onClick={onBack}
          aria-label="Go back"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--accent)',
            fontSize: 20,
            lineHeight: 1,
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44,
            justifyContent: 'center',
          }}
        >
          <span aria-hidden="true">&#8249;</span>
        </button>
        <span
          style={{
            fontFamily: "'Bebas Neue', 'Inter', sans-serif",
            fontSize: 22,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'var(--text-primary)',
          }}
        >
          EXERCISE LIBRARY
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          {totalCount} exercises
        </span>
      </div>

      <SharedExerciseBrowser
        groups={groups}
        mode="browse"
        onSelect={(id) => {
          const ex = EXERCISE_DB.find((e) => e.id === id);
          if (ex) setDetail(ex);
        }}
        searchPlaceholder="Search by name or muscle..."
      />
    </div>
  );
}

export default ExerciseBrowser;
