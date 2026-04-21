/**
 * Tests for MoveWorkoutSheet — the ±7 day picker that moves a single
 * scheduled session without re-flowing the meso. Verifies:
 *   - Past-date cells are disabled
 *   - The source date is marked and disabled
 *   - Days with an existing session raise a conflict warning (not a block)
 *   - Confirm writes the override via onProfileUpdate
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockSetScheduleOverride } = vi.hoisted(() => ({
  mockSetScheduleOverride: vi.fn(
    (profile, source, to, key) => ({
      ...(profile as Record<string, unknown>),
      scheduleOverrides: { ...(profile as { scheduleOverrides?: Record<string, unknown> }).scheduleOverrides, [source]: { to, sessionKey: key } },
    }),
  ),
}));

vi.mock('../../../utils/store', () => ({
  setScheduleOverride: mockSetScheduleOverride,
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
  },
}));

import MoveWorkoutSheet from '../MoveWorkoutSheet';

function addDays(dateStr: string, n: number): string {
  const dt = new Date(dateStr + 'T00:00:00');
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeProps(overrides: Record<string, unknown> = {}) {
  // Anchor the source 3 days into the future so we have both past (from
  // source view) AND absolute-past cells in the -7..+7 window.
  const source = addDays(todayStr(), 3);
  return {
    open: true,
    onClose: vi.fn(),
    profile: { experience: 'intermediate', scheduleOverrides: {} },
    sourceDateStr: source,
    sessionKey: '1:0',
    sessionDateMap: {} as Record<string, string | string[]>,
    completedDays: new Set<string>(),
    onProfileUpdate: vi.fn(),
    sessionLabel: 'Pull Day — Week 1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MoveWorkoutSheet', () => {
  it('renders the source session label and date', () => {
    render(<MoveWorkoutSheet {...makeProps()} />);
    expect(screen.getByText('Pull Day — Week 1')).toBeDefined();
    expect(screen.getByText(/Currently on /)).toBeDefined();
  });

  it('disables past dates and the source cell', () => {
    const props = makeProps();
    render(<MoveWorkoutSheet {...props} />);
    // source is 3 days ahead — offset -7 to -3 are in the past or "current"
    const pastDate = addDays(todayStr(), -1);
    const pastBtn = screen.getAllByRole('button').find((b) =>
      b.getAttribute('aria-label')?.includes(new Date(pastDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
    );
    expect(pastBtn).toBeTruthy();
    expect(pastBtn).toBeDisabled();

    const sourceLabel = new Date(props.sourceDateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const sourceBtn = screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith(sourceLabel) && b.getAttribute('aria-label')?.includes('Current'));
    expect(sourceBtn).toBeDefined();
    expect(sourceBtn).toBeDisabled();
  });

  it('flags conflicts on days that already have a session', () => {
    const props = makeProps({
      sessionDateMap: { [addDays(todayStr(), 5)]: '2:0' },
    });
    render(<MoveWorkoutSheet {...props} />);
    const target = addDays(todayStr(), 5);
    const btn = screen.getAllByRole('button').find((b) =>
      b.getAttribute('aria-label')?.includes(new Date(target + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) &&
      b.getAttribute('aria-label')?.includes('conflict'),
    );
    expect(btn).toBeTruthy();
    expect(btn).not.toBeDisabled();
    // Select it — warning appears inline
    fireEvent.click(btn!);
    expect(screen.getByText(/2 workouts will be scheduled on this day/)).toBeDefined();
  });

  it('confirm writes the override and closes', () => {
    const props = makeProps();
    render(<MoveWorkoutSheet {...props} />);
    const target = addDays(props.sourceDateStr as string, 2);
    const targetLabel = new Date(target + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const btn = screen.getAllByRole('button').find((b) => b.getAttribute('aria-label')?.startsWith(targetLabel) && !b.hasAttribute('disabled'));
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    fireEvent.click(screen.getByText('Confirm Move'));
    expect(mockSetScheduleOverride).toHaveBeenCalledWith(
      props.profile,
      props.sourceDateStr,
      target,
      '1:0',
    );
    expect(props.onProfileUpdate).toHaveBeenCalled();
    expect(props.onClose).toHaveBeenCalled();
  });

  it('confirm is disabled when no target selected', () => {
    render(<MoveWorkoutSheet {...makeProps()} />);
    const confirm = screen.getByText('Confirm Move');
    expect(confirm).toBeDisabled();
  });

  it('does not render past window or show 15 picker cells when open', () => {
    const { container } = render(<MoveWorkoutSheet {...makeProps()} />);
    // Should render 14 offset cells (+ DOW headers). We pick buttons in the
    // grid by the presence of an aria-pressed attribute.
    const grid = container.querySelectorAll('button[aria-pressed]');
    expect(grid.length).toBe(15); // -7..+7 inclusive = 15 cells
  });
});
