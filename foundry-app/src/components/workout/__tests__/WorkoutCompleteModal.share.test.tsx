import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (same Supabase/sync stubs as the cool-down test) ─────────────────
vi.mock('../../../utils/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));
vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioPresetToSupabase: vi.fn(),
  deleteCardioPresetRemote: vi.fn(),
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

const { captureSpy, shareSpy } = vi.hoisted(() => ({
  captureSpy: vi.fn(() => Promise.resolve('data:image/png;base64,AAA')),
  shareSpy: vi.fn(() => Promise.resolve('shared')),
}));
vi.mock('../../../utils/shareWorkout', () => ({ captureNodeToPng: captureSpy }));
vi.mock('../../../utils/shareImage', () => ({ shareImage: shareSpy, downloadImage: vi.fn() }));

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
  breakdown: [{ name: 'Barbell Bench', anchor: true, sets: [{ weight: 185, reps: 6 }, { weight: 185, reps: 5 }] }],
};

function renderModal(overrides: Partial<React.ComponentProps<typeof WorkoutCompleteModal>> = {}) {
  const props = { dayLabel: 'Push A', dayTag: 'PUSH', stats: baseStats, weekIdx: 1, onOk: vi.fn(), ...overrides };
  return { ...render(<WorkoutCompleteModal {...props} />), props };
}

const openStudio = () => fireEvent.click(screen.getByRole('button', { name: /share this workout/i }));

describe('WorkoutCompleteModal — share', () => {
  beforeEach(() => {
    localStorage.clear();
    captureSpy.mockClear();
    shareSpy.mockClear();
  });

  it('renders a SHARE button alongside NEXT SESSION', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /share this workout/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next session/i })).toBeInTheDocument();
  });

  it('opens the share screen with a preview of the image', () => {
    renderModal();
    openStudio();
    expect(screen.getByRole('dialog', { name: /share workout/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /session image/i })).toBeInTheDocument();
  });

  it('offers only the templates the session can fill', () => {
    renderModal();
    openStudio();
    // Session only: no PR, no week-over-week comparison → no switcher at all.
    expect(screen.queryByRole('radiogroup', { name: /image style/i })).not.toBeInTheDocument();
  });

  it('leads with the PR image when there is a PR', () => {
    renderModal({
      stats: {
        ...baseStats,
        prs: [{ name: 'Bench', newBest: 225, prevBest: 215 }],
        anchorComparison: [{ name: 'Bench', today: 225, prev: 215, delta: 10 }],
      },
    });
    openStudio();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['PR', 'Session', 'Progress']);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
  });

  it('Share renders the full-size card and hands it to the system share sheet', async () => {
    renderModal();
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    expect(captureSpy).toHaveBeenCalledWith(expect.any(HTMLElement), 1);
    expect(shareSpy).toHaveBeenCalledWith({
      dataUrl: 'data:image/png;base64,AAA',
      fileName: 'foundry-push-a-w2-session.png',
      title: 'Push A — The Foundry',
    });
  });

  it('Copy caption copies a readable caption', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    renderModal({ stats: { ...baseStats, prs: [{ name: 'Bench', newBest: 185, prevBest: 175 }] } });
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: /copy caption/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    const text = (writeText.mock.calls[0] as unknown as [string])[0];
    expect(text).toContain('New PR: Bench 185 lb');
    expect(text).toContain('Push A, week 2');
    expect(text).toContain('18 sets, 12,480 lb moved');
  });
});
