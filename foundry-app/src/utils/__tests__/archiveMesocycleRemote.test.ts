/**
 * archiveMesocycleRemote — ending a meso early.
 *
 * An empty meso is DELETED (server-side check in discard_empty_meso, since
 * the delete cascades to every member's sets); anything else — work logged,
 * shared, RPC missing, network error — is marked 'abandoned'. Abandoned is
 * the safe default: it never loses a set.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { rpcMock, updateMock } = vi.hoisted(() => ({ rpcMock: vi.fn(), updateMock: vi.fn() }));

vi.mock('../supabase.js', () => {
  const chain = () => {
    const c: Record<string, unknown> = {};
    c.eq = () => c;
    c.then = (res: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(res);
    return c;
  };
  return {
    supabase: {
      auth: { getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }) },
      rpc: (...args: unknown[]) => rpcMock(...args),
      from: (table: string) => ({
        update: (row: unknown) => {
          updateMock(table, row);
          return chain();
        },
      }),
    },
  };
});
vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import { archiveMesocycleRemote } from '../sync';

const abandonedWrites = () =>
  updateMock.mock.calls.filter(([t, row]) => t === 'mesocycles' && (row as { status?: string }).status === 'abandoned');

describe('archiveMesocycleRemote', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('foundry:active_meso_id', 'meso-1');
    rpcMock.mockReset();
    updateMock.mockReset();
  });

  it('deletes an empty meso instead of marking it abandoned', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    await archiveMesocycleRemote();
    expect(rpcMock).toHaveBeenCalledWith('discard_empty_meso', { p_meso_id: 'meso-1' });
    expect(abandonedWrites()).toHaveLength(0);
    expect(localStorage.getItem('foundry:active_meso_id')).toBeNull();
  });

  it('marks it abandoned when the server keeps it (work logged or shared)', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    await archiveMesocycleRemote();
    expect(abandonedWrites()).toHaveLength(1);
  });

  it('falls back to abandoned when the RPC is missing or fails', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } });
    await archiveMesocycleRemote();
    expect(abandonedWrites()).toHaveLength(1);

    updateMock.mockReset();
    localStorage.setItem('foundry:active_meso_id', 'meso-1');
    rpcMock.mockRejectedValue(new Error('offline'));
    await archiveMesocycleRemote();
    expect(abandonedWrites()).toHaveLength(1);
  });
});
