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
        exIdx={0}
        currentWeekIdx={1}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('WK 2')).toBeInTheDocument();
    expect(screen.getByText('WK 1')).toBeInTheDocument();
    // Current-week TODAY tag.
    expect(screen.getByText('Today')).toBeInTheDocument();
  });

  it('shows an empty-state message when no sets are logged', () => {
    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        exIdx={0}
        currentWeekIdx={2}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );
    expect(
      screen.getByText('No sets logged yet'),
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
        exIdx={0}
        currentWeekIdx={1}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );
    // Only the week 0 row should carry the PR badge — week 1 is in-progress.
    const prBadges = screen.getAllByText('PR');
    expect(prBadges).toHaveLength(1);
  });

  it('reads only the requested slot — does not bleed data from other exercises in the day', () => {
    // Day 0 has two exercises in week 0:
    //   slot 0 = Bench Press, 4 sets logged (heavier, more sets)
    //   slot 1 = Pull-ups,    1 set  logged
    // The previous "pick the slice with the most logged sets" path would
    // attribute Bench Press's 4 sets to whichever exercise was tapped.
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({
        0: {
          0: { weight: 185, reps: 8 },
          1: { weight: 185, reps: 8 },
          2: { weight: 185, reps: 7 },
          3: { weight: 175, reps: 8 },
        },
        1: { 0: { weight: 25, reps: 8 } },
      }),
    );

    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        exIdx={1}
        currentWeekIdx={0}
        mesoWeeks={6}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('25 × 8')).toBeInTheDocument();
    // Bench Press numbers must NOT show up under Pull-ups.
    expect(screen.queryByText(/185/)).not.toBeInTheDocument();
  });

  it('closes via the close button', () => {
    const onClose = vi.fn();
    render(
      <MesoHistoryView
        exercise={exercise}
        dayIdx={0}
        exIdx={0}
        currentWeekIdx={0}
        mesoWeeks={6}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the thumb-reach Done button and the close button', () => {
    const onClose = vi.fn();
    render(
      <MesoHistoryView exercise={exercise} dayIdx={0} exIdx={0} currentWeekIdx={0} mesoWeeks={5} onClose={onClose} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'DONE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('counts the viewed week in Best set once that day is done', () => {
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: { weight: 185, reps: 6 } } }));
    localStorage.setItem('foundry:day0:week1', JSON.stringify({ 0: { 0: { weight: 195, reps: 8 } } }));
    localStorage.setItem('foundry:done:d0:w1', '1');
    render(
      <MesoHistoryView exercise={exercise} dayIdx={0} exIdx={0} currentWeekIdx={1} mesoWeeks={6} onClose={() => {}} />,
    );
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('195 × 8');
  });

  it('still leaves an in-progress session out of Best set', () => {
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: { weight: 185, reps: 6 } } }));
    localStorage.setItem('foundry:day0:week1', JSON.stringify({ 0: { 0: { weight: 195, reps: 8 } } }));
    render(
      <MesoHistoryView exercise={exercise} dayIdx={0} exIdx={0} currentWeekIdx={1} mesoWeeks={6} onClose={() => {}} />,
    );
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('185 × 6');
  });

  // The previous meso is history too — and at week 1 of a new block it is
  // the only history there is. Every logged week renders, deload marked,
  // the last hard week flagged as the one to train off. `foundry:archive`
  // is read through the store barrel, so seeding localStorage is enough.
  it('lists the previous meso week by week under the current meso', () => {
    localStorage.setItem(
      'foundry:archive',
      JSON.stringify([
        {
          id: 'aug',
          name: '6 Week FB — August 3, 2026',
          archivedAt: '2026-09-18T00:00:00Z',
          profile: { mesoLength: 6 },
          mesoWeeks: 7,
          sessions: [
            { d: 0, w: 0, data: { 0: { 0: { _exId: 'pullups_bw', weight: 45, reps: 8, warmup: true }, 1: { _exId: 'pullups_bw', weight: 70, reps: 6 } } } },
            { d: 0, w: 5, data: { 0: { 0: { _exId: 'pullups_bw', weight: 80, reps: 6 }, 1: { _exId: 'pullups_bw', weight: 80, reps: 5 } } } },
            { d: 0, w: 6, data: { 0: { 0: { _exId: 'pullups_bw', weight: 70, reps: 4 } } } },
          ],
        },
      ]),
    );
    render(
      <MesoHistoryView exercise={exercise} dayIdx={0} exIdx={0} currentWeekIdx={0} mesoWeeks={7} onClose={() => {}} />,
    );
    // Empty current meso still shows the previous one.
    expect(screen.getByText('No sets logged yet')).toBeInTheDocument();
    expect(screen.getByText('Last meso')).toBeInTheDocument();
    expect(screen.getByText('6 Week FB — August 3, 2026')).toBeInTheDocument();
    // Newest week first; deload marked; reference week flagged.
    const rows = [6, 5, 0].map((w) => screen.getByTestId(`prev-meso-week-${w}`));
    expect(rows[0]).toHaveTextContent('WK 7');
    expect(rows[0]).toHaveTextContent('Deload');
    expect(rows[0]).toHaveTextContent('70 × 4');
    expect(rows[1]).toHaveTextContent('WK 6');
    expect(rows[1]).toHaveTextContent('Train off');
    expect(rows[1]).toHaveTextContent('80 × 6');
    expect(rows[1]).toHaveTextContent('80 × 5');
    expect(rows[2]).toHaveTextContent('WU');
    expect(rows[2]).toHaveTextContent('45 × 8');
    expect(rows[2]).toHaveTextContent('70 × 6');
    // Only one week is the one to train off.
    expect(screen.getAllByText('Train off')).toHaveLength(1);
  });

  it('omits the previous-meso section when the archive has nothing for this lift', () => {
    localStorage.setItem(
      'foundry:archive',
      JSON.stringify([{ id: 'x', profile: { mesoLength: 6 }, sessions: [{ d: 0, w: 2, data: { 0: { 0: { _exId: 'other', weight: 100, reps: 5 } } } }] }]),
    );
    render(
      <MesoHistoryView exercise={exercise} dayIdx={0} exIdx={0} currentWeekIdx={0} mesoWeeks={7} onClose={() => {}} />,
    );
    expect(screen.queryByText('Last meso')).toBeNull();
    expect(screen.queryByText('Train off')).toBeNull();
  });
});
