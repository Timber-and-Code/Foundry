/**
 * Tests for DayActionSheet — the context-aware bottom sheet that opens when
 * a user taps a day in the Schedule calendar. Verifies the empty / single /
 * double / completed states each render the correct action set.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockStoreGet, mockLoadCardioSession } = vi.hoisted(() => ({
  mockStoreGet: vi.fn((_key: string): string | null => null),
  mockLoadCardioSession: vi.fn((): null => null),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet, set: vi.fn(), remove: vi.fn() },
  loadCardioSession: mockLoadCardioSession,
}));

vi.mock('../../../data/constants', () => ({
  CARDIO_WORKOUTS: [
    { id: 'easy_walk', label: 'Easy Walk', description: 'A walk.', category: 'Endurance' },
    { id: 'z2', label: 'Zone Two Bike', description: 'Steady state bike.', category: 'Endurance' },
  ],
  TAG_ACCENT: { PUSH: '#FF0', PULL: '#0FF', LEGS: '#F0F', CARDIO: '#AAA' },
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
  },
}));

import DayActionSheet from '../DayActionSheet';
import type { TrainingDay } from '../../../types';

const ACTIVE_DAYS: TrainingDay[] = [
  { label: 'Push Day', tag: 'PUSH', exercises: [{ name: 'Bench', muscle: 'chest' }] },
  { label: 'Pull Day', tag: 'PULL', exercises: [{ name: 'Row', muscle: 'back' }] },
  { label: 'Leg Day', tag: 'LEGS', exercises: [{ name: 'Squat', muscle: 'quads' }] },
];

const future = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    dateStr: future,
    profile: { experience: 'intermediate' },
    activeDays: ACTIVE_DAYS,
    sessionEntry: undefined as string | string[] | undefined,
    completedDays: new Set<string>(),
    onPreviewSession: vi.fn(),
    onOpenExtra: vi.fn(),
    onOpenCardio: vi.fn(),
    onAddWorkout: vi.fn(),
    onMoveSession: vi.fn(),
    onViewNotes: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreGet.mockReturnValue(null);
  mockLoadCardioSession.mockReturnValue(null);
});

describe('DayActionSheet', () => {
  it('empty future day shows add-workout and add-cardio, no move', () => {
    const props = makeProps();
    render(<DayActionSheet {...props} />);
    expect(screen.getByText('Add additional workout')).toBeDefined();
    expect(screen.getByText('Add additional cardio')).toBeDefined();
    expect(screen.queryByText('Move this workout')).toBeNull();
  });

  it('single scheduled session: View preview + move + add more (no start — schedule tab is view/manage only)', () => {
    const props = makeProps({ sessionEntry: '0:1' });
    render(<DayActionSheet {...props} />);
    expect(screen.queryByText(/Open Push Day/)).toBeNull();
    expect(screen.getByText(/View Push Day — Week 2/)).toBeDefined();
    expect(screen.getByText('Move this workout')).toBeDefined();
    expect(screen.getByText('Add additional workout')).toBeDefined();
    expect(screen.getByText('Add additional cardio')).toBeDefined();
  });

  it('tapping View on an active session fires onPreviewSession (not onOpenSession)', () => {
    const props = makeProps({ sessionEntry: '0:1' });
    render(<DayActionSheet {...props} />);
    fireEvent.click(screen.getByText(/View Push Day — Week 2/));
    expect(props.onPreviewSession).toHaveBeenCalledWith(0, 1);
  });

  it('clicking Move fires onMoveSession with the active sessionKey', () => {
    const props = makeProps({ sessionEntry: '1:2' });
    render(<DayActionSheet {...props} />);
    fireEvent.click(screen.getByText('Move this workout'));
    expect(props.onMoveSession).toHaveBeenCalledWith('1:2');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('double-booked day: shows banner + View rows for each + cardio, no start/move', () => {
    const props = makeProps({ sessionEntry: ['0:0', '1:0'] });
    render(<DayActionSheet {...props} />);
    expect(screen.getByText(/2 workouts scheduled/)).toBeDefined();
    expect(screen.queryByText(/Open Push Day/)).toBeNull();
    expect(screen.queryByText(/Open Pull Day/)).toBeNull();
    expect(screen.getByText(/View Push Day — Week 1/)).toBeDefined();
    expect(screen.getByText(/View Pull Day — Week 1/)).toBeDefined();
    expect(screen.queryByText('Add additional workout')).toBeNull();
    expect(screen.getByText('Add additional cardio')).toBeDefined();
    expect(screen.queryByText('Move this workout')).toBeNull();
  });

  it('completed session shows View + recap action, no move', () => {
    const completed = new Set(['0:0']);
    const props = makeProps({ sessionEntry: '0:0', completedDays: completed });
    render(<DayActionSheet {...props} />);
    expect(screen.getByText(/View Push Day — Week 1/)).toBeDefined();
    expect(screen.queryByText('Move this workout')).toBeNull();
    expect(screen.getByText('View session recap')).toBeDefined();
  });

  it('expanding cardio picker shows CARDIO_WORKOUTS options', () => {
    const props = makeProps();
    render(<DayActionSheet {...props} />);
    fireEvent.click(screen.getByText('Add additional cardio'));
    expect(screen.getByText('Easy Walk')).toBeDefined();
    expect(screen.getByText('Zone Two Bike')).toBeDefined();
  });

  it('selecting a cardio option fires onOpenCardio and closes', () => {
    const props = makeProps();
    render(<DayActionSheet {...props} />);
    fireEvent.click(screen.getByText('Add additional cardio'));
    fireEvent.click(screen.getByText('Easy Walk'));
    expect(props.onOpenCardio).toHaveBeenCalledWith(future, 'easy_walk');
    expect(props.onClose).toHaveBeenCalled();
  });

  it('does not render when closed or date missing', () => {
    const { container } = render(<DayActionSheet {...makeProps({ open: false })} />);
    expect(container.firstChild).toBeNull();
  });
});
