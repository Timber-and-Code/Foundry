/**
 * Tests for CoachMarkOrchestrator — event → mark router.
 *
 * Verifies:
 *   - An event-trigger mark fires exactly one mark when its event fires
 *   - The mark is suppressed after its flag is set (dismissal persistence)
 *   - Multiple simultaneous triggers queue (one at a time)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';

const flags = new Map<string, string>();

vi.mock('../../../utils/store', () => ({
  store: {
    get: vi.fn((k: string) => flags.get(k) ?? null),
    set: vi.fn((k: string, v: string) => void flags.set(k, v)),
    remove: vi.fn((k: string) => void flags.delete(k)),
  },
}));

vi.mock('../../../utils/events', () => ({
  emit: vi.fn(),
  on: vi.fn(() => () => {}),
}));

import CoachMarkOrchestrator from '../CoachMarkOrchestrator';
import { COACH_MARKS } from '../marks';

describe('CoachMarkOrchestrator', () => {
  beforeEach(() => {
    flags.clear();
    vi.clearAllMocks();
  });

  it('fires a coach mark on its event trigger', () => {
    // anchor exists so the event-trigger mark can display
    const anchorEl = document.createElement('div');
    anchorEl.setAttribute('data-coach', 'anchor-hammer');
    document.body.appendChild(anchorEl);
    try {
      render(<CoachMarkOrchestrator />);
      act(() => {
        window.dispatchEvent(new Event('foundry:first-anchor-visible'));
      });
      // The anchor mark's title is "Anchor lifts"
      expect(screen.getByText(/the hammer marks anchor lifts/i)).toBeInTheDocument();
    } finally {
      document.body.removeChild(anchorEl);
    }
  });

  it('does not re-fire a mark after it is dismissed', () => {
    const anchorEl = document.createElement('div');
    anchorEl.setAttribute('data-coach', 'anchor-hammer');
    document.body.appendChild(anchorEl);
    try {
      render(<CoachMarkOrchestrator />);
      act(() => {
        window.dispatchEvent(new Event('foundry:first-anchor-visible'));
      });
      // Dismiss
      fireEvent.click(screen.getByRole('button', { name: /got it/i }));
      // Fire again
      act(() => {
        window.dispatchEvent(new Event('foundry:first-anchor-visible'));
      });
      // Mark should not be visible anymore
      expect(screen.queryByText(/the hammer marks anchor lifts/i)).not.toBeInTheDocument();
    } finally {
      document.body.removeChild(anchorEl);
    }
  });

  it('queues a second mark while the first is open and shows it after the cooldown', () => {
    // Provide both anchors so both marks can attempt to show
    const anchor1 = document.createElement('div');
    anchor1.setAttribute('data-coach', 'anchor-hammer');
    document.body.appendChild(anchor1);
    const anchor2 = document.createElement('div');
    anchor2.setAttribute('data-coach', 'rpe-prompt');
    document.body.appendChild(anchor2);
    vi.useFakeTimers();
    try {
      render(<CoachMarkOrchestrator />);
      act(() => {
        window.dispatchEvent(new Event('foundry:first-anchor-visible'));
        window.dispatchEvent(new Event('foundry:first-rpe-prompt'));
      });
      // Only the first shows
      expect(screen.getByText(/the hammer marks anchor lifts/i)).toBeInTheDocument();
      expect(screen.queryByText(/easy means we push more/i)).not.toBeInTheDocument();

      // Dismiss first — cooldown holds the second back
      fireEvent.click(screen.getByRole('button', { name: /got it/i }));
      expect(screen.queryByText(/easy means we push more/i)).not.toBeInTheDocument();

      // Advance past the 30s cooldown — second appears
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByText(/easy means we push more/i)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
      document.body.removeChild(anchor1);
      document.body.removeChild(anchor2);
    }
  });

  it('defines all expected marks with unique ids and trigger types', () => {
    const ids = COACH_MARKS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(COACH_MARKS.length).toBeGreaterThanOrEqual(11);
    COACH_MARKS.forEach((m) => {
      expect(['event', 'dwell', 'manual']).toContain(m.trigger.type);
      expect(m.copy.length).toBeLessThanOrEqual(120); // rough — 20 words ≈ <120 chars
    });
  });
});
