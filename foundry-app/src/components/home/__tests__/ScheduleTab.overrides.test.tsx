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
  setScheduleOverride: vi.fn((p, s, t, k) => ({
    ...(p as Record<string, unknown>),
    scheduleOverrides: { [s]: { to: t, sessionKey: k } },
  })),
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
  },
}));

vi.mock('../RestDaySheet', () => ({ default: () => null }));
vi.mock('../EditScheduleSheet', () => ({ default: () => null }));
vi.mock('../MoveWorkoutSheet', () => ({ default: () => null }));

import ScheduleTab from '../ScheduleTab';

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
    render(<ScheduleTab {...makeProps()} />);
    expect(screen.getByTestId(`double-badge-${targetDate}`)).toBeDefined();
  });

  it('single-session days do NOT render a ×2 badge', () => {
    const { year, month } = todayParts();
    const targetDate = `${year}-${month}-10`;
    mockBuildSessionDateMap.mockReturnValue({ [targetDate]: '0:0' });
    render(<ScheduleTab {...makeProps()} />);
    expect(screen.queryByTestId(`double-badge-${targetDate}`)).toBeNull();
  });

  it('tapping a calendar cell opens the DayActionSheet with contextual header', () => {
    const { year, month } = todayParts();
    const dateStr = `${year}-${month}-15`;
    mockBuildSessionDateMap.mockReturnValue({ [dateStr]: '0:0' });
    render(<ScheduleTab {...makeProps()} />);
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
    render(<ScheduleTab {...makeProps()} />);
    const cell = screen.getByRole('button', { name: new RegExp(dateStr) });
    fireEvent.click(cell);
    expect(screen.getByText('2 WORKOUTS SCHEDULED')).toBeDefined();
  });
});
