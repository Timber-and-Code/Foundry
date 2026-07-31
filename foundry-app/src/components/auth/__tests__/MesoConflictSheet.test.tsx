/**
 * Tests for MesoConflictSheet — sign-in anon-vs-account meso chooser.
 */
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';

import MesoConflictSheet from '../MesoConflictSheet';

describe('MesoConflictSheet', () => {
  it('renders both choices in a modal dialog', () => {
    render(
      <MesoConflictSheet
        onKeepLocal={vi.fn(async () => {})}
        onRestoreAccount={vi.fn(async () => {})}
      />,
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/keep the meso i just built/i)).toBeInTheDocument();
    expect(screen.getByText(/restore my account's meso/i)).toBeInTheDocument();
  });

  it('routes each card to its handler', () => {
    const onKeepLocal = vi.fn(async () => {});
    const onRestoreAccount = vi.fn(async () => {});
    render(
      <MesoConflictSheet onKeepLocal={onKeepLocal} onRestoreAccount={onRestoreAccount} />,
    );
    fireEvent.click(screen.getByText(/keep the meso i just built/i));
    expect(onKeepLocal).toHaveBeenCalledTimes(1);
    expect(onRestoreAccount).not.toHaveBeenCalled();
  });

  it('disables both cards while a choice is applying', async () => {
    let resolveChain: () => void = () => {};
    const onKeepLocal = vi.fn(
      () => new Promise<void>((resolve) => { resolveChain = resolve; }),
    );
    const onRestoreAccount = vi.fn(async () => {});
    render(
      <MesoConflictSheet onKeepLocal={onKeepLocal} onRestoreAccount={onRestoreAccount} />,
    );

    fireEvent.click(screen.getByText(/keep the meso i just built/i));
    // Second taps must be ignored while the sync chain is in flight.
    fireEvent.click(screen.getByText(/restore my account's meso/i));
    fireEvent.click(screen.getByText(/keep the meso i just built/i));
    expect(onKeepLocal).toHaveBeenCalledTimes(1);
    expect(onRestoreAccount).not.toHaveBeenCalled();
    expect(screen.getByText(/syncing your choice/i)).toBeInTheDocument();

    await act(async () => {
      resolveChain();
    });
  });

  it('surfaces a retryable error when the chain rejects', async () => {
    // A rejection means the choice did NOT take. Falling through silently
    // would leave the sheet looking idle while sync stays deferred.
    const onKeepLocal = vi.fn(async () => {
      throw new Error('abandon-remote-meso-failed');
    });
    const onRestoreAccount = vi.fn(async () => {});
    render(
      <MesoConflictSheet onKeepLocal={onKeepLocal} onRestoreAccount={onRestoreAccount} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText(/keep the meso i just built/i));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/couldn't save that choice/i);
    expect(screen.queryByText(/syncing your choice/i)).not.toBeInTheDocument();

    // And the cards are live again so the user can retry.
    await act(async () => {
      fireEvent.click(screen.getByText(/restore my account's meso/i));
    });
    expect(onRestoreAccount).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
