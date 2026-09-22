/**
 * Day tag from a training-day label, for programs rebuilt from Supabase.
 *
 * The remote schema stores a day's label ("Full Body B") but not its tag.
 * The rebuild used to take the tag from the day's first exercise, so a
 * full-body day that opened with squats wore a LEGS chip on Progress and
 * Home. The label names the split; read it back.
 *
 * Returns '' when the label says nothing about the split ("Day 3") so the
 * caller can fall back to what it has.
 */
const LABEL_TAGS: [RegExp, string][] = [
  [/full\s*body|^full\b/i, 'FULL'],
  [/upper/i, 'UPPER'],
  [/lower/i, 'LOWER'],
  [/push/i, 'PUSH'],
  [/pull/i, 'PULL'],
  [/legs?\b/i, 'LEGS'],
  [/chest/i, 'CHEST'],
  [/back/i, 'BACK'],
  [/shoulders?/i, 'SHOULDERS'],
  [/arms?\b/i, 'ARMS'],
  [/cardio/i, 'CARDIO'],
];

export function dayTagFromLabel(label: string | null | undefined): string {
  if (!label) return '';
  for (const [re, tag] of LABEL_TAGS) if (re.test(label)) return tag;
  return '';
}
