/**
 * FriendsTab — the dedicated social tab (forge-v2).
 *
 * Covers: signed-out prompt, empty state with invite CTA, friends list
 * rows (activity glance + share-level chip), and dashboard open on tap.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockListFriends, mockUseAuth } = vi.hoisted(() => ({
  mockListFriends: vi.fn((): Promise<unknown[]> => Promise.resolve([])),
  mockUseAuth: vi.fn((): { user: { id: string } | null } => ({ user: { id: 'me' } })),
}));

vi.mock('../../../utils/sync', () => ({
  listFriends: mockListFriends,
}));
vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
}));
vi.mock('../AddFriendModal', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="add-friend-modal" /> : null,
  FRIENDS_CHANGED_EVENT: 'foundry:friends-changed',
}));
vi.mock('../FriendDashboardModal', () => ({
  default: ({ open, member }: { open: boolean; member: { name: string } }) =>
    open ? <div data-testid="friend-dashboard">{member.name}</div> : null,
}));

import FriendsTab from '../FriendsTab';

const FRIEND = {
  userId: 'f1',
  name: 'Sarah Connor',
  shareLevel: 'full',
  activeMesoId: 'm1',
  activeMesoName: 'PPL Summer',
  lastWorkout: { dayIdx: 0, weekIdx: 2, completedAt: new Date().toISOString() },
  createdAt: '2026-06-01T00:00:00.000Z',
};

describe('FriendsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 'me' } });
    mockListFriends.mockResolvedValue([]);
  });

  it('shows the sign-in prompt when signed out', () => {
    mockUseAuth.mockReturnValue({ user: null });
    render(<FriendsTab />);
    expect(screen.getByText('Train with friends')).toBeTruthy();
    expect(screen.queryByText('+ ADD FRIEND')).toBeNull();
  });

  it('shows the empty state with an invite CTA', async () => {
    render(<FriendsTab />);
    await waitFor(() => expect(screen.getByText('No friends yet')).toBeTruthy());
    fireEvent.click(screen.getByText('Invite a friend'));
    expect(screen.getByTestId('add-friend-modal')).toBeTruthy();
  });

  it('renders friend rows with activity glance and share chip', async () => {
    mockListFriends.mockResolvedValue([FRIEND]);
    render(<FriendsTab />);
    await waitFor(() => expect(screen.getByText('Sarah Connor')).toBeTruthy());
    // Trained today → flame glance; meso name appended.
    expect(screen.getByText(/🔥 trained today · PPL Summer/)).toBeTruthy();
    expect(screen.getByText('FULL')).toBeTruthy();
  });

  it('opens the dashboard on row tap', async () => {
    mockListFriends.mockResolvedValue([FRIEND]);
    render(<FriendsTab />);
    await waitFor(() => expect(screen.getByText('Sarah Connor')).toBeTruthy());
    fireEvent.click(screen.getByLabelText("Open Sarah Connor's dashboard"));
    expect(screen.getByTestId('friend-dashboard')).toBeTruthy();
  });

  it('refreshes when the friends-changed event fires', async () => {
    render(<FriendsTab />);
    await waitFor(() => expect(mockListFriends).toHaveBeenCalledTimes(1));
    mockListFriends.mockResolvedValue([FRIEND]);
    window.dispatchEvent(new Event('foundry:friends-changed'));
    await waitFor(() => expect(screen.getByText('Sarah Connor')).toBeTruthy());
  });
});
