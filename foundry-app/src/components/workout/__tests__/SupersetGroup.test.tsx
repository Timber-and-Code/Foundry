/**
 * SupersetGroup wrapper — chrome-only smoke tests. The DEV-flagged
 * "+ SUPERSET WITH" affordance lives in ExerciseCard's editorial header
 * (#3, #4 in 2.8.0 fix list); the wrapper itself is always renderable
 * when the caller supplies the data.
 */
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../styles/tokens', () => ({
  tokens: { radius: { lg: 8, sm: 4 } },
}));

import SupersetGroup from '../SupersetGroup';

describe('SupersetGroup', () => {
  const exA = { id: 'a', name: 'Bench Press', muscle: 'Chest' };
  const exB = { id: 'b', name: 'Bent-Over Row', muscle: 'Back' };

  it('renders a SUPERSET label without A1/A2 enumeration', () => {
    render(
      <SupersetGroup exercises={[exA, exB]}>
        <div data-testid="card-a">A</div>
        <div data-testid="card-b">B</div>
      </SupersetGroup>,
    );
    expect(screen.getByText('Superset')).toBeInTheDocument();
    expect(screen.queryByText('A1, A2')).not.toBeInTheDocument();
  });

  it('exposes a role=group region with the paired exercise names', () => {
    render(
      <SupersetGroup exercises={[exA, exB]}>
        <div />
      </SupersetGroup>,
    );
    const region = screen.getByRole('group', {
      name: /Superset:.*Bench Press.*Bent-Over Row/i,
    });
    expect(region).toBeInTheDocument();
  });

  it('renders the unpair button only when onUnpair is provided', () => {
    const { rerender } = render(
      <SupersetGroup exercises={[exA, exB]}>
        <div />
      </SupersetGroup>,
    );
    expect(screen.queryByRole('button', { name: 'Unpair superset' })).toBeNull();

    const onUnpair = vi.fn();
    rerender(
      <SupersetGroup exercises={[exA, exB]} onUnpair={onUnpair}>
        <div />
      </SupersetGroup>,
    );
    const btn = screen.getByRole('button', { name: 'Unpair superset' });
    fireEvent.click(btn);
    expect(onUnpair).toHaveBeenCalledTimes(1);
  });
});
