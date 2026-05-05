/**
 * SupersetGroup wrapper — chrome-only smoke tests. The DEV-flagged
 * "Pair as superset" affordance lives on DayView; the wrapper itself is
 * always renderable when the caller supplies the data.
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

  it('renders a SUPERSET label with A1, A2 letters', () => {
    render(
      <SupersetGroup exercises={[exA, exB]}>
        <div data-testid="card-a">A</div>
        <div data-testid="card-b">B</div>
      </SupersetGroup>,
    );
    expect(screen.getByText('Superset')).toBeInTheDocument();
    expect(screen.getByText('A1, A2')).toBeInTheDocument();
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
