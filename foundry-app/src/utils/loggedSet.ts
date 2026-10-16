/**
 * A set is LOGGED when the lifter confirmed it. Nothing else counts.
 *
 * Every row in `foundry:day{d}:week{w}` is not a lift. Opening a day builds
 * carry-over suggestions for every exercise in memory, and the first save of
 * ANY set persists the whole day — so the suggested weight × reps for sets
 * the lifter never touched sit in storage looking exactly like logged work.
 * The deload and recalibrate prescriptions do the same with their flags
 * cleared, so no flag other than `confirmed` separates "the app proposed
 * this" from "I did this".
 *
 * `confirmed` is already the app's definition everywhere it matters: the
 * done-state check, the remote push, PR detection. Readers that build
 * history from stored sets — the lift history sheet, the LAST WK chip, the
 * e1RM and PR charts, Lifts by Muscle, Current Weights, muscle volume, the
 * previous-meso reference, anchor peaks, left-open set counts — all go
 * through this so a suggestion is never shown as a lift.
 *
 * Warmups are logged sets too; callers that want working sets filter
 * `warmup` themselves, as they always have.
 *
 * Structural on purpose: the workout card has its own SetData shape.
 */
export function isLoggedSet<T extends { confirmed?: boolean }>(
  set: T | null | undefined,
): set is T {
  return !!set && set.confirmed === true;
}
