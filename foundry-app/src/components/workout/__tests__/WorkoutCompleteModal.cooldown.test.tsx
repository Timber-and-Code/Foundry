import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────
// Supabase client construction at module scope requires env vars that
// aren't set in vitest — stub it out before the store barrel pulls it in
// via utils/sync.
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

// Mock data/constants so the modal's dependencies don't pull in large
// fixtures. We only need the few exports the component reads. The import
// path matches the one used inside WorkoutCompleteModal.tsx.
vi.mock('../../data/constants', () => ({
  randomCongrats: vi.fn(() => ({
    headline: 'Nice work',
    sub: 'Closing out the session.',
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

// FriendsStrip transitively pulls in utils/sync → @supabase/supabase-js,
// which fails to initialise without a VITE_SUPABASE_URL. Stub it out.
vi.mock('../social/FriendsStrip', () => ({
  default: () => <div data-testid="friends-strip" />,
}));

import WorkoutCompleteModal from '../WorkoutCompleteModal';
import type { WorkoutCompleteStats } from '../WorkoutCompleteModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const baseStats: WorkoutCompleteStats = {
  sets: 18,
  reps: 142,
  volume: 12480,
  exercises: 5,
  duration: 3600,
  prs: [],
  anchorComparison: [],
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function renderModal(overrides: Partial<React.ComponentProps<typeof WorkoutCompleteModal>> = {}) {
  const props = {
    dayLabel: 'Push A',
    dayTag: 'PUSH',
    stats: baseStats,
    weekIdx: 0,
    onOk: vi.fn(),
    onStartCooldown: vi.fn(),
    ...overrides,
  };
  return { ...render(<WorkoutCompleteModal {...props} />), props };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WorkoutCompleteModal — cool-down prompt', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the cool-down card after the volume recap when not dismissed', () => {
    const { container } = renderModal();

    const card = screen.getByTestId('cooldown-prompt');
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute('role', 'status');
    expect(screen.getByText('Post-Training Downshift')).toBeInTheDocument();
    expect(
      screen.getByText(/parasympathetic flow/i),
    ).toBeInTheDocument();

    // Spatial/DOM order check — the volume recap stats grid ("VOLUME" label
    // lives inside it) must appear BEFORE the cool-down card in document
    // order. Otherwise the user gets nudged toward recovery before they've
    // even seen what they just accomplished.
    const recapLabel = screen.getByText('VOLUME');
    const recapGrid = recapLabel.closest('div[style*="grid-template-columns"]');
    expect(recapGrid).toBeTruthy();

    const nodes = Array.from(container.querySelectorAll('*'));
    const recapIdx = nodes.indexOf(recapGrid as Element);
    const cardIdx = nodes.indexOf(card);
    expect(recapIdx).toBeGreaterThan(-1);
    expect(cardIdx).toBeGreaterThan(recapIdx);
  });

  it('hides the card and writes the per-day dismissal flag when "Dismiss" is tapped', () => {
    renderModal();

    expect(screen.getByTestId('cooldown-prompt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /dismiss cool-down prompt/i }));

    expect(screen.queryByTestId('cooldown-prompt')).not.toBeInTheDocument();
    expect(localStorage.getItem(`foundry:cooldown_dismissed:${todayStr()}`)).toBe('1');
  });

  it('does not render the card when the per-day dismissal flag is already set', () => {
    localStorage.setItem(`foundry:cooldown_dismissed:${todayStr()}`, '1');
    renderModal();
    expect(screen.queryByTestId('cooldown-prompt')).not.toBeInTheDocument();
  });

  it('fires onStartCooldown when the primary CTA is tapped', () => {
    const { props } = renderModal();

    fireEvent.click(screen.getByRole('button', { name: /start cool-down/i }));

    expect(props.onStartCooldown).toHaveBeenCalledTimes(1);
    // Dismiss flag should NOT be written — starting the session is a
    // positive action, not a dismissal.
    expect(localStorage.getItem(`foundry:cooldown_dismissed:${todayStr()}`)).toBeNull();
  });

  it('omits the card entirely when no onStartCooldown prop is provided', () => {
    renderModal({ onStartCooldown: undefined });
    expect(screen.queryByTestId('cooldown-prompt')).not.toBeInTheDocument();
  });
});
