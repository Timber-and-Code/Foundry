/**
 * Tests for resumption.ts — return-after-layoff UX.
 *
 * Covers:
 *   - detectResumptionGap
 *       null when no completion exists
 *       null when gap < 7 days
 *       correct gap at 7 / 14 / 21 days
 *       last-day label derives from program.tag / .label / .name
 *   - applyResumptionChoice for each of the 4 choices
 *       startDate shift
 *       completedDays mutation
 *       currentWeek
 *       recalibrate flag key + value
 *       repeat_last_week archive preservation
 *       restart_meso archive flag
 *   - isResumptionHandled / markResumptionHandled one-shot per gap
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Profile, TrainingDay } from '../../types';
import {
  detectResumptionGap,
  applyResumptionChoice,
  isResumptionHandled,
  markResumptionHandled,
} from '../resumption';

// ─── Test helpers ───────────────────────────────────────────────────────────

function isoNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayISO(): string {
  return isoNDaysAgo(0);
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    experience: 'intermediate',
    startDate: '2026-05-01',
    workoutDays: [1, 3, 5],
    daysPerWeek: 3,
    mesoLength: 6,
    ...overrides,
  } as Profile;
}

function makeProgram(): TrainingDay[] {
  return [
    { tag: 'PUSH', name: 'Push A', exercises: [] },
    { tag: 'PULL', name: 'Pull A', exercises: [] },
    { tag: 'LEGS', name: 'Leg A', exercises: [] },
  ];
}

function seedCompletion(dayIdx: number, weekIdx: number, isoDate: string): void {
  localStorage.setItem(`foundry:completedDate:d${dayIdx}:w${weekIdx}`, isoDate);
}

function mkCtx(profile: Profile, completed: Set<string>, currentWeek: number) {
  let p = profile;
  let c = completed;
  let w = currentWeek;
  return {
    profile: p,
    completedDays: c,
    currentWeek: w,
    setProfile: vi.fn((next: Profile) => {
      p = next;
    }),
    setCompletedDays: vi.fn((next: Set<string>) => {
      c = next;
    }),
    setCurrentWeek: vi.fn((next: number) => {
      w = next;
    }),
    // Test access to mutated state
    get current() {
      return { profile: p, completedDays: c, currentWeek: w };
    },
  };
}

// ─── detectResumptionGap ────────────────────────────────────────────────────

describe('detectResumptionGap', () => {
  beforeEach(() => localStorage.clear());

  it('returns null when no completion exists', () => {
    const profile = makeProfile();
    expect(detectResumptionGap(new Set(), profile, makeProgram())).toBeNull();
  });

  it('returns null when profile is null', () => {
    const completed = new Set(['0:0']);
    seedCompletion(0, 0, isoNDaysAgo(30));
    expect(detectResumptionGap(completed, null, makeProgram())).toBeNull();
  });

  it('returns null when gap is < 7 days', () => {
    seedCompletion(0, 0, isoNDaysAgo(3));
    const out = detectResumptionGap(new Set(['0:0']), makeProfile(), makeProgram());
    expect(out).toBeNull();
  });

  it('returns null when gap is exactly 6 days', () => {
    seedCompletion(0, 0, isoNDaysAgo(6));
    expect(detectResumptionGap(new Set(['0:0']), makeProfile(), makeProgram())).toBeNull();
  });

  it('returns a gap of 7 at exactly 7 days', () => {
    seedCompletion(0, 0, isoNDaysAgo(7));
    const out = detectResumptionGap(new Set(['0:0']), makeProfile(), makeProgram());
    expect(out).not.toBeNull();
    expect(out!.gapDays).toBe(7);
  });

  it('returns the correct gap at 14 days', () => {
    seedCompletion(1, 0, isoNDaysAgo(14));
    const out = detectResumptionGap(new Set(['1:0']), makeProfile(), makeProgram());
    expect(out!.gapDays).toBe(14);
    expect(out!.lastCompletedDateISO).toBe(isoNDaysAgo(14));
  });

  it('returns the correct gap at 21 days', () => {
    seedCompletion(2, 1, isoNDaysAgo(21));
    const out = detectResumptionGap(new Set(['2:1']), makeProfile(), makeProgram());
    expect(out!.gapDays).toBe(21);
  });

  it('picks the most recent completion when several exist', () => {
    seedCompletion(0, 0, isoNDaysAgo(30));
    seedCompletion(1, 0, isoNDaysAgo(10));
    seedCompletion(2, 0, isoNDaysAgo(20));
    const out = detectResumptionGap(
      new Set(['0:0', '1:0', '2:0']),
      makeProfile(),
      makeProgram(),
    );
    expect(out!.gapDays).toBe(10);
    expect(out!.lastDayIdx).toBe(1);
  });

  it('derives lastDayLabel from program tag (PUSH → "Push Day")', () => {
    seedCompletion(0, 0, isoNDaysAgo(12));
    const out = detectResumptionGap(new Set(['0:0']), makeProfile(), makeProgram());
    expect(out!.lastDayLabel).toBe('Push Day');
  });

  it('derives lastDayLabel from program label when present', () => {
    seedCompletion(0, 0, isoNDaysAgo(12));
    const program: TrainingDay[] = [{ label: 'Push A', exercises: [] }];
    const out = detectResumptionGap(new Set(['0:0']), makeProfile(), program);
    expect(out!.lastDayLabel).toBe('Push A');
  });

  it('falls back to "Day N" when program slot is missing', () => {
    seedCompletion(5, 0, isoNDaysAgo(12));
    const out = detectResumptionGap(new Set(['5:0']), makeProfile(), []);
    expect(out!.lastDayLabel).toBe('Day 6');
  });

  it('ignores completed entries without a completedDate timestamp', () => {
    // 0:0 has no timestamp, 1:0 does — should fall back to 1:0.
    seedCompletion(1, 0, isoNDaysAgo(12));
    const out = detectResumptionGap(
      new Set(['0:0', '1:0']),
      makeProfile(),
      makeProgram(),
    );
    expect(out!.lastDayIdx).toBe(1);
  });
});

// ─── applyResumptionChoice ──────────────────────────────────────────────────

describe('applyResumptionChoice', () => {
  beforeEach(() => localStorage.clear());

  it('pick_up: shifts startDate by gapDays, leaves everything else alone', () => {
    const profile = makeProfile({ startDate: '2026-05-01' });
    const completed = new Set(['0:0', '1:0']);
    const ctx = mkCtx(profile, completed, 1);
    const gap = { gapDays: 10, lastCompletedDateISO: isoNDaysAgo(10), lastDayLabel: 'Push', lastDayIdx: 1, lastWeekIdx: 0 };

    const result = applyResumptionChoice('pick_up', gap, ctx);

    expect(result.startDateShifted).toBe(10);
    expect(result.completedWiped).toBe(0);
    expect(result.archived).toBe(false);
    // 2026-05-01 + 10 days = 2026-05-11
    expect(ctx.setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-05-11' }),
    );
    expect(ctx.setCompletedDays).not.toHaveBeenCalled();
    expect(ctx.setCurrentWeek).not.toHaveBeenCalled();
  });

  it('recalibrate: shifts startDate by gapDays, sets reentry_deload flag for currentWeek', () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-abc');
    const profile = makeProfile({ startDate: '2026-05-01' });
    const completed = new Set(['0:0', '1:0', '2:0']);
    const ctx = mkCtx(profile, completed, 1);
    const gap = { gapDays: 14, lastCompletedDateISO: isoNDaysAgo(14), lastDayLabel: 'Pull', lastDayIdx: 1, lastWeekIdx: 0 };

    const result = applyResumptionChoice('recalibrate', gap, ctx);

    expect(result.startDateShifted).toBe(14);
    expect(result.completedWiped).toBe(0);
    expect(result.archived).toBe(false);
    expect(ctx.setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-05-15' }),
    );
    // Flag should be set for the current active week (1 in this ctx).
    expect(localStorage.getItem('foundry:reentry_deload:meso-abc:1')).toBe('1');
    expect(ctx.setCompletedDays).not.toHaveBeenCalled();
    expect(ctx.setCurrentWeek).not.toHaveBeenCalled();
  });

  it('recalibrate: uses lastWeekIdx + 1 when ahead of currentWeek', () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-xyz');
    const profile = makeProfile({ startDate: '2026-05-01' });
    const ctx = mkCtx(profile, new Set(), 0);
    const gap = { gapDays: 10, lastCompletedDateISO: isoNDaysAgo(10), lastDayLabel: 'Push', lastDayIdx: 0, lastWeekIdx: 2 };

    applyResumptionChoice('recalibrate', gap, ctx);

    expect(localStorage.getItem('foundry:reentry_deload:meso-xyz:3')).toBe('1');
  });

  it('repeat_last_week: shifts startDate by gapDays + 7, wipes lastWeekIdx, sets currentWeek=lastWeekIdx', () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-r1');
    const profile = makeProfile({ startDate: '2026-05-01' });
    const completed = new Set(['0:0', '1:0', '2:0', '0:1']);
    const ctx = mkCtx(profile, completed, 2);
    const gap = { gapDays: 9, lastCompletedDateISO: isoNDaysAgo(9), lastDayLabel: 'Push', lastDayIdx: 0, lastWeekIdx: 1 };

    // Seed week-1 day data so archive verification can find it.
    localStorage.setItem('foundry:day0:week1', JSON.stringify({ 0: { 0: { weight: '100', reps: '8' } } }));
    localStorage.setItem('foundry:done:d0:w1', '1');

    const result = applyResumptionChoice('repeat_last_week', gap, ctx);

    expect(result.startDateShifted).toBe(16); // 9 + 7
    // 2026-05-01 + 16 days = 2026-05-17
    expect(ctx.setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2026-05-17' }),
    );
    // Only week 1 wiped from completedDays (one entry).
    expect(result.completedWiped).toBe(1);
    expect(ctx.setCompletedDays).toHaveBeenCalled();
    const newCompleted = ctx.setCompletedDays.mock.calls[0][0] as Set<string>;
    expect(newCompleted.has('0:1')).toBe(false);
    expect(newCompleted.has('0:0')).toBe(true);
    expect(ctx.setCurrentWeek).toHaveBeenCalledWith(1);

    // Day data + done marker wiped.
    expect(localStorage.getItem('foundry:day0:week1')).toBeNull();
    expect(localStorage.getItem('foundry:done:d0:w1')).toBeNull();
  });

  it('repeat_last_week: archives day data under foundry:resumption_archive:repeat:{mesoId}:{lastWk} BEFORE wiping', () => {
    localStorage.setItem('foundry:active_meso_id', 'meso-r2');
    const dayPayload = { 0: { 0: { weight: '135', reps: '10' } } };
    localStorage.setItem('foundry:day0:week2', JSON.stringify(dayPayload));
    localStorage.setItem('foundry:day1:week2', JSON.stringify({ 0: { 0: { weight: '80', reps: '12' } } }));

    const profile = makeProfile();
    const ctx = mkCtx(profile, new Set(['0:2', '1:2']), 3);
    const gap = { gapDays: 8, lastCompletedDateISO: isoNDaysAgo(8), lastDayLabel: 'Push', lastDayIdx: 1, lastWeekIdx: 2 };

    applyResumptionChoice('repeat_last_week', gap, ctx);

    const archiveRaw = localStorage.getItem('foundry:resumption_archive:repeat:meso-r2:2');
    expect(archiveRaw).not.toBeNull();
    const archive = JSON.parse(archiveRaw!);
    expect(archive.week).toBe(2);
    expect(archive.days['0']).toBe(JSON.stringify(dayPayload));
    expect(archive.days['1']).toBeDefined();
  });

  it('restart_meso: startDate = today, wipes all completedDays, currentWeek = 0, archives', () => {
    const profile = makeProfile({ startDate: '2026-05-01' });
    localStorage.setItem('foundry:profile', JSON.stringify(profile));
    const completed = new Set(['0:0', '1:0', '0:1']);
    localStorage.setItem('foundry:day0:week0', JSON.stringify({ 0: { 0: { weight: '100', reps: '8' } } }));
    localStorage.setItem('foundry:done:d0:w0', '1');
    const ctx = mkCtx(profile, completed, 2);
    const gap = { gapDays: 25, lastCompletedDateISO: isoNDaysAgo(25), lastDayLabel: 'Push', lastDayIdx: 0, lastWeekIdx: 1 };

    const result = applyResumptionChoice('restart_meso', gap, ctx);

    expect(result.archived).toBe(true);
    expect(result.completedWiped).toBe(3);
    expect(ctx.setProfile).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: todayISO() }),
    );
    expect(ctx.setCompletedDays).toHaveBeenCalledWith(new Set());
    // Weeks are 0-indexed — "start over from week 1" is index 0, persisted
    // so a reload doesn't re-hydrate the stale week.
    expect(ctx.setCurrentWeek).toHaveBeenCalledWith(0);
    expect(localStorage.getItem('foundry:currentWeek')).toBe('0');
    expect(localStorage.getItem('foundry:day0:week0')).toBeNull();
    expect(localStorage.getItem('foundry:done:d0:w0')).toBeNull();
    // archiveCurrentMeso wrote to foundry:archive.
    const archive = JSON.parse(localStorage.getItem('foundry:archive') || '[]');
    expect(archive.length).toBeGreaterThan(0);
  });
});

// ─── isResumptionHandled / markResumptionHandled ────────────────────────────

describe('isResumptionHandled / markResumptionHandled', () => {
  beforeEach(() => localStorage.clear());

  it('isResumptionHandled returns false before mark', () => {
    const gap = { gapDays: 10, lastCompletedDateISO: '2026-05-01', lastDayLabel: 'X', lastDayIdx: 0, lastWeekIdx: 0 };
    expect(isResumptionHandled(gap)).toBe(false);
  });

  it('returns true after mark for the same gap', () => {
    const gap = { gapDays: 10, lastCompletedDateISO: '2026-05-01', lastDayLabel: 'X', lastDayIdx: 0, lastWeekIdx: 0 };
    markResumptionHandled(gap);
    expect(isResumptionHandled(gap)).toBe(true);
  });

  it('returns false for a new gap with a different lastCompletedDateISO', () => {
    const oldGap = { gapDays: 10, lastCompletedDateISO: '2026-05-01', lastDayLabel: 'X', lastDayIdx: 0, lastWeekIdx: 0 };
    markResumptionHandled(oldGap);
    const newGap = { gapDays: 14, lastCompletedDateISO: '2026-06-15', lastDayLabel: 'X', lastDayIdx: 0, lastWeekIdx: 0 };
    expect(isResumptionHandled(newGap)).toBe(false);
  });
});
