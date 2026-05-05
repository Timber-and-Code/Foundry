/**
 * MesoHistoryView — verifies the per-exercise history modal pulls per-week
 * data from localStorage, lists weeks current → 1, marks the current week
 * with a TODAY tag, and highlights the heaviest weight × reps row across
 * prior weeks as a PR.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    radius: { xxl: 16, xs: 4, sm: 6 },
    colors: { overlayHeavy: 'rgba(0,0,0,0.85)' },
  },
}));

import MesoHistoryView from '../MesoHistoryView';
import type { Exercise } from '../../../types';

const exercise: Exercise = { id: 'pullups_bw', name: 'Pull-ups', muscle: 'Back' };

describe('MesoHistoryView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders WEEK rows current → 1 with the current week tagged TODAY', () => {
    // Seed week 0 + 1 sets so two rows render.
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: 25, reps: 8 } } }),
    );
    localStorage.setItem(
      'foundry:day0:week1',
      JSON.stringify({ 0: { 0: { weight: 30, reps: 10 } } }),
    );

    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        currentWeekIdx={1}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('WEEK 2')).toBeInTheDocument();
    expect(screen.getByText('WEEK 1')).toBeInTheDocument();
    // Current-week TODAY tag.
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows an empty-state message when no sets are logged', () => {
    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        currentWeekIdx={2}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByText('No logged sets yet for this exercise.'),
    ).toBeInTheDocument();
  });

  it('marks the heaviest prior weight × reps row with a PR badge (excludes current week)', () => {
    // Week 0: 25 × 8.
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: 25, reps: 8 } } }),
    );
    // Week 1 (current/in-progress): heavier set, but PR rules exclude it.
    localStorage.setItem(
      'foundry:day0:week1',
      JSON.stringify({ 0: { 0: { weight: 35, reps: 6 } } }),
    );

    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        currentWeekIdx={1}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );
    // Only the week 0 row should carry the PR badge — week 1 is in-progress.
    const prBadges = screen.getAllByText('PR');
    expect(prBadges).toHaveLength(1);
  });

  it('closes via the close button', () => {
    const onClose = vi.fn();
    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        currentWeekIdx={0}
        mesoWeeks={6}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
