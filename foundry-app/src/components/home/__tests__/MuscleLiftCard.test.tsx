/**
 * MuscleLiftCard — collapsed/expanded behaviour + delta rendering.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import MuscleLiftCard from '../MuscleLiftCard';

describe('MuscleLiftCard', () => {
  const lifts = [
    { name: 'Bench Press', start: 200, current: 220, pr: 260 },
    { name: 'Incline DB Press', start: 70, current: 85, pr: 90 },
  ];

  it('renders the muscle heading + lift count + total delta when collapsed', () => {
    render(
      <MuscleLiftCard
        muscle="Chest"
        lifts={lifts}
        open={false}
        onToggle={() => {}}
        accent="#E8651A"
      />,
    );
    expect(screen.getByText('Chest')).toBeInTheDocument();
    expect(screen.getByText('2 lifts')).toBeInTheDocument();
    // Total delta = (220-200) + (85-70) = 20 + 15 = 35
    expect(screen.getByText('+35')).toBeInTheDocument();
    // Individual lifts are NOT visible when collapsed.
    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
  });

  it('reveals individual lift rows when open=true', () => {
    render(
      <MuscleLiftCard
        muscle="Chest"
        lifts={lifts}
        open={true}
        onToggle={() => {}}
        accent="#E8651A"
      />,
    );
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    // start → current lb · PR pr
    expect(screen.getByText(/200 → 220 lb · PR 260/)).toBeInTheDocument();
    expect(screen.getByText(/70 → 85 lb · PR 90/)).toBeInTheDocument();
  });

  it('calls onToggle when the header button is tapped', () => {
    const onToggle = vi.fn();
    render(
      <MuscleLiftCard
        muscle="Chest"
        lifts={lifts}
        open={false}
        onToggle={onToggle}
        accent="#E8651A"
      />,
    );
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
