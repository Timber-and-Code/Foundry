/**
 * Single source of truth for the human-readable split name shown across
 * the app (FoundryBanner subtitle, MesoOverview, Profile drawer,
 * ProgramReady, Next Session card, etc.).
 *
 * Always derive from `profile.splitType` (the actual user selection from
 * setup) — NOT from day-tag union, which collapses incorrectly for
 * splits whose day tags overlap with other splits (e.g. Traditional
 * with PUSH/PULL/LEGS/ARMS day tags would falsely look like PPL).
 *
 * Three style options:
 *   - 'title'   → "Upper / Lower"  (default — title case for body copy)
 *   - 'caps'    → "UPPER / LOWER"  (banners, headers)
 *   - 'compact' → "Upper / Lower"  (no slashes — same as title for now,
 *                                   reserved for a future tighter form)
 */
export type SplitLabelStyle = 'title' | 'caps' | 'compact';

const SPLIT_LABEL_TITLE: Record<string, string> = {
  ppl: 'Push / Pull / Legs',
  upper_lower: 'Upper / Lower',
  full_body: 'Full Body',
  push_pull: 'Push / Pull',
  traditional: 'Traditional',
  custom: 'Custom',
};

const SPLIT_LABEL_CAPS: Record<string, string> = {
  ppl: 'PUSH / PULL / LEGS',
  upper_lower: 'UPPER / LOWER',
  full_body: 'FULL BODY',
  push_pull: 'PUSH / PULL',
  traditional: 'TRADITIONAL',
  custom: 'CUSTOM',
};

export function formatSplitName(
  splitType: string | null | undefined,
  style: SplitLabelStyle = 'title',
): string {
  if (!splitType) return style === 'caps' ? 'CUSTOM' : 'Custom';
  const map = style === 'caps' ? SPLIT_LABEL_CAPS : SPLIT_LABEL_TITLE;
  if (map[splitType]) return map[splitType];
  // Unknown split type — best-effort derivation. caps → snake_case
  // upper-cased and underscores spaced, title → first-letter-uppercase.
  if (style === 'caps') return splitType.toUpperCase().replace(/_/g, ' ');
  return splitType
    .split('_')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Classify a split type from a program's actual day tags.
 *
 * `profile.splitType` can drift out of sync with the generated program
 * (e.g. a setup day-count change silently coerces the split). The program
 * day tags are ground truth, so this re-derives the split from them.
 *
 * The naive day-tag UNION was rejected before because Traditional uses
 * PUSH/PULL/LEGS tags and would look like PPL — but Traditional ALSO has
 * arm-focused days tagged ARMS, which disambiguates it cleanly here.
 *
 * Returns null when the tags can't be confidently classified (custom
 * splits) — callers should fall back to the stored splitType then.
 */
const SPLIT_LIFTING_TAGS = ['PUSH', 'PULL', 'LEGS', 'UPPER', 'LOWER', 'ARMS', 'FULL'];

export function classifySplitFromDays(
  days: ReadonlyArray<{ tag?: string }> | null | undefined,
): string | null {
  if (!days || days.length === 0) return null;
  // Lifting tags only — ignore CARDIO / MOBILITY / BW / rest entries.
  const tags = new Set<string>();
  for (const d of days) {
    const t = (d?.tag || '').toUpperCase();
    if (SPLIT_LIFTING_TAGS.includes(t)) tags.add(t);
  }
  if (tags.size === 0) return null;
  const has = (t: string) => tags.has(t);
  // Arm-focused day present → Traditional bro-split.
  if (has('ARMS')) return 'traditional';
  // Upper/Lower — only UPPER and/or LOWER days.
  if ((has('UPPER') || has('LOWER')) && !has('PUSH') && !has('PULL') && !has('LEGS')) {
    return 'upper_lower';
  }
  // Full body — only FULL days.
  if (
    has('FULL') &&
    !has('PUSH') && !has('PULL') && !has('LEGS') && !has('UPPER') && !has('LOWER')
  ) {
    return 'full_body';
  }
  // Push / Pull / Legs.
  if (has('PUSH') && has('PULL') && has('LEGS')) return 'ppl';
  // Push / Pull (no dedicated leg day).
  if (has('PUSH') && has('PULL') && !has('LEGS')) return 'push_pull';
  // Anything else — don't guess.
  return null;
}

/**
 * Friendly name to display for a `TrainingDay`'s tag, used by the workout
 * title bar and any other UI surface that needs a human-readable label
 * INDEPENDENT of the meso's stored `day.name`.
 *
 * Root-cause context: `day.name` is set once at `generateProgram` time and
 * never re-derived. If a user changes `profile.splitType` later (or the
 * meso was generated under a different splitType than what's currently
 * stored on profile), `day.name` goes stale — e.g. "Push Day 1" lingers
 * on an Upper/Lower meso. `day.tag` is the structural classification
 * (UPPER / LOWER / PUSH / PULL / LEGS / ARMS / FULL / CARDIO / MOBILITY /
 * BW) and stays correct relative to the day's actual role, so we prefer
 * it for display.
 *
 * Precedence: `day.label` > tag-derived name > `day.name` > "Day N".
 */
const TAG_FRIENDLY_NAME: Record<string, string> = {
  PUSH: 'Push Day',
  PULL: 'Pull Day',
  LEGS: 'Leg Day',
  UPPER: 'Upper Body',
  LOWER: 'Lower Body',
  ARMS: 'Arm Day',
  FULL: 'Full Body',
  CARDIO: 'Cardio',
  MOBILITY: 'Mobility',
  BW: 'Bodyweight',
};

export function dayDisplayName(
  day: { label?: string; tag?: string; name?: string } | null | undefined,
  idx?: number,
): string {
  if (!day) return idx != null ? `Day ${idx + 1}` : 'Workout';
  if (day.label) return day.label;
  const tag = (day.tag || '').toUpperCase();
  if (tag && TAG_FRIENDLY_NAME[tag]) return TAG_FRIENDLY_NAME[tag];
  if (day.name) return day.name;
  return idx != null ? `Day ${idx + 1}` : 'Workout';
}
