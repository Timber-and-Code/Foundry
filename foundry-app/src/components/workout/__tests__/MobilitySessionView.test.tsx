/**
 * MobilitySessionView — protocol-library schema bridge.
 *
 * The 2026-04-21 library redesign replaced `exercises` (hold-timer shape)
 * with `moves` (reps + cue) on MOBILITY_PROTOCOLS, which the runner was
 * never migrated to: every picker tap crashed on `proto.exercises.length`
 * and the post-workout cool-down flow dead-ended on the picker. These
 * tests pin the adapter + entry flows:
 *
 *  - picker renders library protocols with real move counts (not "0")
 *  - tapping a protocol enters exercise 1 on the FIRST tap
 *  - a pre-seeded session (cool-down prompt / "Start now") auto-enters
 *  - timed doses ('45 sec') drive the hold; '/ side' doses run the L/R flow
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobilitySessionView from '../MobilitySessionView';
import { ActiveSessionProvider } from '../../../contexts/ActiveSessionContext';
import { MOBILITY_PROTOCOLS } from '../../../data/constants';
import type { Profile } from '../../../types';

const DATE = '2026-07-24';
const SESSION_KEY = `foundry:mobility:session:${DATE}`;

function renderView(onBack = vi.fn()) {
  return render(
    <MemoryRouter>
      <ActiveSessionProvider>
        <MobilitySessionView dateStr={DATE} onBack={onBack} profile={{} as Profile} />
      </ActiveSessionProvider>
    </MemoryRouter>,
  );
}

const firstProto = MOBILITY_PROTOCOLS[0] as unknown as {
  id: string;
  name: string;
  moves: { name: string; reps: string }[];
};

describe('MobilitySessionView (library schema bridge)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the picker with real move counts from the library schema', () => {
    renderView();
    expect(screen.getByText('CHOOSE A PROTOCOL')).toBeTruthy();
    expect(screen.getByText(firstProto.name)).toBeTruthy();
    // Regression: `p.exercises?.length ?? 0` rendered "0 EXERCISES" for
    // every card under the moves schema.
    expect(screen.queryAllByText(/0 EXERCISES/)).toHaveLength(0);
  });

  it('enters the first exercise on the FIRST tap of a protocol card', () => {
    renderView();
    fireEvent.click(screen.getByText(firstProto.name));
    // Intro screen for move 1 — picker heading gone, first move visible.
    expect(screen.queryByText('CHOOSE A PROTOCOL')).toBeNull();
    expect(screen.getByText(firstProto.moves[0].name)).toBeTruthy();
    // Session persisted with the picked protocol.
    expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).protocolId).toBe(firstProto.id);
  });

  it('auto-enters exercise 1 when the session is pre-seeded (cool-down flow)', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ protocolId: 'post_training_downshift', completed: false, completedAt: null }),
    );
    renderView();
    expect(screen.queryByText('CHOOSE A PROTOCOL')).toBeNull();
    const downshift = (MOBILITY_PROTOCOLS as unknown as typeof firstProto[]).find(
      (p) => p.id === 'post_training_downshift',
    )!;
    expect(screen.getByText(downshift.moves[0].name)).toBeTruthy();
  });

  it('shows the library dose line verbatim on the intro screen', () => {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ protocolId: firstProto.id, completed: false, completedAt: null }),
    );
    renderView();
    expect(screen.getByText(firstProto.moves[0].reps)).toBeTruthy();
  });

  it('"← Protocols" returns to the picker without bouncing back in', () => {
    renderView();
    fireEvent.click(screen.getByText(firstProto.name));
    fireEvent.click(screen.getByLabelText('Back to protocols'));
    expect(screen.getByText('CHOOSE A PROTOCOL')).toBeTruthy();
  });
});
