/**
 * Planning the next meso during the deload, and starting it.
 *
 * The hazard is in the start: the draft becomes the live profile while the
 * finished meso is still being retired remotely. saveProfile only mints a
 * fresh meso id when foundry:active_meso_id is gone, and detach is what
 * removes it — save first and the new meso upserts INTO the finished one's
 * row and flips it back to 'active'. These tests hold the detach open and
 * check nothing is saved until it lands.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const calls: string[] = [];
let releaseDetach: () => void = () => {};
const mesoIdAtSync: (string | null)[] = [];

vi.mock('../sync', () => ({
  archiveMesocycleRemote: vi.fn(async () => {}),
  completeMesocycleRemote: vi.fn(async () => {
    calls.push('complete');
  }),
  detachActiveMesoRemote: vi.fn(
    () =>
      new Promise<void>((resolve) => {
        calls.push('detach:start');
        releaseDetach = () => {
          localStorage.removeItem('foundry:active_meso_id');
          calls.push('detach:done');
          resolve();
        };
      }),
  ),
  syncMesocycleToSupabase: vi.fn(async () => {
    calls.push('saveProfile');
    mesoIdAtSync.push(localStorage.getItem('foundry:active_meso_id'));
  }),
  syncProfileToSupabase: vi.fn(async () => {}),
  ensureTrainingStructureRemote: vi.fn(async () => {}),
  syncBodyWeightToSupabase: vi.fn(async () => {}),
  syncCardioPresetToSupabase: vi.fn(async () => {}),
  deleteCardioPresetRemote: vi.fn(async () => {}),
  syncSetCountToSupabase: vi.fn(async () => {}),
  deleteSetCountRemote: vi.fn(async () => {}),
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));

import {
  loadNextMesoDraft,
  saveNextMesoDraft,
  startPlannedMeso,
  isPlanningWindow,
  trainedIdsIncludingCurrent,
} from '../nextMeso';
import { wipeMesoSessionData } from '../storage';
import { resetMesoCache } from '../../data/constants';
import type { Profile, TrainingDay } from '../../types';

const current = {
  name: 'J', experience: 'experienced', splitType: 'full_body', daysPerWeek: 4, workoutDays: [1, 2, 4, 5],
  mesoLength: 5, startDate: '2026-08-10',
} as unknown as Profile;

const nextProfile = {
  name: 'J', splitType: 'upper_lower', daysPerWeek: 4, workoutDays: [1, 2, 4, 5],
  mesoLength: 4, startDate: '2026-09-01',
} as unknown as Profile;

const program = [
  { name: 'Upper A', tag: 'UPPER', exercises: [{ id: 'bench', name: 'Bench', sets: 3, reps: '6-8', muscle: 'chest' }] },
  { name: 'Lower A', tag: 'LOWER', exercises: [{ id: 'squat', name: 'Squat', sets: 3, reps: '5-7', muscle: 'quads' }] },
] as unknown as TrainingDay[];

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  mesoIdAtSync.length = 0;
  resetMesoCache();
});

describe('the draft', () => {
  it('round-trips the profile AND the concrete program', () => {
    saveNextMesoDraft(nextProfile, program);
    const d = loadNextMesoDraft();
    expect(d?.profile.splitType).toBe('upper_lower');
    expect(d?.program).toEqual(program);
  });

  it('ignores a draft with no program — there would be nothing to start', () => {
    localStorage.setItem('foundry:next_meso_draft', JSON.stringify({ v: 1, profile: nextProfile, program: [] }));
    expect(loadNextMesoDraft()).toBeNull();
  });

  it('is dropped whenever the meso ends some other way', () => {
    saveNextMesoDraft(nextProfile, program);
    wipeMesoSessionData();
    expect(loadNextMesoDraft()).toBeNull();
  });
});

describe('the planning window', () => {
  it('opens on the deload week and stays open after it', () => {
    localStorage.setItem('foundry:profile', JSON.stringify(current)); // 5 weeks + deload
    resetMesoCache();
    expect(isPlanningWindow(4)).toBe(false); // last working week
    expect(isPlanningWindow(5)).toBe(true); // deload
    expect(isPlanningWindow(6)).toBe(true); // all done
  });
});

describe('trained ids include the meso still in progress', () => {
  it('sees lifts logged this meso, before anything is archived', () => {
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '200', reps: '5', confirmed: true, _exId: 'deadlift' } } }),
    );
    expect(trainedIdsIncludingCurrent(current).has('deadlift')).toBe(true);
  });
});

describe('startPlannedMeso', () => {
  const seedLiveMeso = () => {
    localStorage.setItem('foundry:profile', JSON.stringify(current));
    localStorage.setItem('foundry:active_meso_id', 'old-meso');
    localStorage.setItem('foundry:storedProgram', JSON.stringify([{ name: 'OLD', exercises: [] }]));
    localStorage.setItem('foundry:done:d0:w5', '1');
    localStorage.setItem(
      'foundry:day0:week5',
      JSON.stringify({ 0: { 0: { weight: '150', reps: '5', _exId: 'deadlift' } } }),
    );
    localStorage.setItem('foundry:currentWeek', '5');
    saveNextMesoDraft(nextProfile, program);
  };

  it('does nothing without a draft', async () => {
    localStorage.setItem('foundry:profile', JSON.stringify(current));
    expect(await startPlannedMeso(current)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('does not save the new profile until the old meso is detached', async () => {
    seedLiveMeso();
    const p = startPlannedMeso(current);
    await vi.waitFor(() => expect(calls).toContain('detach:start'));
    expect(calls).not.toContain('saveProfile');

    releaseDetach();
    await p;
    expect(calls).toEqual(['complete', 'detach:start', 'detach:done', 'saveProfile']);
    // The new meso synced with no inherited id — it will mint its own.
    expect(mesoIdAtSync).toEqual([null]);
  });

  it('archives the finished meso, wipes its sessions, and installs the draft as reviewed', async () => {
    seedLiveMeso();
    const p = startPlannedMeso(current);
    await vi.waitFor(() => expect(calls).toContain('detach:start'));
    releaseDetach();
    const next = await p;

    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive).toHaveLength(1);
    expect(archive[0].profile.splitType).toBe('full_body');

    expect(localStorage.getItem('foundry:done:d0:w5')).toBeNull();
    expect(localStorage.getItem('foundry:day0:week5')).toBeNull();
    expect(localStorage.getItem('foundry:currentWeek')).toBe('0');

    // The exact program that was previewed — not a fresh (shuffled) one.
    expect(JSON.parse(localStorage.getItem('foundry:storedProgram')!)).toEqual(program);
    expect(JSON.parse(localStorage.getItem('foundry:profile')!).splitType).toBe('upper_lower');
    // Starts today, not on the day it was planned.
    expect(next?.startDate).not.toBe('2026-09-01');
    // A draft built without experience must not produce a profile the app
    // rejects (validateProfile → null → the empty shell).
    expect(next?.experience).toBeTruthy();
    expect(loadNextMesoDraft()).toBeNull();
  });
});
