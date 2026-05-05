/**
 * Tests for CardioSessionView's CardioTimerContext wiring (Bundle G).
 *
 * The view used to own its own setInterval tick + startRef. Bundle G makes
 * CardioTimerContext the single source of truth — the view reads
 * `isActive`, `elapsedSeconds`, `targetSeconds`, `isComplete` from the
 * context and dispatches start / extend / endEarly / complete through it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
}));

import CardioSessionView from '../CardioSessionView';
import { CardioTimerProvider, useCardioTimer } from '../../../contexts/CardioTimerContext';
import { ActiveSessionProvider } from '../../../contexts/ActiveSessionContext';
import { saveCardioSession } from '../../../utils/persistence';
import type { Profile } from '../../../types';

// We need a way to peek at + drive the CardioTimerContext from the test
// scope without re-implementing it. A small probe component captures the
// hook value so assertions can assert against ctx state alongside
// CardioSessionView's UI.
type CtxValue = ReturnType<typeof useCardioTimer>;
let captured: CtxValue | null = null;
function CtxProbe() {
  captured = useCardioTimer();
  return null;
}

const baseProfile: Profile = {
  experience: 'intermediate',
  goal: 'build_muscle',
};

function renderView(props: Partial<React.ComponentProps<typeof CardioSessionView>> = {}) {
  const onBack = vi.fn();
  const utils = render(
    <MemoryRouter>
      <ActiveSessionProvider>
        <CardioTimerProvider>
          <CtxProbe />
          <CardioSessionView
            dateStr="2026-05-05"
            plannedProtocolId={null}
            onBack={onBack}
            profile={baseProfile}
            {...props}
          />
        </CardioTimerProvider>
      </ActiveSessionProvider>
    </MemoryRouter>,
  );
  return { ...utils, onBack };
}

describe('CardioSessionView — CardioTimerContext as source of truth', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    captured = null;
  });

  it('Start button dispatches startCardio on the context', () => {
    renderView({ plannedProtocolId: 'zone2_run' });

    expect(captured).not.toBeNull();
    expect(captured!.isActive).toBe(false);

    // Start session — context should flip to active.
    fireEvent.click(screen.getByRole('button', { name: /Start Session|Start/i }));

    expect(captured!.isActive).toBe(true);
    expect(captured!.protocolId).toBe('zone2_run');
    expect(captured!.targetSeconds).toBeGreaterThan(0);
  });

  it('+ 5 MIN button calls extendByMinutes(5)', () => {
    renderView({ plannedProtocolId: 'zone2_run' });
    fireEvent.click(screen.getByRole('button', { name: /Start Session|Start/i }));

    const initialTarget = captured!.targetSeconds!;
    fireEvent.click(screen.getByRole('button', { name: /Extend session by 5 minutes/i }));

    expect(captured!.targetSeconds).toBe(initialTarget + 300);
  });

  it('End early flow calls ctx.endEarly() and persists completion', () => {
    renderView({ plannedProtocolId: 'zone2_run' });
    fireEvent.click(screen.getByRole('button', { name: /Start Session|Start/i }));

    expect(captured!.isActive).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /End session early/i }));
    // Confirmation dialog appears; tap "End now" to commit.
    fireEvent.click(screen.getByRole('button', { name: /End now/i }));

    // Context tore down.
    expect(captured!.isActive).toBe(false);

    // Session was persisted as completed.
    const stored = JSON.parse(
      localStorage.getItem('foundry:cardio:session:2026-05-05') || '{}',
    );
    expect(stored.completed).toBe(true);
    expect(stored.completedAt).toBeTruthy();
  });

  it('Complete button calls ctx.complete() and persists completion', () => {
    renderView({ plannedProtocolId: 'zone2_run' });
    fireEvent.click(screen.getByRole('button', { name: /Start Session|Start/i }));

    fireEvent.click(screen.getByRole('button', { name: /Complete Session/i }));
    // Confirm in the alert dialog.
    fireEvent.click(screen.getByRole('button', { name: /Done ✓/i }));

    expect(captured!.isActive).toBe(false);
    const stored = JSON.parse(
      localStorage.getItem('foundry:cardio:session:2026-05-05') || '{}',
    );
    expect(stored.completed).toBe(true);
  });

  it('renders target progress bar when ctx has a target', () => {
    renderView({ plannedProtocolId: 'zone2_run' });
    fireEvent.click(screen.getByRole('button', { name: /Start Session|Start/i }));

    const bar = screen.getByRole('progressbar');
    expect(bar).toBeInTheDocument();
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });

  it('does NOT render an own setInterval — the context drives the tick', () => {
    // The hand-rolled tick used to call setInterval in CardioSessionView's
    // own useEffect. After Bundle G the only setInterval setup belongs to
    // CardioTimerProvider. We verify by spying on window.setInterval and
    // counting calls during a Start: there should be exactly one
    // (provider's) — not two.
    const setIntervalSpy = vi.spyOn(window, 'setInterval');
    renderView({ plannedProtocolId: 'zone2_run' });
    setIntervalSpy.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /Start Session|Start/i }));

    // Only the provider's tick should have been wired up.
    expect(setIntervalSpy).toHaveBeenCalledTimes(1);
    setIntervalSpy.mockRestore();
  });

  it('cold-restore: if a saved unfinished session exists on mount, the context is brought back up', () => {
    // Seed an unfinished session as if the user navigated away mid-cardio
    // and came back after a reload.
    saveCardioSession('2026-05-05', {
      completed: false,
      type: 'Bike',
      duration: '30',
      intensity: 'Moderate',
      protocolId: 'zone2_bike',
      startedAt: Date.now() - 60_000,
    });

    renderView({ plannedProtocolId: 'zone2_bike' });

    // The view's mount effect should have asked the context to startCardio
    // again so the tick + chime resume.
    expect(captured!.isActive).toBe(true);
    expect(captured!.protocolId).toBe('zone2_bike');
  });
});
