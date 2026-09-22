/**
 * dayTagFromLabel — the tag a remote-rebuilt day wears comes from its
 * label, not its first exercise. A full-body day that opens with squats
 * used to show a LEGS chip.
 */
import { describe, it, expect } from 'vitest';
import { dayTagFromLabel } from '../dayTag';

describe('dayTagFromLabel', () => {
  it('reads the split off every generated label', () => {
    expect(dayTagFromLabel('Full Body A')).toBe('FULL');
    expect(dayTagFromLabel('Full Body D')).toBe('FULL');
    expect(dayTagFromLabel('Upper A')).toBe('UPPER');
    expect(dayTagFromLabel('Lower Body')).toBe('LOWER');
    expect(dayTagFromLabel('Push Day 1')).toBe('PUSH');
    expect(dayTagFromLabel('Pull 2')).toBe('PULL');
    expect(dayTagFromLabel('Legs Day')).toBe('LEGS');
    expect(dayTagFromLabel('Chest')).toBe('CHEST');
    expect(dayTagFromLabel('Back')).toBe('BACK');
    expect(dayTagFromLabel('Shoulders')).toBe('SHOULDERS');
    expect(dayTagFromLabel('Arms')).toBe('ARMS');
  });

  it('gives nothing for a label that names no split, so the caller can fall back', () => {
    expect(dayTagFromLabel('Day 3')).toBe('');
    expect(dayTagFromLabel('')).toBe('');
    expect(dayTagFromLabel(null)).toBe('');
    expect(dayTagFromLabel(undefined)).toBe('');
  });
});
