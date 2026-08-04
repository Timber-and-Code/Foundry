/**
 * Reads the lifter's logged training history out of local storage.
 *
 * Exists as its own module for one reason: import direction. The natural
 * home would be archive.ts, but archive.ts imports sync.ts, and sync.ts is
 * one of the callers that needs this — putting it there closes a cycle. Same
 * reasoning that moved `wipeMesoSessionData` into storage.ts.
 *
 * Everything here reads; the aggregation itself lives in progressAggregation
 * (a deliberately pure, no-I/O module) so it stays unit-testable without a
 * storage fixture.
 */
import { store } from './storage';
import { validateArchive } from './validate';
import { collectTrainedExerciseIds } from './progressAggregation';
import type { ArchiveEntry } from '../types';

/**
 * Exercise ids the lifter has real logged work for, across every archived
 * mesocycle. Feeds anchor continuity in `generateProgram`.
 *
 * Returns an empty set on unreadable storage rather than throwing: a
 * corrupt archive should cost you continuity for one cycle, not the ability
 * to generate a program at all.
 */
export function getTrainedExerciseIds(): Set<string> {
  let archive: ArchiveEntry[] = [];
  try {
    archive = validateArchive(JSON.parse(store.get('foundry:archive') || '[]'));
  } catch (e) {
    console.warn('[Foundry]', 'Failed to read archive for training history', e);
    return new Set<string>();
  }
  return collectTrainedExerciseIds(archive);
}
