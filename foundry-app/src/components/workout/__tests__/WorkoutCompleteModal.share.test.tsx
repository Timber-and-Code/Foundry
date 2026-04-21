import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (same Supabase/sync stubs as the cool-down test) ─────────────────
vi.mock('../../../utils/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));
vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
  pullFromSupabase: vi.fn(),
  pushToSupabase: vi.fn(),
  fetchMesoMembers: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../data/constants', () => ({
  randomCongrats: vi.fn(() => ({
    headline: 'Paid in full',
    sub: 'You showed up.',
  })),
  randomQuote: vi.fn(() => ({ text: 'Forge on.', author: 'Coach' })),
  getWeekPhase: vi.fn(() => [
    'Accumulation',
    'Accumulation',
    'Accumulation',
    'Accumulation',
    'Accumulation',
    'Accumulation',
  ]),
  PHASE_COLOR: { Accumulation: '#E8E4DC' },
  FOUNDRY_COOLDOWN: { PUSH: [] },
  TAG_ACCENT: { MOBILITY: '#D4983C' },
}));

vi.mock('../social/FriendsStrip', () => ({
  default: () => <div data-testid="friends-strip" />,
}));

// shareWorkoutCard is the unit under test at the WorkoutCompleteModal layer;
// the util itself has its own contract-level paths. Here we just verify the
// button wires into it with the right meta payload.
const shareSpy = vi.fn(
  (_node: HTMLElement, _meta: { title: string; text: string; fileName: string }) =>
    Promise.resolve('downloaded' as const),
);
vi.mock('../../../utils/shareWorkout', () => ({
  shareWorkoutCard: (
    node: HTMLElement,
    meta: { title: string; text: string; fileName: string },
  ) => shareSpy(node, meta),
}));

import WorkoutCompleteModal from '../WorkoutCompleteModal';
import type { WorkoutCompleteStats } from '../WorkoutCompleteModal';

const baseStats: WorkoutCompleteStats = {
  sets: 18,
  reps: 142,
  volume: 12480,
  exercises: 5,
  duration: 3600,
  prs: [],
  anchorComparison: [],
};

function renderModal(
  overrides: Partial<React.ComponentProps<typeof WorkoutCompleteModal>> = {},
) {
  const props = {
    dayLabel: 'Push A',
    dayTag: 'PUSH',
    stats: baseStats,
    weekIdx: 1,
    onOk: vi.fn(),
    ...overrides,
  };
  return { ...render(<WorkoutCompleteModal {...props} />), props };
}

describe('WorkoutCompleteModal — SHARE button', () => {
  beforeEach(() => {
    localStorage.clear();
    shareSpy.mockClear();
  });

  it('renders a SHARE button alongside NEXT SESSION', () => {
    renderModal();
    expect(
      screen.getByRole('button', { name: /share this workout/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /next session/i }),
    ).toBeInTheDocument();
  });

  it('invokes shareWorkoutCard with the correct meta when tapped', async () => {
    renderModal();

    fireEvent.click(
      screen.getByRole('button', { name: /share this workout/i }),
    );

    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));

    const meta = shareSpy.mock.calls[0][1];
    expect(meta.title).toBe('Crushed Push A');
    expect(meta.fileName).toMatch(/^foundry-push-a-w2\.png$/);
    expect(meta.text).toContain('Crushed Push A');
    expect(meta.text).toContain('Week 2');
    expect(meta.text).toContain('18 sets');
    expect(meta.text).toContain('12,480 lbs');
  });

  it('prepends the PR line when a PR was set this session', async () => {
    renderModal({
      stats: {
        ...baseStats,
        prs: [{ name: 'Bench', newBest: 185, prevBest: 175 }],
      },
    });

    fireEvent.click(
      screen.getByRole('button', { name: /share this workout/i }),
    );
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));

    const meta = shareSpy.mock.calls[0][1];
    expect(meta.text).toMatch(/NEW PR: Bench 185 lbs/);
  });
});
