/**
 * Tests for DayAccordion — Beat 2 per-day exercise list editor.
 * Verifies expand/collapse, anchor toggle (2-max), remove, reorder,
 * and swap open. SwapMenu + ExerciseBrowser are mocked because their
 * own tests cover the picker; here we only care about DayAccordion's
 * state transitions and the swap surface contract.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const { showToastMock } = vi.hoisted(() => ({
  showToastMock: vi.fn(),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

// Mock SwapMenu so we don't pull in ExerciseBrowser + overlay primitives.
vi.mock('../../workout/SwapMenu', () => ({
  default: ({ open, replacingName }: { open: boolean; replacingName: string }) =>
    open ? <div data-testid="swap-sheet-mock">Swap: {replacingName}</div> : null,
}));

vi.mock('../../../data/exerciseDB', () => ({
  getExerciseDB: () => [
    { id: 'bb_flat_bench', name: 'Flat Barbell Bench Press', muscle: 'chest', tag: 'PUSH' },
    { id: 'db_row', name: 'Dumbbell Row', muscle: 'back', tag: 'PULL' },
  ],
}));

vi.mock('../../../utils/store', () => ({
  store: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('../../shared/HammerIcon', () => ({
  default: () => <span data-testid="hammer-icon" />,
}));

import DayAccordion, { type DayBuild } from '../DayAccordion';

function makeDays(): DayBuild[] {
  return [
    {
      tag: 'PUSH',
      label: 'Push A',
      exercises: [
        { id: 'bb_flat_bench', name: 'Flat Barbell Bench Press', muscle: 'chest' },
        { id: 'db_press', name: 'Incline DB Press', muscle: 'chest' },
        { id: 'tri_push', name: 'Tricep Pushdown', muscle: 'triceps' },
      ],
      anchors: [0],
    },
    {
      tag: 'PULL',
      label: 'Pull A',
      exercises: [{ id: 'bb_row', name: 'Barbell Row', muscle: 'back' }],
      anchors: [],
    },
  ];
}

describe('DayAccordion', () => {
  it('renders each day with its tag and label', () => {
    render(<DayAccordion days={makeDays()} onDaysChange={() => {}} />);
    expect(screen.getByText('PUSH')).toBeInTheDocument();
    expect(screen.getByText('Push A')).toBeInTheDocument();
    expect(screen.getByText('PULL')).toBeInTheDocument();
    expect(screen.getByText('Pull A')).toBeInTheDocument();
  });

  it('expands the first day by default and hides collapsed exercises', () => {
    render(<DayAccordion days={makeDays()} onDaysChange={() => {}} />);
    // Day 0 expanded — exercise visible
    expect(screen.getByText('Flat Barbell Bench Press')).toBeInTheDocument();
    // Day 1 collapsed — Pull's only exercise is not rendered
    expect(screen.queryByText('Barbell Row')).toBeNull();
  });

  it('toggles expansion when day header is tapped', () => {
    render(<DayAccordion days={makeDays()} onDaysChange={() => {}} />);
    // Collapse day 0
    fireEvent.click(screen.getByLabelText(/push a — collapse/i));
    expect(screen.queryByText('Flat Barbell Bench Press')).toBeNull();
    // Expand day 1
    fireEvent.click(screen.getByLabelText(/pull a — expand/i));
    expect(screen.getByText('Barbell Row')).toBeInTheDocument();
  });

  it('toggling an anchor off emits days with the anchor removed', () => {
    const onDaysChange = vi.fn();
    render(<DayAccordion days={makeDays()} onDaysChange={onDaysChange} />);
    // Exercise 0 on day 0 is currently anchored — tap to remove.
    fireEvent.click(
      screen.getByLabelText(/remove anchor from flat barbell bench press/i),
    );
    expect(onDaysChange).toHaveBeenCalledTimes(1);
    const next = onDaysChange.mock.calls[0][0] as DayBuild[];
    expect(next[0].anchors).toEqual([]);
  });

  it('rejects a third anchor with a toast', () => {
    const days = makeDays();
    days[0].anchors = [0, 1]; // already at the 2-max
    const onDaysChange = vi.fn();
    render(<DayAccordion days={days} onDaysChange={onDaysChange} />);
    // Try to anchor exercise 2 (Tricep Pushdown) — should be blocked.
    fireEvent.click(screen.getByLabelText(/mark tricep pushdown as anchor/i));
    expect(onDaysChange).not.toHaveBeenCalled();
    expect(showToastMock).toHaveBeenCalledWith(
      expect.stringMatching(/max 2 anchor lifts per day/i),
      'error',
    );
  });

  it('removes an exercise and rebases anchor indices', () => {
    const days = makeDays();
    days[0].anchors = [0, 2]; // anchored on index 0 and 2
    const onDaysChange = vi.fn();
    render(<DayAccordion days={days} onDaysChange={onDaysChange} />);
    // Remove exercise at index 1 (Incline DB Press) — unanchored.
    fireEvent.click(screen.getByLabelText(/remove incline db press/i));
    const next = onDaysChange.mock.calls[0][0] as DayBuild[];
    expect(next[0].exercises.map((e) => e.id)).toEqual(['bb_flat_bench', 'tri_push']);
    // Anchor that pointed at index 2 now points at index 1; anchor at 0 unchanged.
    expect(next[0].anchors.sort()).toEqual([0, 1]);
  });

  it('moves an exercise down and keeps its anchor flag with it', () => {
    const days = makeDays();
    days[0].anchors = [0]; // anchor is on index 0
    const onDaysChange = vi.fn();
    render(<DayAccordion days={days} onDaysChange={onDaysChange} />);
    // Move exercise 0 down → swaps with index 1.
    fireEvent.click(screen.getByLabelText(/move flat barbell bench press down/i));
    const next = onDaysChange.mock.calls[0][0] as DayBuild[];
    expect(next[0].exercises[0].id).toBe('db_press');
    expect(next[0].exercises[1].id).toBe('bb_flat_bench');
    // Anchor follows the exercise to its new index.
    expect(next[0].anchors).toEqual([1]);
  });

  it('tapping swap opens the SwapMenu with the exercise name', () => {
    render(<DayAccordion days={makeDays()} onDaysChange={() => {}} />);
    fireEvent.click(screen.getByLabelText(/swap flat barbell bench press/i));
    expect(screen.getByTestId('swap-sheet-mock')).toHaveTextContent(
      'Swap: Flat Barbell Bench Press',
    );
  });
});
