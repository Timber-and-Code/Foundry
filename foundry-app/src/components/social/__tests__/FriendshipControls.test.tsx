/**
 * Before this, nothing in the app let you stop sharing with a friend or
 * remove one — both existed server-side only.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { removeMock, levelMock, emitMock } = vi.hoisted(() => ({
  removeMock: vi.fn(), levelMock: vi.fn(), emitMock: vi.fn(),
}));
vi.mock('../../../utils/sync', () => ({ removeFriend: removeMock, updateFriendShareLevel: levelMock }));
vi.mock('../../../utils/events', () => ({ emit: emitMock }));
vi.mock('../AddFriendModal', () => ({ FRIENDS_CHANGED_EVENT: 'foundry:friends-changed' }));

import FriendshipControls from '../FriendshipControls';

const renderIt = (onRemoved = vi.fn()) => {
  render(<FriendshipControls friendId="u2" friendName="Tyler Griggs" myShareLevel="full" onRemoved={onRemoved} />);
  return onRemoved;
};

describe('FriendshipControls', () => {
  beforeEach(() => { removeMock.mockReset(); levelMock.mockReset(); emitMock.mockReset(); });

  it('shows the current sharing level', () => {
    renderIt();
    expect(screen.getByRole('radio', { name: /full/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /basic/i })).toHaveAttribute('aria-checked', 'false');
  });

  it('changes what the friend can see', async () => {
    levelMock.mockResolvedValue(true);
    renderIt();
    fireEvent.click(screen.getByRole('radio', { name: /basic/i }));
    expect(levelMock).toHaveBeenCalledWith('u2', 'basic');
    await waitFor(() => expect(screen.getByRole('radio', { name: /basic/i })).toHaveAttribute('aria-checked', 'true'));
  });

  it('reverts and says so when the change fails', async () => {
    levelMock.mockResolvedValue(false);
    renderIt();
    fireEvent.click(screen.getByRole('radio', { name: /basic/i }));
    await waitFor(() => expect(screen.getByRole('radio', { name: /full/i })).toHaveAttribute('aria-checked', 'true'));
    expect(emitMock).toHaveBeenCalledWith('foundry:toast', expect.objectContaining({ type: 'error' }));
  });

  it('removes only after confirming', async () => {
    removeMock.mockResolvedValue(true);
    const onRemoved = renderIt();
    fireEvent.click(screen.getByRole('button', { name: /remove tyler/i }));
    expect(removeMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() => expect(onRemoved).toHaveBeenCalled());
    expect(removeMock).toHaveBeenCalledWith('u2');
  });

  it('cancel keeps the friend', () => {
    renderIt();
    fireEvent.click(screen.getByRole('button', { name: /remove tyler/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(removeMock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /remove tyler/i })).toBeInTheDocument();
  });
});
