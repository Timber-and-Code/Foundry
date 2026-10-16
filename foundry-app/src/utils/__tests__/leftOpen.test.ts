/**
 * Left-open sessions — the rule for a workout that was started, worked and
 * never finished. See utils/leftOpen.ts for the rule itself.
 *
 * The scenario throughout: Full Body C started Thursday 10:23, last set
 * logged Thursday 11:04, never finished. The lifter opens the app Monday.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsertSession, mockSyncSkipped, mockLogHealth, mockEmit } = vi.hoisted(() => ({
  mockUpsertSession: vi.fn((): Promise<void> => Promise.resolve()),
  mockSyncSkipped: vi.fn((): Promise<void> => Promise.resolve()),
  mockLogHealth: vi.fn((): Promise<boolean> => Promise.resolve(true)),
  mockEmit: vi.fn(),
}));

vi.mock('../sync', () => ({
  upsertWorkoutSessionRemote: mockUpsertSession,
  syncSkippedToSupabase: mockSyncSkipped,
  getOrCreateWorkoutSessionId: () => 'session-uuid',
  syncProfileToSupabase: vi.fn(),
  syncBodyWeightToSupabase: vi.fn(),
  syncMesocycleToSupabase: vi.fn(),
  ensureTrainingStructureRemote: vi.fn(),
}));
vi.mock('../health/logWorkoutToHealth', () => ({ logWorkoutToHealth: mockLogHealth }));
vi.mock('../events', () => ({ emit: mockEmit, on: vi.fn(() => () => {}) }));

import {
  isLeftOpen,
  trainedAtFor,
  noteLeftOpen,
  findLeftOpenSessions,
  completeLeftOpenSession,
  leftOpenKey,
} from '../leftOpen';
import { isSkipped, setSkipped, sessionHasLoggedWork, markComplete } from '../training';
import type { TrainingDay } from '../../types';

const THU_START = new Date(2026, 9, 1, 10, 23).getTime(); // Oct 1 10:23 local
const THU_LAST_SET = new Date(2026, 9, 1, 11, 4, 43).getTime();
const MON = new Date(2026, 9, 5, 10, 45).getTime(); // Oct 5 10:45 local

const DAYS: TrainingDay[] = [
  { label: 'Full Body A', tag: 'FULL', exercises: [{ name: 'Squat', muscle: 'quads', sets: 3 }] },
  { label: 'Full Body B', tag: 'FULL', exercises: [{ name: 'Bench', muscle: 'chest', sets: 3 }] },
  {
    label: 'Full Body C',
    tag: 'FULL',
    exercises: [
      { name: 'KB Swing', muscle: 'glutes', sets: 3 },
      { name: 'Hammer Curl', muscle: 'biceps', sets: 2 },
    ],
  },
] as TrainingDay[];

function seedThursdayC(opts: { sets?: Record<string, Record<string, unknown>> } = {}) {
  localStorage.setItem('foundry:sessionStart:d2:w1', String(THU_START));
  const data = opts.sets ?? {
    0: {
      0: { weight: 50, reps: 13, confirmed: true },
      1: { weight: 50, reps: 13, confirmed: true },
      2: { weight: 50, reps: 13, confirmed: true },
    },
    1: { 0: { weight: 40, reps: 12, confirmed: true } },
  };
  localStorage.setItem('foundry:day2:week1', JSON.stringify(data));
  localStorage.setItem('foundry:ts:foundry:day2:week1', new Date(THU_LAST_SET).toISOString());
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe('isLeftOpen', () => {
  it('is true for a session started on an earlier local day and not done', () => {
    seedThursdayC();
    expect(isLeftOpen(2, 1, MON)).toBe(true);
  });

  it('is false on the day it was started — that is in progress, not left open', () => {
    seedThursdayC();
    expect(isLeftOpen(2, 1, new Date(2026, 9, 1, 23, 59).getTime())).toBe(false);
  });

  it('flips at local midnight, not 24 hours later', () => {
    localStorage.setItem('foundry:sessionStart:d0:w0', String(new Date(2026, 9, 1, 23, 50).getTime()));
    expect(isLeftOpen(0, 0, new Date(2026, 9, 2, 0, 5).getTime())).toBe(true);
  });

  it('is false once the session is done, and when it was never started', () => {
    seedThursdayC();
    localStorage.setItem('foundry:done:d2:w1', '1');
    expect(isLeftOpen(2, 1, MON)).toBe(false);
    expect(isLeftOpen(0, 1, MON)).toBe(false);
  });

  it('ignores the skip flag — a skipped session with a start is still left open', () => {
    seedThursdayC();
    localStorage.setItem('foundry:skip:d2:w1', '1');
    expect(isLeftOpen(2, 1, MON)).toBe(true);
  });
});

describe('trainedAtFor / noteLeftOpen', () => {
  it('dates the training at the last write on the start day', () => {
    seedThursdayC();
    expect(trainedAtFor(2, 1)?.getTime()).toBe(THU_LAST_SET);
  });

  it('falls back to the start when the day data was touched on another day', () => {
    seedThursdayC();
    localStorage.setItem('foundry:ts:foundry:day2:week1', new Date(MON).toISOString());
    expect(trainedAtFor(2, 1)?.getTime()).toBe(THU_START);
  });

  it('stamps once and never moves', () => {
    seedThursdayC();
    const first = noteLeftOpen(2, 1, MON);
    expect(first).toBe(new Date(THU_LAST_SET).toISOString());
    // A confirm today bumps the day timestamp — the stamp must not follow.
    localStorage.setItem('foundry:ts:foundry:day2:week1', new Date(MON).toISOString());
    expect(noteLeftOpen(2, 1, MON)).toBe(first);
    expect(localStorage.getItem(leftOpenKey(2, 1))).toBe(first);
  });

  it('does not stamp a same-day session', () => {
    seedThursdayC();
    expect(noteLeftOpen(2, 1, THU_LAST_SET + 60_000)).toBeNull();
    expect(localStorage.getItem(leftOpenKey(2, 1))).toBeNull();
  });
});

describe('findLeftOpenSessions', () => {
  it('returns the Thursday session with its logged-set count and prescription', () => {
    seedThursdayC();
    const found = findLeftOpenSessions(DAYS, 8, MON);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      dayIdx: 2,
      weekIdx: 1,
      startedAt: THU_START,
      trainedAt: new Date(THU_LAST_SET).toISOString(),
      setsDone: 4,
      label: 'Full Body C',
    });
    // Week index 1 is an Accumulation week: the program's 3 + 2 sets.
    expect(found[0].totalSets).toBe(5);
  });

  it('drops an accidental start that logged nothing — nothing happened', () => {
    localStorage.setItem('foundry:sessionStart:d0:w1', String(THU_START));
    localStorage.setItem('foundry:strengthEnd:d0:w1', String(THU_START + 1000));
    expect(findLeftOpenSessions(DAYS, 8, MON)).toEqual([]);
    expect(localStorage.getItem('foundry:sessionStart:d0:w1')).toBeNull();
    expect(localStorage.getItem('foundry:strengthEnd:d0:w1')).toBeNull();
  });

  it('a session with only suggested (unconfirmed, no reps) sets is an accidental start', () => {
    seedThursdayC({ sets: { 0: { 0: { weight: 50, reps: '', suggested: true } } } });
    expect(findLeftOpenSessions(DAYS, 8, MON)).toEqual([]);
    expect(localStorage.getItem('foundry:sessionStart:d2:w1')).toBeNull();
  });

  it('unskips a session that is both skipped and full of work, locally and remotely', () => {
    seedThursdayC();
    localStorage.setItem('foundry:skip:d2:w1', '1');
    const found = findLeftOpenSessions(DAYS, 8, MON);
    expect(found).toHaveLength(1);
    expect(isSkipped(2, 1)).toBe(false);
    expect(mockSyncSkipped).toHaveBeenCalledWith(2, 1, false);
  });

  it('leaves a same-day in-progress session alone', () => {
    seedThursdayC();
    expect(findLeftOpenSessions(DAYS, 8, THU_LAST_SET + 60_000)).toEqual([]);
    expect(localStorage.getItem('foundry:sessionStart:d2:w1')).toBe(String(THU_START));
  });
});

describe('completeLeftOpenSession', () => {
  it('marks the session done, dated Thursday, and echoes the real times to Supabase', () => {
    seedThursdayC();
    findLeftOpenSessions(DAYS, 8, MON); // stamps trainedAt, as Home would
    completeLeftOpenSession(2, 1, 'Full Body C');

    expect(localStorage.getItem('foundry:done:d2:w1')).toBe('1');
    expect(localStorage.getItem('foundry:completedDate:d2:w1')).toBe('2026-10-01');
    expect(localStorage.getItem('foundry:completedAt:d2:w1')).toBe(new Date(THU_LAST_SET).toISOString());
    expect(localStorage.getItem('foundry:strengthEnd:d2:w1')).toBe(String(THU_LAST_SET));
    expect(localStorage.getItem(leftOpenKey(2, 1))).toBeNull();

    expect(mockUpsertSession).toHaveBeenCalledWith(2, 1, {
      sessionId: 'session-uuid',
      startedAt: new Date(THU_START).toISOString(),
      completedAt: new Date(THU_LAST_SET).toISOString(),
      isComplete: true,
      skipped: false,
    });
    expect(mockLogHealth).toHaveBeenCalledWith(
      expect.objectContaining({
        startMs: THU_START,
        endMs: THU_LAST_SET,
        dayIdx: 2,
        weekIdx: 1,
        dayLabel: 'Full Body C',
        totalSets: 4,
        totalVolumeLbs: 50 * 13 * 3 + 40 * 12,
      }),
    );
    expect(mockEmit).toHaveBeenCalledWith('foundry:session-completed', { dayIdx: 2, weekIdx: 1 });
  });

  it('works without a prior stamp (direct from the Schedule sheet) and clears a skip', () => {
    seedThursdayC();
    localStorage.setItem('foundry:skip:d2:w1', '1');
    completeLeftOpenSession(2, 1);
    expect(isSkipped(2, 1)).toBe(false);
    expect(localStorage.getItem('foundry:completedDate:d2:w1')).toBe('2026-10-01');
  });

  it('dates a same-day session at its last logged write', () => {
    seedThursdayC();
    completeLeftOpenSession(2, 1);
    expect(localStorage.getItem('foundry:completedAt:d2:w1')).toBe(new Date(THU_LAST_SET).toISOString());
  });
});

describe('the skip rule', () => {
  it('sessionHasLoggedWork sees confirmed sets only — not warmups, blanks, or unticked rows', () => {
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: 135, reps: 5, warmup: true, confirmed: true }, 1: { weight: '', reps: '' } } }),
    );
    expect(sessionHasLoggedWork(0, 0)).toBe(false);
    // A carry-over suggestion or a typed-but-unticked row has numbers but
    // is not work (see utils/loggedSet).
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: 135, reps: 5, repsSuggested: true }, 1: { weight: 140, reps: 6 } } }),
    );
    expect(sessionHasLoggedWork(0, 0)).toBe(false);
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: 135, reps: 5, confirmed: true } } }),
    );
    expect(sessionHasLoggedWork(0, 0)).toBe(true);
    localStorage.setItem(
      'foundry:day0:week0',
      JSON.stringify({ 0: { 0: { weight: '', reps: '', confirmed: true } } }),
    );
    expect(sessionHasLoggedWork(0, 0)).toBe(true);
  });

  it('setSkipped refuses a session with logged work and says so', () => {
    seedThursdayC();
    expect(setSkipped(2, 1, true)).toBe(false);
    expect(isSkipped(2, 1)).toBe(false);
    expect(setSkipped(0, 1, true)).toBe(true);
    expect(isSkipped(0, 1)).toBe(true);
    expect(setSkipped(0, 1, false)).toBe(true);
    expect(isSkipped(0, 1)).toBe(false);
  });
});

describe('markComplete dating', () => {
  it('keeps an existing completion stamp when called without a date', () => {
    const at = new Date(THU_LAST_SET);
    markComplete(2, 1, at);
    expect(localStorage.getItem('foundry:completedDate:d2:w1')).toBe('2026-10-01');
    // The App-level handler runs after the flow has dated the session.
    markComplete(2, 1);
    expect(localStorage.getItem('foundry:completedAt:d2:w1')).toBe(at.toISOString());
    expect(localStorage.getItem('foundry:completedDate:d2:w1')).toBe('2026-10-01');
  });

  it('dates a first-time call without a date at now', () => {
    const before = Date.now();
    markComplete(0, 0);
    const stamped = Date.parse(localStorage.getItem('foundry:completedAt:d0:w0')!);
    expect(stamped).toBeGreaterThanOrEqual(before);
  });
});
