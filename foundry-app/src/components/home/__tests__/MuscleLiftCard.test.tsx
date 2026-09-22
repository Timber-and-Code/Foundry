/**
 * MuscleLiftCard — collapsed/expanded behaviour + delta rendering.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import MuscleLiftCard from '../MuscleLiftCard';

describe('MuscleLiftCard', () => {
  const lifts = [
    { name: 'Bench Press', start: 200, current: 220, pr: 260, volume: 9800 },
    { name: 'Incline DB Press', start: 70, current: 85, pr: 90, volume: 3650 },
  ];

  it('renders the muscle heading + lift count + lb moved when collapsed', () => {
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
    // Tonnage this meso = 9,800 + 3,650. The header used to sum the
    // start → current deltas, which is 0 lb all through week 1.
    expect(screen.getByText('13,450')).toBeInTheDocument();
    expect(screen.getByText('lb moved')).toBeInTheDocument();
    expect(screen.queryByText('+35')).not.toBeInTheDocument();
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
