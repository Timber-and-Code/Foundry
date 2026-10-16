/**
 * MesoHistoryView — the per-exercise history sheet.
 *
 * History is FINISHED weeks and CONFIRMED sets. The viewed week is the
 * workout, not history, so it never appears; a carry-over suggestion or a
 * typed-but-unconfirmed row saved into a week is not a lift and never
 * renders. Rows list newest first; the heaviest confirmed weight × reps
 * carries the PR badge.
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

const done = (weight: number, reps: number, extra: Record<string, unknown> = {}) => ({
  weight,
  reps,
  confirmed: true,
  ...extra,
});

const seed = (dayIdx: number, weekIdx: number, data: unknown) =>
  localStorage.setItem(`foundry:day${dayIdx}:week${weekIdx}`, JSON.stringify(data));

const open = (currentWeekIdx: number, exIdx = 0, mesoWeeks = 9, onClose = () => {}) =>
  render(
    <MesoHistoryView
      exercise={exercise}
      dayIdx={0}
      exIdx={exIdx}
      currentWeekIdx={currentWeekIdx}
      mesoWeeks={mesoWeeks}
      onClose={onClose}
    />,
  );

describe('MesoHistoryView', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lists finished weeks newest first and leaves the viewed week out', () => {
    seed(0, 0, { 0: { 0: done(25, 8) } });
    seed(0, 1, { 0: { 0: done(30, 10) } });
    seed(0, 2, { 0: { 0: done(35, 10) } }); // the week being viewed

    open(2);

    expect(screen.getByText('WK 2')).toBeInTheDocument();
    expect(screen.getByText('WK 1')).toBeInTheDocument();
    expect(screen.queryByText('WK 3')).toBeNull();
    expect(screen.queryByText('Today')).toBeNull();
    expect(screen.queryByText('35 × 10')).toBeNull();
    // Newest first.
    const rows = screen.getAllByText(/^WK \d$/).map((n) => n.textContent);
    expect(rows).toEqual(['WK 2', 'WK 1']);
  });

  it('week 1 has no history yet', () => {
    seed(0, 0, { 0: { 0: done(25, 8) } });
    open(0);
    expect(screen.getByText('No sets logged yet')).toBeInTheDocument();
    expect(screen.queryByText('WK 1')).toBeNull();
  });

  it('a saved carry-over suggestion is not a lift', () => {
    seed(0, 0, { 0: { 0: done(25, 8), 1: done(25, 8) } });
    // Week 2 was opened, one set elsewhere in the day was saved, and this
    // lift's suggested rows (30 × 8, never confirmed) went to storage with it.
    seed(0, 1, {
      0: {
        0: { weight: 30, reps: 8, suggested: true, repsSuggested: true },
        1: { weight: 30, reps: 8, suggested: true, repsSuggested: true },
      },
    });

    open(2);

    expect(screen.queryByText('30 × 8')).toBeNull();
    expect(screen.getByText('Not logged yet')).toBeInTheDocument();
    // The headline stats see one logged week, not a +5 gain.
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('25 × 8');
    expect(screen.getByText('This meso').parentElement).toHaveTextContent('Needs 2 weeks');
  });

  it('a typed-but-unconfirmed row is not a lift either', () => {
    seed(0, 0, { 0: { 0: done(25, 8) } });
    seed(0, 1, { 0: { 0: { weight: 40, reps: 5 } } });
    open(2);
    expect(screen.queryByText('40 × 5')).toBeNull();
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('25 × 8');
  });

  it('marks the heaviest confirmed weight × reps with a PR badge', () => {
    seed(0, 0, { 0: { 0: done(25, 8) } });
    seed(0, 1, { 0: { 0: done(35, 6), 1: done(35, 5) } });
    open(2);
    const prBadges = screen.getAllByText('PR');
    expect(prBadges).toHaveLength(1);
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('35 × 6');
  });

  it('last week counts as soon as its sets are confirmed, finished or not', () => {
    seed(0, 0, { 0: { 0: done(185, 6) } });
    seed(0, 1, { 0: { 0: done(195, 8) } }); // no foundry:done flag
    open(2);
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('195 × 8');
    expect(screen.getByText('This meso').parentElement).toHaveTextContent('+10 lb');
  });

  it('shows confirmed warmups, tagged', () => {
    seed(0, 0, { 0: { 0: done(45, 10, { warmup: true }), 1: done(70, 6) } });
    open(1);
    expect(screen.getByText('WU')).toBeInTheDocument();
    expect(screen.getByText('45 × 10')).toBeInTheDocument();
    // The warmup is never the PR.
    expect(screen.getByText('Best set').parentElement).toHaveTextContent('70 × 6');
  });

  it('shows an empty-state message when no sets are logged', () => {
    open(2);
    expect(screen.getByText('No sets logged yet')).toBeInTheDocument();
  });

  it('reads only the requested slot — does not bleed data from other exercises in the day', () => {
    seed(0, 0, {
      0: { 0: done(185, 8), 1: done(185, 8), 2: done(185, 7), 3: done(175, 8) },
      1: { 0: done(25, 8) },
    });
    open(1, 1);
    // Appears as the Best set tile and as the week chip.
    expect(screen.getAllByText(/25 × 8/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/185/)).not.toBeInTheDocument();
  });

  it('closes via the close button', () => {
    const onClose = vi.fn();
    open(0, 0, 9, onClose);
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the thumb-reach Done button and the close button', () => {
    const onClose = vi.fn();
    open(0, 0, 5, onClose);
    fireEvent.click(screen.getByRole('button', { name: 'DONE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close history' }));
    expect(onClose).toHaveBeenCalledTimes(2);
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
            { d: 0, w: 0, data: { 0: { 0: done(45, 8, { _exId: 'pullups_bw', warmup: true }), 1: done(70, 6, { _exId: 'pullups_bw' }) } } },
            { d: 0, w: 5, data: { 0: { 0: done(80, 6, { _exId: 'pullups_bw' }), 1: done(80, 5, { _exId: 'pullups_bw' }) } } },
            { d: 0, w: 6, data: { 0: { 0: done(70, 4, { _exId: 'pullups_bw' }) } } },
          ],
        },
      ]),
    );
    open(0, 0, 7);
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
      JSON.stringify([{ id: 'x', profile: { mesoLength: 6 }, sessions: [{ d: 0, w: 2, data: { 0: { 0: done(100, 5, { _exId: 'other' }) } } }] }]),
    );
    open(0, 0, 7);
    expect(screen.queryByText('Last meso')).toBeNull();
    expect(screen.queryByText('Train off')).toBeNull();
  });
});
