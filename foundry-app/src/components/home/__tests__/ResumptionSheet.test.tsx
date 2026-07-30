/**
 * Tests for ResumptionSheet — post-layoff takeover.
 *
 * Focus: the 'new_meso' tile must NEVER route through
 * applyResumptionChoice (whose unknown-choice fall-through is
 * restart_meso) — it archives, wipes, and hands off to the same
 * foundry:new-meso flow MesoCompleteSheet uses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const flags = new Map<string, string>();
const { emitMock, archiveMock, resetMesoMock, applyMock, markHandledMock } =
  vi.hoisted(() => ({
    emitMock: vi.fn(),
    archiveMock: vi.fn(),
    resetMesoMock: vi.fn(),
    applyMock: vi.fn(() => ({ startDateShifted: 0, completedWiped: 0, archived: false })),
    markHandledMock: vi.fn(),
  }));

vi.mock('../../../utils/store', () => ({
  store: {
    get: vi.fn((k: string) => flags.get(k) ?? null),
    set: vi.fn((k: string, v: string) => void flags.set(k, v)),
    remove: vi.fn((k: string) => void flags.delete(k)),
  },
}));

vi.mock('../../../utils/events', () => ({ emit: emitMock }));
vi.mock('../../../utils/archive', () => ({
  archiveCurrentMeso: archiveMock,
  resetMeso: resetMesoMock,
}));
vi.mock('../../../utils/resumption', () => ({
  applyResumptionChoice: applyMock,
  markResumptionHandled: markHandledMock,
}));

import ResumptionSheet from '../ResumptionSheet';

const PROFILE = { name: 'Tim', experience: 'intermediate' } as const;
const GAP = {
  gapDays: 10,
  lastCompletedDateISO: '2026-07-20',
  lastDayLabel: 'Push',
  lastDayIdx: 0,
  lastWeekIdx: 1,
};

function renderSheet(onDismiss = vi.fn()) {
  render(
    <ResumptionSheet
      gap={GAP as never}
      profile={PROFILE as never}
      completedDays={new Set<string>()}
      currentWeek={1}
      setProfile={vi.fn()}
      setCompletedDays={vi.fn()}
      setCurrentWeek={vi.fn()}
      onDismiss={onDismiss}
    />,
  );
  return onDismiss;
}

describe('ResumptionSheet', () => {
  beforeEach(() => {
    flags.clear();
    vi.clearAllMocks();
  });

  it('renders all five tiles', () => {
    renderSheet();
    expect(screen.getByText(/pick up where you left off/i)).toBeInTheDocument();
    expect(screen.getByText(/repeat last week/i)).toBeInTheDocument();
    expect(screen.getByText(/recalibrate/i)).toBeInTheDocument();
    expect(screen.getByText(/restart meso/i)).toBeInTheDocument();
    expect(screen.getByText(/start a new meso/i)).toBeInTheDocument();
  });

  it('resumption choices route through applyResumptionChoice', () => {
    const onDismiss = renderSheet();
    fireEvent.click(screen.getByText(/repeat last week/i));
    expect(applyMock).toHaveBeenCalledWith('repeat_last_week', GAP, expect.anything());
    expect(markHandledMock).toHaveBeenCalledWith(GAP);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('Start a new meso archives, wipes, and emits foundry:new-meso — never applyResumptionChoice', () => {
    flags.set('foundry:meso_transition', '{"some":"data"}');
    const onDismiss = renderSheet();
    fireEvent.click(screen.getByText(/start a new meso/i));

    expect(archiveMock).toHaveBeenCalledWith(PROFILE);
    expect(resetMesoMock).toHaveBeenCalledTimes(1);
    expect(flags.has('foundry:meso_transition')).toBe(false);
    expect(markHandledMock).toHaveBeenCalledWith(GAP);
    expect(emitMock).toHaveBeenCalledWith('foundry:new-meso');
    expect(onDismiss).toHaveBeenCalledTimes(1);
    // The fall-through hazard: this must never reach applyResumptionChoice.
    expect(applyMock).not.toHaveBeenCalled();
  });
});
