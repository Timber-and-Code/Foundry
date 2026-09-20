/**
 * Experience has been saved three ways over the app's life: onboarding
 * writes 'new' | 'intermediate' | 'advanced', older setup wrote 'beginner' /
 * 'experienced'. Everything that BRANCHES on experience goes through
 * `experienceTier` — comparing the raw string is how a first-year lifter
 * ('new') ended up with the advanced exercise pool.
 */
export type ExperienceTier = 'beginner' | 'intermediate' | 'advanced';

export function experienceTier(exp: unknown): ExperienceTier {
  if (exp === 'new' || exp === 'beginner') return 'beginner';
  if (exp === 'advanced' || exp === 'experienced') return 'advanced';
  return 'intermediate';
}

/** The options a lifter picks from. `value` is what onboarding stores. */
export const EXPERIENCE_OPTIONS: { value: string; tier: ExperienceTier; label: string; hint: string }[] = [
  { value: 'new', tier: 'beginner', label: 'Under 1 year', hint: 'Simpler lifts, room to learn them' },
  { value: 'intermediate', tier: 'intermediate', label: '1–3 years', hint: 'The full standard library' },
  { value: 'advanced', tier: 'advanced', label: '3+ years', hint: 'Advanced variations, more volume' },
];

export function experienceLabel(exp: unknown): string {
  const tier = experienceTier(exp);
  return EXPERIENCE_OPTIONS.find((o) => o.tier === tier)!.label;
}
