/**
 * Tests for ActiveSessionContext — hydration from localStorage, setter
 * round-trips, 6h staleness cleanup.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';

// Supabase client construction at module scope requires env vars that aren't
// set in vitest — stub it out before the provider pulls in the store barrel.
vi.mock('../../utils/supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() } },
}));
vi.mock('../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
  pullFromSupabase: vi.fn(),
  pushToSupabase: vi.fn(),
  upsertWorkoutSessionRemote: vi.fn(),
  upsertWorkoutSetRemote: vi.fn(),
  deleteWorkoutSetRemote: vi.fn(),
  getOrCreateWorkoutSessionId: vi.fn(() => 'test-session'),
  syncExerciseSwapRemote: vi.fn(),
  debouncedSync: vi.fn(),
}));

import {
  ActiveSessionProvider,
  useActiveSession,
  type ActiveSession,
} from '../ActiveSessionContext';

const STORAGE_KEY = 'foundry:active_session';

let capturedCtx: ReturnType<typeof useActiveSession> | null = null;

function ContextCapture() {
  capturedCtx = useActiveSession();
  return null;
}

async function mountProvider() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = null;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <ActiveSessionProvider>
        <ContextCapture />
      </ActiveSessionProvider>,
    );
  });
  return {
    cleanup: async () => {
      await act(async () => root?.unmount());
      document.body.removeChild(container);
    },
  };
}

describe('ActiveSessionContext', () => {
  beforeEach(() => {
    capturedCtx = null;
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('throws when useActiveSession is used outside the provider', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    function BadConsumer() {
      useActiveSession();
      return null;
    }
    expect(() => {
      act(() => {
        createRoot(container).render(<BadConsumer />);
      });
    }).toThrow(/ActiveSessionProvider/);
    document.body.removeChild(container);
  });

  it('hydrates with null when storage is empty', async () => {
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toBeNull();
    await cleanup();
  });

  it('hydrates a fresh session from localStorage on mount', async () => {
    const fresh: ActiveSession = {
      kind: 'lifting',
      label: 'PUSH DAY',
      route: '/day/0/0',
      startedAt: Date.now() - 5 * 60 * 1000,
      setsDone: 3,
      totalSets: 12,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toEqual(fresh);
    await cleanup();
  });

  it('drops a stale (>6h old) session on hydration', async () => {
    const stale: ActiveSession = {
      kind: 'lifting',
      label: 'PUSH DAY',
      route: '/day/0/0',
      startedAt: Date.now() - 7 * 60 * 60 * 1000,
      setsDone: 1,
      totalSets: 12,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale));
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toBeNull();
    // Hydration clean-up should have removed the key as well.
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await cleanup();
  });

  it('ignores malformed JSON in localStorage', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toBeNull();
    await cleanup();
  });

  it('ignores entries with an unknown kind', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ kind: 'yoga', label: 'x', route: '/', startedAt: Date.now() }),
    );
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toBeNull();
    await cleanup();
  });

  it('hydrates a fresh mobility session from localStorage on mount', async () => {
    const fresh: ActiveSession = {
      kind: 'mobility',
      label: 'Hip Reset',
      route: '/mobility/2026-04-21',
      startedAt: Date.now() - 2 * 60 * 1000,
      durationMin: 10,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toEqual(fresh);
    await cleanup();
  });

  it('drops a stale (>6h old) mobility session on hydration', async () => {
    const stale: ActiveSession = {
      kind: 'mobility',
      label: 'Hip Reset',
      route: '/mobility/2026-04-21',
      startedAt: Date.now() - 7 * 60 * 60 * 1000,
      durationMin: 10,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stale));
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await cleanup();
  });

  it('setActiveSession writes through to localStorage', async () => {
    const { cleanup } = await mountProvider();
    const next: ActiveSession = {
      kind: 'cardio',
      label: 'ZONE 2',
      route: '/cardio/2026-04-21/zone2',
      startedAt: Date.now(),
      durationMin: 30,
    };
    await act(async () => {
      capturedCtx!.setActiveSession(next);
    });
    expect(capturedCtx!.session).toEqual(next);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')).toEqual(next);
    await cleanup();
  });

  it('updateActiveSession merges patches and persists', async () => {
    const initial: ActiveSession = {
      kind: 'lifting',
      label: 'PUSH DAY',
      route: '/day/0/0',
      startedAt: Date.now(),
      setsDone: 0,
      totalSets: 10,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    const { cleanup } = await mountProvider();

    await act(async () => {
      capturedCtx!.updateActiveSession({ setsDone: 4 } as Partial<ActiveSession>);
    });

    expect(capturedCtx!.session).toMatchObject({ setsDone: 4, totalSets: 10, kind: 'lifting' });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    expect(raw.setsDone).toBe(4);
    await cleanup();
  });

  it('updateActiveSession is a no-op when no session is active', async () => {
    const { cleanup } = await mountProvider();
    await act(async () => {
      capturedCtx!.updateActiveSession({ setsDone: 9 } as Partial<ActiveSession>);
    });
    expect(capturedCtx!.session).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await cleanup();
  });

  it('clearActiveSession removes from state and storage', async () => {
    const initial: ActiveSession = {
      kind: 'lifting',
      label: 'PULL DAY',
      route: '/day/1/0',
      startedAt: Date.now(),
      setsDone: 2,
      totalSets: 8,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    const { cleanup } = await mountProvider();
    expect(capturedCtx!.session).not.toBeNull();

    await act(async () => {
      capturedCtx!.clearActiveSession();
    });
    expect(capturedCtx!.session).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    await cleanup();
  });
});
