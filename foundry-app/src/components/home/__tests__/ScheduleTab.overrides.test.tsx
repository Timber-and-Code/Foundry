/**
 * Tests for the ScheduleTab integration with profile.scheduleOverrides:
 *   - ×2 badge renders on double-booked days
 *   - Tapping a calendar cell opens the DayActionSheet (via activeDate state)
 *
 * The pure `buildSessionDateMap` semantics (source removal, target stack)
 * are covered separately in utils/__tests__/buildSessionDateMap.test.ts to
 * avoid pulling the Supabase bootstrap into this component test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const {
  mockStoreGet,
  mockLoadCardioSession,
  mockLoadNotes,
  mockLoadExNotes,
  mockLoadExtraExNotes,
  mockHasAnyNotes,
  mockHasAnyExtraNotes,
  mockBuildSessionDateMap,
} = vi.hoisted(() => ({
  mockStoreGet: vi.fn((_k: string): string | null => null),
  mockLoadCardioSession: vi.fn((): null => null),
  mockLoadNotes: vi.fn((): string => ''),
  mockLoadExNotes: vi.fn((): Record<string, string> => ({})),
  mockLoadExtraExNotes: vi.fn((): Record<string, string> => ({})),
  mockHasAnyNotes: vi.fn((): boolean => false),
  mockHasAnyExtraNotes: vi.fn((): boolean => false),
  mockBuildSessionDateMap: vi.fn(
    (): Record<string, string | string[]> => ({}),
  ),
}));

vi.mock('../../../utils/store', () => ({
  store: { get: mockStoreGet, set: vi.fn(), remove: vi.fn() },
  loadCardioSession: mockLoadCardioSession,
  loadNotes: mockLoadNotes,
  loadExNotes: mockLoadExNotes,
  loadExtraExNotes: mockLoadExtraExNotes,
  hasAnyNotes: mockHasAnyNotes,
  hasAnyExtraNotes: mockHasAnyExtraNotes,
  buildSessionDateMap: mockBuildSessionDateMap,
  isSkipped: vi.fn((): boolean => false),
  setSkipped: vi.fn(),
  setScheduleOverride: vi.fn((p, s, t, k) => ({
    ...(p as Record<string, unknown>),
    scheduleOverrides: { [s]: { to: t, sessionKey: k } },
  })),
}));

vi.mock('../../../utils/sync', () => ({
  syncSkippedToSupabase: vi.fn((): Promise<void> => Promise.resolve()),
}));

vi.mock('../../../data/constants', () => ({
  TAG_ACCENT: { PUSH: '#FF0', PULL: '#0FF', LEGS: '#F0F', CARDIO: '#AAA' },
  PHASE_COLOR: {
    Establish: '#fff',
    Accumulation: '#f00',
    Intensification: '#0f0',
    Peak: '#00f',
    Deload: '#888',
  },
  getMeso: () => ({ weeks: 6, days: 3 }),
  getWeekPhase: () => ['Establish', 'Accumulation', 'Intensification', 'Peak', 'Deload', 'Deload'],
  CARDIO_WORKOUTS: [],
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { gold: '#FFD700', overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
    // ToastContainer (rendered by the real ToastProvider wrapper) reads these.
    spacing: { xs: 4, sm: 8, md: 12, lg: 16 },
    zIndex: { toast: 500 },
    fontSize: { sm: 13, base: 14 },
    fontWeight: { semibold: 600, bold: 700 },
  },
}));

vi.mock('../RestDaySheet', () => ({ default: () => null }));
vi.mock('../EditScheduleSheet', () => ({ default: () => null }));
vi.mock('../MoveWorkoutSheet', () => ({ default: () => null }));

import ScheduleTab from '../ScheduleTab';
import { ToastProvider } from '../../../contexts/ToastContext';

const ACTIVE_DAYS = [
  { label: 'Push Day', tag: 'PUSH', exercises: [] },
  { label: 'Pull Day', tag: 'PULL', exercises: [] },
  { label: 'Leg Day', tag: 'LEGS', exercises: [] },
];

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    profile: {
      experience: 'intermediate',
      startDate: '2030-01-01',
      workoutDays: [1, 3, 5],
      mesoLength: 6,
      daysPerWeek: 3,
    },
    activeDays: ACTIVE_DAYS,
    completedDays: new Set<string>(),
    activeWeek: 0,
    currentWeek: 0,
    calendarOffset: 0,
    setCalendarOffset: vi.fn(),
    showRestDay: null,
    setShowRestDay: vi.fn(),
    showEditSchedule: false,
    setShowEditSchedule: vi.fn(),
    noteViewer: null,
    setNoteViewer: vi.fn(),
    skipVersion: 0,
    setSkipVersion: vi.fn(),
    goTo: vi.fn(),
    onSelectDayWeek: vi.fn(),
    onOpenExtra: vi.fn(),
    onOpenCardio: vi.fn(),
    setCurrentWeek: vi.fn(),
    onProfileUpdate: vi.fn(),
    setAddWorkoutModal: vi.fn(),
    setAddWorkoutStep: vi.fn(),
    setAddWorkoutType: vi.fn(),
    setAddWorkoutDayType: vi.fn(),
    ...overrides,
  };
}

function todayParts() {
  const t = new Date();
  return {
    year: t.getFullYear(),
    month: String(t.getMonth() + 1).padStart(2, '0'),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStoreGet.mockReturnValue(null);
  mockLoadCardioSession.mockReturnValue(null);
  mockBuildSessionDateMap.mockReturnValue({});
});

describe('ScheduleTab + scheduleOverrides', () => {
  it('renders ×2 badge on double-booked days from sessionDateMap', () => {
    const { year, month } = todayParts();
    const targetDate = `${year}-${month}-15`;
    mockBuildSessionDateMap.mockReturnValue({ [targetDate]: ['0:0', '1:0'] });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    expect(screen.getByTestId(`double-badge-${targetDate}`)).toBeDefined();
  });

  it('single-session days do NOT render a ×2 badge', () => {
    const { year, month } = todayParts();
    const targetDate = `${year}-${month}-10`;
    mockBuildSessionDateMap.mockReturnValue({ [targetDate]: '0:0' });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    expect(screen.queryByTestId(`double-badge-${targetDate}`)).toBeNull();
  });

  it('tapping a calendar cell opens the DayActionSheet with contextual header', () => {
    const { year, month } = todayParts();
    const dateStr = `${year}-${month}-15`;
    mockBuildSessionDateMap.mockReturnValue({ [dateStr]: '0:0' });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    const cell = screen.getByRole('button', { name: new RegExp(dateStr) });
    fireEvent.click(cell);
    expect(
      screen.queryByText(/SCHEDULED WORKOUT|REST DAY|2 WORKOUTS|EXTRA WORKOUT/),
    ).not.toBeNull();
  });

  it('tapping a cell with 2 sessions opens the 2-workout action sheet header', () => {
    const { year, month } = todayParts();
    const dateStr = `${year}-${month}-12`;
    mockBuildSessionDateMap.mockReturnValue({ [dateStr]: ['0:0', '1:0'] });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    const cell = screen.getByRole('button', { name: new RegExp(dateStr) });
    fireEvent.click(cell);
    expect(screen.getByText('2 WORKOUTS SCHEDULED')).toBeDefined();
  });
});

describe('ScheduleTab move mode', () => {
  function dateInThisMonth(day: number): string {
    const { year, month } = todayParts();
    return `${year}-${month}-${String(day).padStart(2, '0')}`;
  }
  // A guaranteed-future day in the current month, or null near month end.
  function futureDayThisMonth(): string | null {
    const t = new Date();
    const daysInMonth = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    return t.getDate() + 1 <= daysInMonth ? dateInThisMonth(t.getDate() + 1) : null;
  }

  it('picks up a single-session day and shows the moving banner', () => {
    const src = dateInThisMonth(10);
    mockBuildSessionDateMap.mockReturnValue({ [src]: '0:0' });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Move a workout' }));
    expect(screen.getByText('MOVE A WORKOUT')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(src) }));
    expect(screen.getByText(/MOVING: PUSH DAY · WK 1/)).toBeDefined();
  });

  it('places the session on a future day via setScheduleOverride → onProfileUpdate', () => {
    const target = futureDayThisMonth();
    if (!target) return; // month-end edge — nothing future left this month
    const src = dateInThisMonth(10);
    mockBuildSessionDateMap.mockReturnValue({ [src]: '0:0' });
    const props = makeProps();
    render(<ToastProvider><ScheduleTab {...props} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Move a workout' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(src) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(target) }));
    expect(props.onProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ scheduleOverrides: expect.anything() }),
    );
    // Mode exits after the move — banner gone.
    expect(screen.queryByText(/MOVING:/)).toBeNull();
  });

  it('asks WHICH workout on a double-booked source day', () => {
    const src = dateInThisMonth(10);
    mockBuildSessionDateMap.mockReturnValue({ [src]: ['0:0', '1:0'] });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Move a workout' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(src) }));
    expect(screen.getByText('WHICH WORKOUT?')).toBeDefined();
    fireEvent.click(screen.getByText('Pull Day · Wk 1'));
    expect(screen.getByText(/MOVING: PULL DAY · WK 1/)).toBeDefined();
  });

  it('blocks placing into the past', () => {
    const t = new Date();
    if (t.getDate() < 3) return; // needs a past day this month
    const src = dateInThisMonth(t.getDate() - 1);
    const pastTarget = dateInThisMonth(t.getDate() - 2);
    mockBuildSessionDateMap.mockReturnValue({ [src]: '0:0' });
    const props = makeProps();
    render(<ToastProvider><ScheduleTab {...props} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Move a workout' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(src) }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(pastTarget) }));
    expect(props.onProfileUpdate).not.toHaveBeenCalled();
    // Still in place phase — banner persists.
    expect(screen.getByText(/MOVING: PUSH DAY · WK 1/)).toBeDefined();
  });

  it('past-day sources are movable (reschedule missed)', () => {
    const t = new Date();
    if (t.getDate() < 2) return;
    const src = dateInThisMonth(t.getDate() - 1); // yesterday — missed
    mockBuildSessionDateMap.mockReturnValue({ [src]: '2:1' });
    render(<ToastProvider><ScheduleTab {...makeProps()} /></ToastProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Move a workout' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(src) }));
    expect(screen.getByText(/MOVING: LEG DAY · WK 2/)).toBeDefined();
  });
});
