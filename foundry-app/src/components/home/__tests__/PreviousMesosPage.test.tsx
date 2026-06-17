/**
 * PreviousMesosPage — empty state + render-from-archive smoke test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const { mockLoadArchive } = vi.hoisted(() => ({
  mockLoadArchive: vi.fn((): unknown[] => []),
}));

vi.mock('../../../utils/store', () => ({
  loadArchive: mockLoadArchive,
}));

vi.mock('../../../data/exerciseDB', () => ({
  useExerciseDB: () => [
    { id: 'bench_bb', name: 'Bench Press', muscle: 'Chest' },
  ],
}));

import PreviousMesosPage from '../PreviousMesosPage';

describe('PreviousMesosPage', () => {
  beforeEach(() => {
    mockLoadArchive.mockReset();
  });

  it('shows the empty-state copy when no archive entries exist', () => {
    mockLoadArchive.mockReturnValue([]);
    render(<PreviousMesosPage goBack={() => {}} />);
    expect(screen.getByText('PREVIOUS MESO CYCLES')).toBeInTheDocument();
    expect(screen.getByText(/No archived mesocycles yet/)).toBeInTheDocument();
  });

  it('calls goBack when the back button is tapped', () => {
    mockLoadArchive.mockReturnValue([]);
    const goBack = vi.fn();
    render(<PreviousMesosPage goBack={goBack} />);
    fireEvent.click(screen.getByLabelText('Back to Progress'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('renders a card per archived meso with newest = highest number', () => {
    mockLoadArchive.mockReturnValue([
      {
        id: 42,
        archivedAt: '2026-04-30T00:00:00.000Z',
        profile: { goal: 'Hypertrophy', startDate: '2026-03-01' },
        mesoWeeks: 7,
        mesoDays: 6,
        totalSessions: 42,
        completedSessions: 40,
        sessions: [
          { d: 0, w: 0, data: { 0: { 0: { weight: '200', reps: '6', _exId: 'bench_bb' } } } },
          { d: 0, w: 6, data: { 0: { 0: { weight: '220', reps: '6', _exId: 'bench_bb' } } } },
        ],
      },
      {
        id: 41,
        archivedAt: '2026-03-01T00:00:00.000Z',
        profile: { goal: 'Strength', startDate: '2026-01-01' },
        mesoWeeks: 6,
        mesoDays: 6,
        totalSessions: 36,
        completedSessions: 30,
        sessions: [],
      },
    ]);
    render(<PreviousMesosPage goBack={() => {}} />);
    // 02 = newest (id 42), 01 = older
    expect(screen.getByText('Meso 02')).toBeInTheDocument();
    expect(screen.getByText('Meso 01')).toBeInTheDocument();
    // Phase summaries are derived from profile.goal.
    expect(screen.getByText(/Hypertrophy block/)).toBeInTheDocument();
    expect(screen.getByText(/Strength block/)).toBeInTheDocument();
    // Sessions count rendered.
    expect(screen.getByText('40/42')).toBeInTheDocument();
    // First meso defaults open — Bench Press row should be visible.
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
  });
});
