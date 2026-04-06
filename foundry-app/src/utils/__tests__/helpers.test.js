/**
 * Tests for helpers.js:
 * parseRestSeconds, haptic
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRestSeconds, haptic } from '../helpers.js';

// ============================================================================
// parseRestSeconds
// ============================================================================
describe('parseRestSeconds', () => {
  it('returns 90 for null input', () => {
    expect(parseRestSeconds(null)).toBe(90);
  });

  it('returns 90 for undefined input', () => {
    expect(parseRestSeconds(undefined)).toBe(90);
  });

  it('returns 90 for empty string', () => {
    expect(parseRestSeconds('')).toBe(90);
  });

  it('converts minutes — "2 min" → 120', () => {
    expect(parseRestSeconds('2 min')).toBe(120);
  });

  it('converts minutes — "3-4 min" → 240 (upper bound used)', () => {
    expect(parseRestSeconds('3-4 min')).toBe(240);
  });

  it('converts seconds — "90 sec" → 90', () => {
    expect(parseRestSeconds('90 sec')).toBe(90);
  });

  it('converts seconds — "60 sec" → 60', () => {
    expect(parseRestSeconds('60 sec')).toBe(60);
  });

  it('converts seconds — "60-90 sec" → 90 (upper bound used)', () => {
    expect(parseRestSeconds('60-90 sec')).toBe(90);
  });

  it('returns 90 default when no unit keyword is present', () => {
    expect(parseRestSeconds('2:30')).toBe(90);
  });

  it('returns 90 when input has no numeric characters', () => {
    expect(parseRestSeconds('rest between sets')).toBe(90);
  });

  it('handles decimal minutes — "1.5 min" → 90', () => {
    expect(parseRestSeconds('1.5 min')).toBe(90);
  });
});

// ============================================================================
// haptic
// ============================================================================
describe('haptic', () => {
  afterEach(() => {
    // Restore any navigator.vibrate mock
    vi.restoreAllMocks();
  });

  it('does not throw when navigator.vibrate is undefined', () => {
    const original = navigator.vibrate;
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
    expect(() => haptic('tap')).not.toThrow();
    Object.defineProperty(navigator, 'vibrate', { value: original, configurable: true, writable: true });
  });

  it('does not throw for known haptic types: tap, done, complete, victory', () => {
    ['tap', 'done', 'complete', 'victory'].forEach((type) => {
      expect(() => haptic(type)).not.toThrow();
    });
  });

  it('does not throw for an unknown haptic type', () => {
    expect(() => haptic('unknown')).not.toThrow();
  });

  it('calls navigator.vibrate when available', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true, writable: true });
    haptic('tap');
    expect(vibrateSpy).toHaveBeenCalled();
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
  });

  it('passes the correct tap pattern [40] to navigator.vibrate', () => {
    const vibrateSpy = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrateSpy, configurable: true, writable: true });
    haptic('tap');
    expect(vibrateSpy).toHaveBeenCalledWith([40]);
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true, writable: true });
  });
});
