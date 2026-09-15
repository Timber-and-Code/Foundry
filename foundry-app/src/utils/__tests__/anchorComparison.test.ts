/**
 * The "VS LAST WEEK" rows on the completion summary.
 *
 * Two reported confusions drive this. A matched lift rendered as a bare
 * "0 lbs" under that heading, which reads as "you lifted zero pounds"; and
 * once the deload started prescribing a lighter bar, every anchor in that
 * week showed a red negative for doing exactly what the program asked.
 */
import { describe, it, expect } from 'vitest';
import { formatAnchorRow, anchorSectionLabel } from '../anchorComparison';

const row = (prev: number, today: number) =>
  ({ name: 'Bench Press', prev, today, delta: Math.round(today - prev) });

describe('a matched lift does not read as zero', () => {
  it('says "held" rather than "0 lbs"', () => {
    const r = formatAnchorRow(row(200, 200));
    expect(r.chip).toBe('held');
    expect(r.chip).not.toContain('0');
    expect(r.tone).toBe('flat');
  });

  it('still shows what was compared', () => {
    expect(formatAnchorRow(row(200, 200)).weights).toBe('200 → 200 lbs');
  });
});

describe('gains and losses in a working week', () => {
  it('signs a gain and tones it up', () => {
    const r = formatAnchorRow(row(185, 195));
    expect(r.chip).toBe('+10');
    expect(r.weights).toBe('185 → 195 lbs');
    expect(r.tone).toBe('up');
  });

  it('shows a real drop as a loss outside the deload', () => {
    const r = formatAnchorRow(row(200, 180));
    expect(r.chip).toBe('−20');
    expect(r.tone).toBe('down');
  });

  it('keeps half-plate weights intact and drops phantom decimals', () => {
    expect(formatAnchorRow(row(72.5, 75)).weights).toBe('72.5 → 75 lbs');
  });
});

describe('the deload week is not a regression', () => {
  it('calls a prescribed drop "planned" and refuses the loss tone', () => {
    const r = formatAnchorRow(row(200, 180), true);
    expect(r.chip).toBe('planned');
    expect(r.tone).toBe('planned');
    expect(r.tone).not.toBe('down');
    expect(r.weights).toBe('200 → 180 lbs'); // the numbers are still shown
  });

  it('still credits going HEAVIER than the deload asked for', () => {
    const r = formatAnchorRow(row(200, 205), true);
    expect(r.chip).toBe('+5');
    expect(r.tone).toBe('up');
  });

  it('holds at the same weight the same way in either week', () => {
    expect(formatAnchorRow(row(200, 200), true).chip).toBe('held');
  });

  it('labels the section so the week explains itself', () => {
    expect(anchorSectionLabel(false)).toBe('VS LAST WEEK');
    expect(anchorSectionLabel(true)).toBe('VS LAST WEEK (DELOAD)');
  });
});
