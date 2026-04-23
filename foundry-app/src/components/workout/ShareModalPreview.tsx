import { useState } from 'react';
import WorkoutCompleteModal, {
  type WorkoutCompleteStats,
} from './WorkoutCompleteModal';

/**
 * Dev-only preview page that mounts the post-workout completion modal with
 * a rich seeded payload — PRs, anchor deltas, a multi-exercise breakdown —
 * so the SHARE flow (new branded ShareSheet + redesigned ShareCard) can be
 * reviewed without running a real session. Mounted at /preview/share.
 */

const SEED_STATS: WorkoutCompleteStats = {
  sets: 22,
  reps: 168,
  volume: 18420,
  exercises: 6,
  duration: 3720,
  prs: [
    { name: 'Barbell Bench', newBest: 225, prevBest: 215 },
    { name: 'DB Row', newBest: 80, prevBest: 75 },
  ],
  anchorComparison: [
    { name: 'Barbell Bench', today: 225, prev: 215, delta: 10 },
    { name: 'OHP', today: 135, prev: 130, delta: 5 },
  ],
  breakdown: [
    {
      name: 'Barbell Bench',
      anchor: true,
      sets: [
        { reps: 5, weight: 135, warmup: true },
        { reps: 3, weight: 185, warmup: true },
        { reps: 6, weight: 225 },
        { reps: 5, weight: 225 },
        { reps: 5, weight: 225 },
        { reps: 4, weight: 225 },
      ],
    },
    {
      name: 'Incline DB Press',
      sets: [
        { reps: 10, weight: 65 },
        { reps: 9, weight: 65 },
        { reps: 8, weight: 65 },
      ],
    },
    {
      name: 'OHP',
      sets: [
        { reps: 6, weight: 135 },
        { reps: 6, weight: 135 },
        { reps: 5, weight: 135 },
      ],
    },
    {
      name: 'Lateral Raise',
      sets: [
        { reps: 14, weight: 20 },
        { reps: 12, weight: 20 },
        { reps: 12, weight: 20 },
      ],
    },
    {
      name: 'Triceps Pushdown',
      sets: [
        { reps: 12, weight: 55 },
        { reps: 12, weight: 55 },
        { reps: 10, weight: 55 },
      ],
    },
    {
      name: 'Cable Fly',
      sets: [
        { reps: 15, weight: 30 },
        { reps: 14, weight: 30 },
        { reps: 12, weight: 30 },
      ],
    },
  ],
};

export default function ShareModalPreview() {
  const [open, setOpen] = useState(true);

  if (!open) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-root)',
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 16,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          Modal dismissed — tap below to re-open.
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            padding: '14px 22px',
            borderRadius: 12,
            background: '#D4983C',
            color: '#0A0A0C',
            border: 'none',
            fontWeight: 800,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          RE-OPEN COMPLETE MODAL
        </button>
      </div>
    );
  }

  return (
    <WorkoutCompleteModal
      dayLabel="Push A"
      dayTag="PUSH"
      stats={SEED_STATS}
      weekIdx={2}
      onOk={() => setOpen(false)}
      onStartCooldown={() => {
        /* preview only — no nav */
      }}
    />
  );
}
