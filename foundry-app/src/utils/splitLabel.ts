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
