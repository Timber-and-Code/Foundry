/**
 * Presentation for the "VS LAST WEEK" rows on the completion summary.
 *
 * Pure and shared on purpose. The rows are rendered twice — in
 * WorkoutCompleteModal and again on the shareable ShareCard — and the two
 * were hand-rolled copies of the same `{sign}{delta} lbs` expression. This
 * repo has been bitten by that shape before (the session-key wipe and the
 * mixed-slice filter each grew a distinct bug once duplicated), so the
 * decision of what a row SAYS lives here and each surface only maps a tone
 * onto its own palette.
 *
 * Two things this fixes:
 *
 *  - A matched lift rendered as a bare "0 lbs" under a "VS LAST WEEK"
 *    heading, which reads as "you lifted zero pounds" rather than "you held
 *    last week's weight".
 *
 *  - In the deload week a LIGHTER bar is the prescription, not a regression,
 *    so painting it red told the lifter they had lost ground for doing
 *    exactly what the program asked.
 */

export interface AnchorDelta {
  name: string;
  today: number;
  prev: number;
  delta: number;
}

/** How a row should be coloured. Each surface owns the actual hex. */
export type AnchorTone = 'up' | 'down' | 'flat' | 'planned';

export interface AnchorRow {
  name: string;
  /** e.g. "185 → 195 lbs" — what is actually being compared. */
  weights: string;
  /** Short badge: "+10", "−20", "held", "planned". */
  chip: string;
  tone: AnchorTone;
}

/** Trim a trailing ".0" so 187.5 keeps its half and 200 doesn't gain one. */
function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}

/**
 * One row's copy.
 *
 * `isDeload` only ever softens: going UP in a deload is still the lifter
 * exceeding the prescription and keeps its positive tone. It's the drop that
 * stops being a failure.
 */
export function formatAnchorRow(a: AnchorDelta, isDeload = false): AnchorRow {
  const weights = `${fmt(a.prev)} → ${fmt(a.today)} lbs`;
  if (a.delta === 0) {
    return { name: a.name, weights, chip: 'held', tone: 'flat' };
  }
  if (a.delta > 0) {
    return { name: a.name, weights, chip: `+${fmt(a.delta)}`, tone: 'up' };
  }
  if (isDeload) {
    return { name: a.name, weights, chip: 'planned', tone: 'planned' };
  }
  // U+2212 minus, not a hyphen — it aligns with digits at these weights.
  return { name: a.name, weights, chip: `−${fmt(Math.abs(a.delta))}`, tone: 'down' };
}

/** Section heading, so the deload says so rather than looking like a bad week. */
export function anchorSectionLabel(isDeload = false): string {
  return isDeload ? 'VS LAST WEEK (DELOAD)' : 'VS LAST WEEK';
}
