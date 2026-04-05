/**
 * Tests for sync.ts — conflict resolution, dirty queue, and flush behavior.
 *
 * Critical path: these tests protect the data integrity guarantees of the
 * multi-device sync system. A regression here could silently lose user data.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── Mock Supabase client BEFORE importing sync.ts ──────────────────────────
const mockGetUser = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn();

vi.mock('../supabase.js', () => ({
  supabase: {
    auth: {
      getUser: (...args: unknown[]) => mockGetUser(...args),
    },
    from: (_table: string) => ({
      upsert: (...args: unknown[]) => mockUpsert(...args),
      select: (...args: unknown[]) => mockSelect(...args),
    }),
  },
}));

// Mock Sentry to avoid needing env vars
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
}));

import {
  remoteIsNewer,
  mergeProfile,
  markDirty,
  clearDirty,
  flushDirty,
  syncMesocycleToSupabase,
} from '../sync';
import { store } from '../storage';
import type { Profile } from '../../types';

beforeEach(() => {
  localStorage.clear();
  mockGetUser.mockReset();
  mockUpsert.mockReset();
  mockSelect.mockReset();
});

afterEach(() => {
  vi.clearAllTimers();
});

// ═══════════════════════════════════════════════════════════════════════════
// storage.ts — timestamp tracking
// ═══════════════════════════════════════════════════════════════════════════

describe('store timestamp tracking', () => {
  it('store.set writes a timestamp for sync-tracked keys', () => {
    const before = new Date().toISOString();
    store.set('foundry:profile', JSON.stringify({ name: 'Atlas' }));
    const ts = store.getTimestamp('foundry:profile');
    expect(ts).not.toBeNull();
    expect(ts! >= before).toBe(true);
  });

  it('store.set does NOT write a timestamp for untracked keys', () => {
    store.set('foundry:random_key', 'value');
    expect(store.getTimestamp('foundry:random_key')).toBeNull();
  });

  it('store.setFromRemote writes the provided timestamp verbatim', () => {
    const remoteTs = '2025-06-15T12:00:00.000Z';
    store.setFromRemote('foundry:profile', JSON.stringify({ name: 'Atlas' }), remoteTs);
    expect(store.getTimestamp('foundry:profile')).toBe(remoteTs);
  });

  it('store.getTimestamp returns null for keys with no timestamp', () => {
    expect(store.getTimestamp('foundry:profile')).toBeNull();
  });

  it('store.set updates the timestamp on subsequent writes', async () => {
    store.set('foundry:profile', JSON.stringify({ name: 'A' }));
    const ts1 = store.getTimestamp('foundry:profile')!;
    // Small delay to ensure a different ISO timestamp
    await new Promise((r) => setTimeout(r, 5));
    store.set('foundry:profile', JSON.stringify({ name: 'B' }));
    const ts2 = store.getTimestamp('foundry:profile')!;
    expect(new Date(ts2).getTime()).toBeGreaterThan(new Date(ts1).getTime());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// remoteIsNewer — timestamp comparison
// ═══════════════════════════════════════════════════════════════════════════

describe('remoteIsNewer', () => {
  it('returns true when remote timestamp is missing (cannot compare, assume remote is authoritative)', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T12:00:00.000Z');
    expect(remoteIsNewer('foundry:profile', undefined)).toBe(true);
  });

  it('returns true when local has no timestamp (first pull)', () => {
    expect(remoteIsNewer('foundry:profile', '2025-06-15T12:00:00.000Z')).toBe(true);
  });

  it('returns true when remote is strictly newer than local', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T12:00:00.000Z');
    expect(remoteIsNewer('foundry:profile', '2025-06-15T13:00:00.000Z')).toBe(true);
  });

  it('returns false when local is strictly newer than remote', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T13:00:00.000Z');
    expect(remoteIsNewer('foundry:profile', '2025-06-15T12:00:00.000Z')).toBe(false);
  });

  it('returns true when timestamps are equal (tie goes to remote for idempotency)', () => {
    const ts = '2025-06-15T12:00:00.000Z';
    store.setFromRemote('foundry:profile', '{}', ts);
    expect(remoteIsNewer('foundry:profile', ts)).toBe(true);
  });

  it('works for workout session keys', () => {
    store.setFromRemote('foundry:day0:week0', '{}', '2025-06-15T12:00:00.000Z');
    expect(remoteIsNewer('foundry:day0:week0', '2025-06-15T11:00:00.000Z')).toBe(false);
    expect(remoteIsNewer('foundry:day0:week0', '2025-06-15T13:00:00.000Z')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// mergeProfile — field-level merge
// ═══════════════════════════════════════════════════════════════════════════

describe('mergeProfile', () => {
  it('returns remote entirely when no local timestamp exists', () => {
    const local = { name: 'Atlas', age: 30 };
    const remote = { name: 'Bob', age: 25, goal: 'cut' };
    const merged = mergeProfile(local, remote, '2025-06-15T12:00:00.000Z');
    expect(merged).toEqual({ name: 'Bob', age: 25, goal: 'cut' });
  });

  it('remote fields overlay local when remote is newer', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T10:00:00.000Z');
    const local = { name: 'Atlas', age: 30, goal: 'bulk' };
    const remote = { name: 'Bob', age: 25 }; // no goal — local keeps its goal
    const merged = mergeProfile(local, remote, '2025-06-15T12:00:00.000Z');
    expect(merged).toEqual({ name: 'Bob', age: 25, goal: 'bulk' });
  });

  it('local fields overlay remote when local is newer', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T12:00:00.000Z');
    const local = { name: 'Atlas', age: 30, goal: 'bulk' };
    const remote = { name: 'Bob', age: 25, goal: 'cut', weight: 180 };
    const merged = mergeProfile(local, remote, '2025-06-15T10:00:00.000Z');
    // Remote-only fields (weight) should still be preserved
    expect(merged).toEqual({ name: 'Atlas', age: 30, goal: 'bulk', weight: 180 });
  });

  it('preserves remote-only fields when local is newer (union of keys)', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T12:00:00.000Z');
    const local = { name: 'Atlas' };
    const remote = { name: 'Bob', age: 25, weight: 180, goal: 'cut' };
    const merged = mergeProfile(local, remote, '2025-06-15T11:00:00.000Z');
    expect(merged.name).toBe('Atlas'); // local wins
    expect(merged.age).toBe(25); // remote-only, preserved
    expect(merged.weight).toBe(180); // remote-only, preserved
    expect(merged.goal).toBe('cut'); // remote-only, preserved
  });

  it('preserves local-only fields when remote is newer (union of keys)', () => {
    store.setFromRemote('foundry:profile', '{}', '2025-06-15T10:00:00.000Z');
    const local = { name: 'Atlas', customField: 'local-only' };
    const remote = { name: 'Bob' };
    const merged = mergeProfile(local, remote, '2025-06-15T12:00:00.000Z');
    expect(merged.name).toBe('Bob'); // remote wins
    expect(merged.customField).toBe('local-only'); // local-only, preserved
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Dirty queue — markDirty / clearDirty / persistence
// ═══════════════════════════════════════════════════════════════════════════

describe('dirty queue', () => {
  it('markDirty adds a key to the queue', () => {
    markDirty('foundry:profile');
    const raw = localStorage.getItem('foundry:sync:dirty');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw!)).toContain('foundry:profile');
  });

  it('markDirty is idempotent (no duplicates)', () => {
    markDirty('foundry:profile');
    markDirty('foundry:profile');
    markDirty('foundry:profile');
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty')!);
    expect(set.filter((k: string) => k === 'foundry:profile').length).toBe(1);
  });

  it('clearDirty removes a key from the queue', () => {
    markDirty('foundry:profile');
    markDirty('foundry:day0:week0');
    clearDirty('foundry:profile');
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty')!);
    expect(set).not.toContain('foundry:profile');
    expect(set).toContain('foundry:day0:week0');
  });

  it('multiple markDirty calls accumulate distinct keys', () => {
    markDirty('foundry:profile');
    markDirty('foundry:day0:week0');
    markDirty('foundry:readiness:2025-06-15');
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty')!);
    expect(set.length).toBe(3);
  });

  it('dirty queue survives page reloads (backed by localStorage)', () => {
    markDirty('foundry:profile');
    // Simulate a reload by re-reading the raw value — it should still be there
    const raw = localStorage.getItem('foundry:sync:dirty');
    expect(JSON.parse(raw!)).toContain('foundry:profile');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// flushDirty — full round-trip with mocked Supabase
// ═══════════════════════════════════════════════════════════════════════════

describe('flushDirty', () => {
  it('returns early when no keys are dirty', async () => {
    await flushDirty();
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('returns early when no user is authenticated', async () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas' }));
    markDirty('foundry:profile');
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await flushDirty();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('clears a dirty profile key after successful upsert', async () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas', experience: 'intermediate' }));
    markDirty('foundry:profile');
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    await flushDirty();

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty') ?? '[]');
    expect(set).not.toContain('foundry:profile');
  });

  it('clears legacy workout jsonb dirty keys without upserting (chunk 4a uses per-set writes)', async () => {
    // Chunk 4a migrated workouts to the normalized schema but the new model
    // uses per-set upserts fired directly from DayView (not via flushDirty).
    // The legacy foundry:day{d}:week{w} jsonb keys are no longer the source
    // of truth for remote writes, so flushDirty should clear them without
    // attempting any upsert.
    const workoutData = { 0: { 0: { weight: '100', reps: '8' } } };
    localStorage.setItem('foundry:day2:week3', JSON.stringify(workoutData));
    markDirty('foundry:day2:week3');
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    await flushDirty();

    expect(mockUpsert).not.toHaveBeenCalled();
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty') ?? '[]');
    expect(set).not.toContain('foundry:day2:week3'); // cleared as a no-op
  });

  it('retains a dirty key when all 3 upsert attempts fail', async () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas', experience: 'intermediate' }));
    markDirty('foundry:profile');
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockRejectedValue(new Error('Network error'));

    await flushDirty();

    // 3 retry attempts
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty') ?? '[]');
    expect(set).toContain('foundry:profile'); // still dirty for next flush
  });

  it('succeeds on the second retry after a transient failure', async () => {
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas', experience: 'intermediate' }));
    markDirty('foundry:profile');
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert
      .mockRejectedValueOnce(new Error('Transient'))
      .mockResolvedValueOnce({ error: null });

    await flushDirty();

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty') ?? '[]');
    expect(set).not.toContain('foundry:profile');
  });

  it('flushes migrated keys and handles chunk-specific behavior in one pass', async () => {
    // After chunks 1-5 (except 5d notes):
    //   - profile (chunk 1) → flushes via upsert
    //   - workout jsonb legacy keys (chunk 4a moved to per-set writes) →
    //     cleared as no-op since they're no longer the source of truth
    //   - readiness (chunk 5b) → flushes via upsert to readiness_checkins
    localStorage.setItem('foundry:profile', JSON.stringify({ name: 'Atlas', experience: 'intermediate' }));
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: { weight: '100', reps: '8' } } }));
    localStorage.setItem('foundry:readiness:2025-06-15', JSON.stringify({ sleep: 'good', soreness: 'low', energy: 'high' }));
    markDirty('foundry:profile');
    markDirty('foundry:day0:week0');
    markDirty('foundry:readiness:2025-06-15');
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    await flushDirty();

    // profile + readiness both upsert; workout is a no-op
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty') ?? '[]');
    expect(set).not.toContain('foundry:profile'); // cleared via upsert
    expect(set).not.toContain('foundry:day0:week0'); // cleared as no-op (chunk 4a)
    expect(set).not.toContain('foundry:readiness:2025-06-15'); // cleared via upsert (chunk 5b)
  });

  it('clears a dirty key whose value was deleted from localStorage (orphan cleanup)', async () => {
    markDirty('foundry:profile');
    // Do NOT set foundry:profile in localStorage — simulates a deleted record
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });

    await flushDirty();

    // Orphaned dirty key should be cleared without calling upsert
    expect(mockUpsert).not.toHaveBeenCalled();
    const set = JSON.parse(localStorage.getItem('foundry:sync:dirty') ?? '[]');
    expect(set).not.toContain('foundry:profile');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// syncMesocycleToSupabase — chunk 2
// ═══════════════════════════════════════════════════════════════════════════

describe('syncMesocycleToSupabase (chunk 2)', () => {
  it('no-ops when the profile lacks mesoLength', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    await syncMesocycleToSupabase({ name: 'Atlas', experience: 'intermediate' } as unknown as Profile);

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('no-ops when the profile lacks splitType', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    await syncMesocycleToSupabase({ name: 'Atlas', mesoLength: 6 } as unknown as Profile);

    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('upserts a mesocycle row with mapped fields when profile has full meso config', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    const profile = {
      name: 'Atlas',
      experience: 'intermediate',
      splitType: 'ppl',
      mesoLength: 6,
      daysPerWeek: 3,
      startDate: '2026-04-01',
    } as unknown as Profile;

    await syncMesocycleToSupabase(profile);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const call = mockUpsert.mock.calls[0][0];
    expect(call.user_id).toBe('user-123');
    expect(call.weeks_count).toBe(6);
    expect(call.days_per_week).toBe(3);
    expect(call.split_type).toBe('PPL'); // uppercased enum
    expect(call.status).toBe('active');
    expect(call.started_at).toBe('2026-04-01');
    expect(call.id).toMatch(/^[0-9a-f-]{36}$/); // UUID
    expect(call.name).toContain('6 Week PPL');
  });

  it('reuses the same meso id across multiple saves (idempotent upsert)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpsert.mockResolvedValue({ error: null });

    const profile = {
      name: 'Atlas',
      experience: 'intermediate',
      splitType: 'ppl',
      mesoLength: 6,
      daysPerWeek: 3,
      startDate: '2026-04-01',
    } as unknown as Profile;

    await syncMesocycleToSupabase(profile);
    const firstId = mockUpsert.mock.calls[0][0].id;

    await syncMesocycleToSupabase(profile);
    const secondId = mockUpsert.mock.calls[1][0].id;

    expect(firstId).toBe(secondId);
    expect(localStorage.getItem('foundry:active_meso_id')).toBe(firstId);
  });
});
