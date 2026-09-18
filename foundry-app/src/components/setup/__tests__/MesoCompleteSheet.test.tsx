/**
 * Tests for MesoCompleteSheet — end-of-meso takeover.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const flags = new Map<string, string>();
const { emitMock, archiveMock, resetMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  archiveMock: vi.fn(),
  resetMock: vi.fn(),
}));

vi.mock('../../../utils/store', () => ({
  store: {
    get: vi.fn((k: string) => flags.get(k) ?? null),
    set: vi.fn((k: string, v: string) => void flags.set(k, v)),
    remove: vi.fn((k: string) => void flags.delete(k)),
  },
}));

vi.mock('../../../utils/events', () => ({ emit: emitMock, on: vi.fn(() => () => {}) }));
vi.mock('../../../utils/archive', () => ({
  archiveCurrentMeso: archiveMock,
  resetMesoAfterCompletion: resetMock,
}));

import MesoCompleteSheet from '../MesoCompleteSheet';

const PROFILE = { name: 'Tim', experience: 'intermediate' } as const;

describe('MesoCompleteSheet', () => {
  beforeEach(() => {
    flags.clear();
    emitMock.mockClear();
    archiveMock.mockClear();
    resetMock.mockClear();
  });

  it('renders the three action cards', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    expect(screen.getByText(/repeat this meso/i)).toBeInTheDocument();
    expect(screen.getByText(/build a new meso/i)).toBeInTheDocument();
    expect(screen.getByText(/try a foundry program/i)).toBeInTheDocument();
  });

  it('greets the user by first name', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    expect(screen.getByText(/good work, tim/i)).toBeInTheDocument();
  });

  it('is a modal dialog (not dismissable)', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  // Repeat / Build new must NOT end the meso on tap: archiving wiped the
  // session keys while the profile survived, so backing out of setup (or
  // closing the app) restarted the same program at week 1 and the summary
  // was gone. App archives only once the new meso actually starts.
  it('Repeat opens setup without archiving or wiping anything', () => {
    flags.set('foundry:meso_transition', '{"some":"data"}');
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/repeat this meso/i));
    expect(archiveMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(flags.get('foundry:meso_complete_shown')).toBe('1');
    expect(emitMock).toHaveBeenCalledWith('foundry:build-next-meso', { fresh: false });
  });

  it('Build new opens a fresh setup without archiving or wiping anything', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/build a new meso/i));
    expect(archiveMock).not.toHaveBeenCalled();
    expect(resetMock).not.toHaveBeenCalled();
    expect(flags.get('foundry:meso_complete_shown')).toBe('1');
    expect(emitMock).toHaveBeenCalledWith('foundry:build-next-meso', { fresh: true });
  });

  it('View meso summary reopens the recap', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/view meso summary/i));
    expect(emitMock).toHaveBeenCalledWith('foundry:view-meso-summary');
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it('Try a Foundry program clears transition and emits browse-samples', () => {
    flags.set('foundry:meso_transition', '{"old":"data"}');
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/try a foundry program/i));
    expect(archiveMock).toHaveBeenCalledWith(PROFILE);
    expect(flags.has('foundry:meso_transition')).toBe(false);
    expect(emitMock).toHaveBeenCalledWith('foundry:browse-samples');
  });

  it('sets meso_complete_shown flag on mount and clears it when browsing samples', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    expect(flags.get('foundry:meso_complete_shown')).toBe('1');
    fireEvent.click(screen.getByText(/try a foundry program/i));
    expect(flags.has('foundry:meso_complete_shown')).toBe(false);
  });

  describe('with a meso planned during the deload', () => {
    const draft = {
      v: 1,
      savedAt: '2026-09-17T00:00:00Z',
      profile: { splitType: 'upper_lower', workoutDays: [1, 2, 4, 5], mesoLength: 4 },
      program: [{ name: 'Upper A', exercises: [{ id: 'bench', name: 'Bench' }] }],
    };
    beforeEach(() => localStorage.setItem('foundry:next_meso_draft', JSON.stringify(draft)));
    afterEach(() => localStorage.removeItem('foundry:next_meso_draft'));

    it('leads with it, above the usual three', () => {
      render(<MesoCompleteSheet profile={PROFILE as never} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(5); // + View meso summary
      expect(buttons[0]).toHaveTextContent(/Start your planned meso/);
      expect(buttons[0]).toHaveTextContent(/Upper \/ Lower · 4 days\/wk · 4 weeks \+ deload/);
    });

    it('hands the start to App instead of archiving here', () => {
      render(<MesoCompleteSheet profile={PROFILE as never} />);
      fireEvent.click(screen.getByText(/Start your planned meso/));
      expect(emitMock).toHaveBeenCalledWith('foundry:start-planned-meso');
      // startPlannedMeso archives — doing it here too would archive twice.
      expect(archiveMock).not.toHaveBeenCalled();
    });
  });
});
