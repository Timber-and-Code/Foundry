/**
 * Friendship writes go through server-side RPCs (migration 013). RLS only
 * lets a client write its own row, so the old client-side mirror insert,
 * invite consumption and one-sided removal were silently denied.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { rpcMock, upsertMock, fromMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(), upsertMock: vi.fn(), fromMock: vi.fn(),
}));

vi.mock('../supabase.js', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'me' } } } }) },
    rpc: (...a: unknown[]) => rpcMock(...a),
    from: (t: string) => {
      fromMock(t);
      return {
        upsert: (...a: unknown[]) => upsertMock(...a),
        delete: () => { throw new Error('client-side delete must not be used'); },
        insert: () => { throw new Error('client-side insert must not be used'); },
      };
    },
  },
}));
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { acceptFriendInvite, removeFriend, updateFriendShareLevel } from '../sync';

describe('friendship sync', () => {
  beforeEach(() => { rpcMock.mockReset(); upsertMock.mockReset(); fromMock.mockReset(); });

  it('accept goes through the RPC with the chosen level', async () => {
    rpcMock.mockImplementation(async (name: string) =>
      name === 'preview_friend_invite'
        ? { data: [{ code: 'ABC123', inviter_id: 'them', inviter_name: 'Sam', expires_at: '2099-01-01' }], error: null }
        : { data: 'them', error: null });
    const res = await acceptFriendInvite('abc123', 'basic');
    expect(res).toEqual({ success: true, inviterUserId: 'them' });
    expect(rpcMock).toHaveBeenCalledWith('accept_friend_invite', { p_code: 'ABC123', p_share_level: 'basic' });
  });

  it('maps an expired code to a readable error', async () => {
    rpcMock.mockImplementation(async (name: string) =>
      name === 'preview_friend_invite'
        ? { data: [{ code: 'ABC123', inviter_id: 'them', inviter_name: 'Sam', expires_at: '2099-01-01' }], error: null }
        : { data: null, error: { message: 'invalid or expired code' } });
    expect(await acceptFriendInvite('ABC123')).toEqual({ success: false, error: 'Invalid or expired code' });
  });

  it('remove clears both sides server-side', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    expect(await removeFriend('them')).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith('remove_friend', { p_friend_id: 'them' });
  });

  it("share level upserts the caller's own row (it may not exist yet)", async () => {
    upsertMock.mockResolvedValue({ error: null });
    expect(await updateFriendShareLevel('them', 'basic')).toBe(true);
    expect(upsertMock).toHaveBeenCalledWith(
      { user_id: 'me', friend_id: 'them', share_level: 'basic' },
      { onConflict: 'user_id,friend_id' },
    );
  });
});
