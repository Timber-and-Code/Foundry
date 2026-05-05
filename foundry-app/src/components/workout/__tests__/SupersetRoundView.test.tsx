/**
 * SupersetRoundView — round-grouped layout for the superset block. Tests
 * cover round count derivation, set-confirm wiring (correct exIdx + setIdx),
 * swap dispatch, and add-round semantics.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  store: {
    get: vi.fn((key: string): string | null => localStorage.getItem(key)),
    set: vi.fn((key: string, val: string): void => {
      localStorage.setItem(key, val);
    }),
  },
  loadDayWeek: vi.fn(),
  haptic: vi.fn(),
  getMeso: vi.fn(() => ({ totalWeeks: 7, workWeeks: 6 })),
}));

vi.mock('../../../utils/store', () => ({
  store: mocks.store,
  loadDayWeek: mocks.loadDayWeek,
}));

vi.mock('../../../utils/helpers', () => ({
  haptic: mocks.haptic,
}));

vi.mock('../../../data/constants', () => ({
  PHASE_COLOR: {},
  TAG_ACCENT: {},
  getMeso: mocks.getMeso,
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: { radius: { sm: 4, md: 6, lg: 8, xxl: 16 } },
}));

// Stub MesoHistoryView so the modal subtree doesn't need its own mocks.
vi.mock('../MesoHistoryView', () => ({
  default: (props: { exercise: { name: string }; onClose: () => void }) => (
    <div data-testid="meso-history">
      {props.exercise.name}
      <button onClick={props.onClose}>close-history</button>
    </div>
  ),
}));

import SupersetRoundView from '../SupersetRoundView';

function makeEx(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Bench Press',
    muscle: 'chest',
    sets: 3,
    reps: '8-12',
    rest: '2 min',
    ...overrides,
  };
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    exercises: [
      makeEx({ name: 'Bench Press', sets: 3 }),
      makeEx({ name: 'Bent Row', sets: 3 }),
    ],
    exIdxs: [0, 1],
    weekData: {},
    dayIdx: 0,
    weekIdx: 0,
    readOnly: false,
    onUpdateSet: vi.fn(),
    onWeightAutoFill: vi.fn(),
    onLastSetFilled: vi.fn(),
    onSetLogged: vi.fn(),
    onAddSet: vi.fn(),
    onRemoveSet: vi.fn(),
    onSwapClick: vi.fn(),
    ...overrides,
  };
}

describe('SupersetRoundView', () => {
  it('renders one round block per max-set-count across the group', () => {
    render(<SupersetRoundView {...defaultProps()} />);
    expect(screen.getByTestId('round-0')).toBeInTheDocument();
    expect(screen.getByTestId('round-1')).toBeInTheDocument();
    expect(screen.getByTestId('round-2')).toBeInTheDocument();
    expect(screen.queryByTestId('round-3')).toBeNull();
  });

  it('uses max(sets) for round count when exercises have asymmetric set counts', () => {
    const props = defaultProps({
      exercises: [
        makeEx({ name: 'Bench', sets: 4 }),
        makeEx({ name: 'Row', sets: 2 }),
      ],
    });
    render(<SupersetRoundView {...props} />);
    expect(screen.getByTestId('round-0')).toBeInTheDocument();
    expect(screen.getByTestId('round-3')).toBeInTheDocument();
    // Row only has 2 sets — round 3 should render its rest placeholder.
    const round3 = screen.getByTestId('round-3');
    expect(round3.textContent).toMatch(/B · ROW.*rest/i);
  });

  it('renders header strip with both exercise names', () => {
    render(<SupersetRoundView {...defaultProps()} />);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('Bent Row')).toBeInTheDocument();
  });

  it('fires onSwapClick with the correct exIdx when a header swap chip is tapped', () => {
    const onSwapClick = vi.fn();
    render(<SupersetRoundView {...defaultProps({ onSwapClick })} />);
    fireEvent.click(screen.getByLabelText('Swap Bent Row'));
    expect(onSwapClick).toHaveBeenCalledWith(1);
  });

  it('confirms a set via the round SetRow checkmark with correct (exIdx, setIdx)', () => {
    const onUpdateSet = vi.fn();
    const onSetLogged = vi.fn();
    const props = defaultProps({
      onUpdateSet,
      onSetLogged,
      // Pre-fill round 0 of exIdx 1 (Row) with reps so checkmark goes
      // through to confirmation rather than the empty-reps prompt.
      weekData: { 1: { 0: { weight: '135', reps: '10' } } },
    });
    render(<SupersetRoundView {...props} />);
    // Each round renders 2 SetRows (one per exercise). The Row's checkmark
    // for round 0 lives inside round-0's second child.
    const round0 = screen.getByTestId('round-0');
    const checks = round0.querySelectorAll('button[aria-pressed="false"]');
    // First check = Bench (exIdx 0), second check = Row (exIdx 1)
    fireEvent.click(checks[1] as HTMLElement);
    expect(onUpdateSet).toHaveBeenCalledWith(1, 0, 'confirmed', true);
    expect(onSetLogged).toHaveBeenCalled();
  });

  it('Add Round button calls onAddSet for every exIdx in the group', () => {
    const onAddSet = vi.fn();
    render(<SupersetRoundView {...defaultProps({ onAddSet })} />);
    fireEvent.click(screen.getByText(/Add Round/i));
    expect(onAddSet).toHaveBeenCalledTimes(2);
    expect(onAddSet).toHaveBeenCalledWith(0);
    expect(onAddSet).toHaveBeenCalledWith(1);
  });

  it('hides Add Round in readOnly mode', () => {
    render(<SupersetRoundView {...defaultProps({ readOnly: true })} />);
    expect(screen.queryByText(/Add Round/i)).toBeNull();
  });

  it('opens the history modal when a header chip is tapped', () => {
    render(<SupersetRoundView {...defaultProps()} />);
    expect(screen.queryByTestId('meso-history')).toBeNull();
    fireEvent.click(screen.getByLabelText(/Bench Press — view history/));
    expect(screen.getByTestId('meso-history')).toBeInTheDocument();
    expect(screen.getByTestId('meso-history').textContent).toMatch(/Bench Press/);
  });

  it('round count adapts when add-set is invoked (re-renders with new exercises prop)', () => {
    const { rerender } = render(<SupersetRoundView {...defaultProps()} />);
    expect(screen.getByTestId('round-2')).toBeInTheDocument();
    expect(screen.queryByTestId('round-3')).toBeNull();
    rerender(
      <SupersetRoundView
        {...defaultProps({
          exercises: [makeEx({ name: 'Bench Press', sets: 4 }), makeEx({ name: 'Bent Row', sets: 4 })],
        })}
      />,
    );
    expect(screen.getByTestId('round-3')).toBeInTheDocument();
  });
});
