/**
 * The sheet's whole job is telling the truth about who a saved order reaches.
 * An owner's rows ARE the shared program; a member's are a private overlay.
 * These tests pin the copy to that distinction, because getting it backwards
 * means quietly rearranging someone else's training session.
 */
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ReorderScopeSheet from '../ReorderScopeSheet';

const setup = (role: 'solo' | 'owner' | 'member', overrides = {}) => {
  const onSessionOnly = vi.fn();
  const onPersist = vi.fn();
  render(
    <ReorderScopeSheet
      role={role}
      dayLabel="FULL BODY A"
      onSessionOnly={onSessionOnly}
      onPersist={onPersist}
      {...overrides}
    />,
  );
  return { onSessionOnly, onPersist };
};

describe('ReorderScopeSheet', () => {
  it('warns an owner that everyone on the program is affected', () => {
    setup('owner');
    expect(screen.getByText(/Keep it for everyone/i)).toBeInTheDocument();
    expect(screen.getByText(/Everyone training it will see this order/i)).toBeInTheDocument();
  });

  it('promises a member their change stays private', () => {
    setup('member');
    expect(screen.getByText(/Keep it for me/i)).toBeInTheDocument();
    expect(
      screen.getByText(/won't change the program for whoever shared it/i),
    ).toBeInTheDocument();
  });

  it('never mentions other people for a solo lifter', () => {
    setup('solo');
    expect(screen.queryByText(/everyone/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/shared/i)).not.toBeInTheDocument();
    expect(screen.getByText(/every week of the meso/i)).toBeInTheDocument();
  });

  it('always offers a session-only escape', () => {
    const { onSessionOnly } = setup('owner');
    fireEvent.click(screen.getByTestId('reorder-session-only'));
    expect(onSessionOnly).toHaveBeenCalled();
  });

  it('persists on the primary action', () => {
    const { onPersist } = setup('solo');
    fireEvent.click(screen.getByTestId('reorder-persist'));
    expect(onPersist).toHaveBeenCalled();
  });

  it('locks both actions while saving', () => {
    setup('solo', { busy: true });
    expect(screen.getByTestId('reorder-persist')).toBeDisabled();
    expect(screen.getByTestId('reorder-session-only')).toBeDisabled();
  });
});
