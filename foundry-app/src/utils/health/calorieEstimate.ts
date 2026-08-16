/**
 * Strength-training energy estimate for the HealthKit workout envelope.
 *
 * MET formula: kcal = METs × bodyweight(kg) × duration(hours).
 *
 * METs for resistance training (Compendium of Physical Activities):
 *   light     3.5  bodyweight circuits, easy accessory work
 *   moderate  5.0  typical hypertrophy block  ← our default
 *   vigorous  6.0  heavy strength, near-max sets
 *
 * This is deliberately a rough envelope. An Apple Watch computes energy
 * from heart rate and will be far more accurate; this exists so lifters
 * WITHOUT a Watch still get their session onto the Move ring instead of
 * a workout entry that reads zero.
 */

export type LiftIntensity = 'light' | 'moderate' | 'vigorous';

const METS: Record<LiftIntensity, number> = {
  light: 3.5,
  moderate: 5,
  vigorous: 6,
};

const LBS_PER_KG = 2.20462;

/** Fallback bodyweight when the profile has none, in lbs. */
const ASSUMED_LBS = 170;

/**
 * Sessions longer than this are almost always a lifter who forgot to hit
 * complete — the app has no idea they left. Writing 6 hours of "moderate
 * lifting" to HealthKit would put a fictional 2000 kcal on the Move ring,
 * so the duration is capped rather than trusted.
 */
export const MAX_CREDITED_MINUTES = 180;

export function estimateKcal(opts: {
  startMs: number;
  endMs: number;
  /** Lifter's bodyweight in pounds. Falsy/NaN falls back to ASSUMED_LBS. */
  weightLbs?: number | string | null;
  intensity?: LiftIntensity;
}): number {
  const { startMs, endMs } = opts;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return 0;

  const rawMinutes = (endMs - startMs) / 60000;
  if (!(rawMinutes > 0)) return 0;
  const minutes = Math.min(rawMinutes, MAX_CREDITED_MINUTES);

  const parsed = parseFloat(String(opts.weightLbs ?? ''));
  const lbs = Number.isFinite(parsed) && parsed > 0 ? parsed : ASSUMED_LBS;

  const mets = METS[opts.intensity ?? 'moderate'];
  const kcal = mets * (lbs / LBS_PER_KG) * (minutes / 60);
  return Math.max(0, Math.round(kcal));
}
