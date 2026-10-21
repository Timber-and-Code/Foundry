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
import { on } from '../../../utils/events';

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
    // No PR, no week-over-week comparison → Session plus the session's quote,
    // which every workout has.
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual(['Session', 'Quote']);
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
    expect(radios.map((r) => r.textContent)).toEqual(['PR', 'Session', 'Progress', 'Quote']);
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

  it('a completed share closes the studio and flips the button to SHARED', async () => {
    renderModal();
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /share workout/i })).not.toBeInTheDocument());
    const btn = screen.getByTestId('share-workout-button');
    expect(btn).toHaveTextContent('SHARED');
    expect(btn).toHaveAttribute('data-shared', '1');
    // The screen is still here — NEXT SESSION is the obvious next step.
    expect(screen.getByRole('button', { name: /next session/i })).toBeInTheDocument();
  });

  it('a cancelled share sheet keeps the studio open', async () => {
    shareSpy.mockResolvedValueOnce('cancelled' as never);
    renderModal();
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(shareSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: /^share$/i })).not.toBeDisabled());
    expect(screen.getByRole('dialog', { name: /share workout/i })).toBeInTheDocument();
    expect(screen.getByTestId('share-workout-button')).not.toHaveAttribute('data-shared');
  });

  it('snapshots the card for the session so it can be shared later', () => {
    renderModal({ dayIdx: 2 });
    const raw = localStorage.getItem('foundry:share:d2:w1');
    expect(raw).toBeTruthy();
    const snap = JSON.parse(raw as string);
    expect(snap.dayLabel).toBe('Push A');
    expect(snap.phase).toBe('Accumulation');
    expect(snap.stats.sets).toBe(18);
    // The quote the lifter read on this screen is the one that gets saved.
    expect(typeof snap.quote.text).toBe('string');
    expect(screen.getByText(snap.quote.text, { exact: false })).toBeInTheDocument();
  });

  it('does not snapshot without a meso day index (extra sessions)', () => {
    renderModal();
    expect(localStorage.getItem('foundry:share:d2:w1')).toBeNull();
    expect(Object.keys(localStorage).filter((k) => k.startsWith('foundry:share:'))).toEqual([]);
  });

  it('NEXT SESSION without sharing leaves a "logged · Share" toast that opens the share host', () => {
    const toasts: Array<{ message: string; action?: { label: string; onClick: () => void } }> = [];
    const offToast = on('foundry:toast', (d) => toasts.push(d));
    const openShare = vi.fn();
    const offOpen = on('foundry:openShare', openShare);
    const { props } = renderModal({ dayIdx: 2 });
    fireEvent.click(screen.getByRole('button', { name: /next session/i }));
    expect(props.onOk).toHaveBeenCalledTimes(1);
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Push A logged.');
    expect(toasts[0].action?.label).toBe('Share');
    toasts[0].action?.onClick();
    expect(openShare).toHaveBeenCalledWith({ dayIdx: 2, weekIdx: 1 });
    offToast();
    offOpen();
  });

  it('NEXT SESSION after a share leaves no toast', async () => {
    const toasts: unknown[] = [];
    const offToast = on('foundry:toast', (d) => toasts.push(d));
    renderModal({ dayIdx: 2 });
    openStudio();
    fireEvent.click(screen.getByRole('button', { name: /^share$/i }));
    await waitFor(() => expect(screen.getByTestId('share-workout-button')).toHaveAttribute('data-shared', '1'));
    fireEvent.click(screen.getByRole('button', { name: /next session/i }));
    expect(toasts).toHaveLength(0);
    offToast();
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
