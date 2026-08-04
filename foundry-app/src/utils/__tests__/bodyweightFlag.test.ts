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
 * The three deliberate exceptions carry EXTERNAL load. A weighted sit-up
 * exists precisely so you can add a plate, and its progression should be
 * weight.
 */
import { describe, it, expect } from 'vitest';
import { EXERCISE_DB } from '../../data/exercises';

interface Entry { id: string; equipment?: string; bw?: boolean; anchor?: boolean; name: string }
const DB = EXERCISE_DB as unknown as Entry[];

/**
 * Bodyweight movements you ADD load to. The "weighted" variants exist
 * precisely so you can hold a plate, so more load means harder and weight
 * progression is correct — flagging them would switch them to rep-bumping
 * and stop counting the plate entirely.
 *
 * svend_press and plate_front_raise used to be here too. They are not
 * bodyweight movements at all — both require a plate — so they moved to
 * equipment:'barbell', matching the landmine exercises which are also
 * barbell-plus-plates. That also stops a minimal- or home-equipment lifter
 * from being programmed a movement needing gear they don't own.
 */
const EXTERNALLY_LOADED = [
  'weighted_crunch', 'weighted_sit_up', 'weighted_hanging_leg_raise',
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

  it('keeps plate movements out of the bodyweight pool', () => {
    // equipment drives generateProgram's pool filter, so 'bodyweight' here
    // meant a minimal-equipment lifter could be handed a plate exercise.
    for (const id of ['svend_press', 'plate_front_raise']) {
      const e = DB.find((x) => x.id === id);
      expect(e!.equipment, `${id} needs a plate, not bodyweight`).toBe('barbell');
    }
  });

  it('uses only known equipment values', () => {
    // The pool filter matches against a closed set; an unrecognised value
    // silently removes the exercise from every program.
    const KNOWN = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band', 'kettlebell'];
    const unknown = DB.filter((e) => !KNOWN.includes(e.equipment || '')).map((e) => e.id);
    expect(unknown).toEqual([]);
  });

  it('did not disturb the rest of the library', () => {
    expect(DB).toHaveLength(234);
    expect(new Set(DB.map((e) => e.id)).size).toBe(DB.length);
  });
});
