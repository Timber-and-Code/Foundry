/**
 * The Quote share card carries the session's tonnage, like the Session
 * card does. It shipped without it in 2.15.10.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ShareCardView } from '../share/ShareCards';
import type { WorkoutCompleteStats } from '../WorkoutCompleteModal';

const stats: WorkoutCompleteStats = {
  sets: 14,
  reps: 98,
  volume: 12450.4,
  exercises: 5,
  duration: 52 * 60,
  prs: [],
  anchorComparison: [],
  breakdown: [],
};

describe('Quote share card', () => {
  it('shows the lb moved next to the quote and the stat row', () => {
    render(
      <ShareCardView
        template="quote"
        data={{ dayLabel: 'Full Body B', weekIdx: 0, phase: 'Accumulation', stats, quote: { text: 'Forge on.', author: 'Coach' } }}
      />,
    );
    expect(screen.getByText('Forge on.')).toBeInTheDocument();
    expect(screen.getByText('— Coach')).toBeInTheDocument();
    expect(screen.getByText('12,450')).toBeInTheDocument();
    expect(screen.getByText('LB MOVED')).toBeInTheDocument();
    expect(screen.getByText('SETS')).toBeInTheDocument();
  });
});
