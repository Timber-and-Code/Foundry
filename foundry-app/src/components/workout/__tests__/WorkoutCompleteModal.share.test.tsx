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

// captureShareCardPayload is the seam the ShareSheet tiles call; we spy on
// it to verify the modal wires in the right meta (title / fileName / text)
// regardless of which destination tile the user ends up picking.
const captureSpy = vi.fn(
  (
    _node: HTMLElement,
    meta: { title: string; text: string; fileName: string },
  ) =>
    Promise.resolve({
      file: new File([new Uint8Array([0])], meta.fileName, { type: 'image/png' }),
      dataUrl: 'data:image/png;base64,AAA',
      ...meta,
    }),
);
vi.mock('../../../utils/shareWorkout', () => ({
  captureShareCardPayload: (
    node: HTMLElement,
    meta: { title: string; text: string; fileName: string },
  ) => captureSpy(node, meta),
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
    captureSpy.mockClear();
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

  it('opens the branded share sheet when tapped', async () => {
    renderModal();

    fireEvent.click(
      screen.getByRole('button', { name: /share this workout/i }),
    );

    // Sheet presence — the 11-tile grid renders data-testid'd buttons.
    await waitFor(() =>
      expect(screen.getByTestId('share-tile-save')).toBeInTheDocument(),
    );
  });

  it('captures with the correct meta when a tile is picked', async () => {
    renderModal();

    fireEvent.click(
      screen.getByRole('button', { name: /share this workout/i }),
    );
    // "Save PNG" is the simplest tile — no window.open / native share to
    // stub, just exercises the capture path.
    fireEvent.click(await screen.findByTestId('share-tile-save'));

    await waitFor(() => expect(captureSpy).toHaveBeenCalledTimes(1));

    const meta = captureSpy.mock.calls[0][1];
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
    fireEvent.click(await screen.findByTestId('share-tile-save'));
    await waitFor(() => expect(captureSpy).toHaveBeenCalledTimes(1));

    const meta = captureSpy.mock.calls[0][1];
    expect(meta.text).toMatch(/NEW PR: Bench 185 lbs/);
  });
});
