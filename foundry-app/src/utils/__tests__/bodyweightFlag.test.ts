/**
 * The `bw` flag on bodyweight exercises.
 *
 * It is not cosmetic. Setting it changes three behaviours:
 *   - training.ts    — no percentage warmup ramp (you can't do 50% of you)
 *   - persistence.ts — progression bumps REPS, not weight
 *   - ExtraDayView   — session volume counts bodyweight x reps
 *   - DayView        — triggers the bodyweight check-in so that math is current
 *
 * 40 of 50 bodyweight-equipment entries were missing it, so all of them were
 * being handed weight-based progression they can never satisfy: hit your
 * reps on a plank and the app would try to add 5 lbs to it.
 *
 * The five deliberate exceptions carry EXTERNAL load. A weighted sit-up
 * exists precisely so you can add a plate, and its progression should be
 * weight. Their `equipment: 'bodyweight'` is a separate mistag.
 */
import { describe, it, expect } from 'vitest';
import { EXERCISE_DB } from '../../data/exercises';

interface Entry { id: string; equipment?: string; bw?: boolean; anchor?: boolean; name: string }
const DB = EXERCISE_DB as unknown as Entry[];

/** Externally loaded despite equipment:'bodyweight'. */
const EXTERNALLY_LOADED = [
  'weighted_crunch', 'weighted_sit_up', 'weighted_hanging_leg_raise',
  'svend_press', 'plate_front_raise',
];

describe('bodyweight flag', () => {
  it('flags every bodyweight exercise that carries no external load', () => {
    const unflagged = DB
      .filter((e) => e.equipment === 'bodyweight' && !e.bw)
      .map((e) => e.id)
      .sort();
    expect(unflagged).toEqual([...EXTERNALLY_LOADED].sort());
  });

  it('leaves the externally loaded ones on weight progression', () => {
    // Flagging these would switch them to rep-bumping and stop counting the
    // plate — the whole point of the "weighted" variant.
    for (const id of EXTERNALLY_LOADED) {
      const e = DB.find((x) => x.id === id);
      expect(e, `${id} missing from DB`).toBeDefined();
      expect(e!.bw, `${id} should not be bw`).toBeFalsy();
    }
  });

  it('sets bw only on bodyweight-driven movements', () => {
    // A barbell lift progressing by reps instead of load would silently stall
    // every anchor in the program.
    //
    // The assisted variants are the deliberate exception: equipment 'machine',
    // but the load IS your bodyweight and the machine subtracts from it. With
    // bw off they would get weight progression on the ASSIST — the app would
    // present "add 5 lbs of help" as progress, which is backwards. The cost is
    // that volume counts full bodyweight and so overstates an assisted rep;
    // that imprecision is preferable to inverted progression.
    const ASSISTED = ['pullups_assisted', 'chinups_assisted'];
    const wrong = DB
      .filter((e) => e.bw && e.equipment !== 'bodyweight' && !ASSISTED.includes(e.id))
      .map((e) => e.id);
    expect(wrong).toEqual([]);
  });

  it('keeps every bodyweight ANCHOR loadable', () => {
    // Same invariant box_jump violated: an anchor with no load source starves
    // every weight-keyed reader downstream.
    const unloadable = DB
      .filter((e) => e.anchor && e.equipment === 'bodyweight' && !e.bw)
      .map((e) => e.id);
    expect(unloadable).toEqual([]);
  });

  it('did not disturb the rest of the library', () => {
    expect(DB).toHaveLength(234);
    expect(new Set(DB.map((e) => e.id)).size).toBe(DB.length);
  });
});
