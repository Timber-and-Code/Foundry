/**
 * Tests for MesoCompleteSheet — end-of-meso takeover.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';

const flags = new Map<string, string>();
const { emitMock, archiveMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  archiveMock: vi.fn(),
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
  resetMesoAfterCompletion: vi.fn(),
}));

import MesoCompleteSheet from '../MesoCompleteSheet';

const PROFILE = { name: 'Tim', experience: 'intermediate' } as const;

describe('MesoCompleteSheet', () => {
  beforeEach(() => {
    flags.clear();
    emitMock.mockClear();
    archiveMock.mockClear();
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

  it('Repeat keeps meso_transition and emits repeat-meso', () => {
    flags.set('foundry:meso_transition', '{"some":"data"}');
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/repeat this meso/i));
    expect(archiveMock).toHaveBeenCalledWith(PROFILE);
    // transition is NOT cleared for the repeat path
    expect(flags.get('foundry:meso_transition')).toBe('{"some":"data"}');
    expect(emitMock).toHaveBeenCalledWith('foundry:repeat-meso');
  });

  it('Build new clears meso_transition and emits new-meso', () => {
    flags.set('foundry:meso_transition', '{"old":"data"}');
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/build a new meso/i));
    expect(archiveMock).toHaveBeenCalledWith(PROFILE);
    expect(flags.has('foundry:meso_transition')).toBe(false);
    expect(emitMock).toHaveBeenCalledWith('foundry:new-meso');
  });

  it('Try a Foundry program clears transition and emits browse-samples', () => {
    flags.set('foundry:meso_transition', '{"old":"data"}');
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    fireEvent.click(screen.getByText(/try a foundry program/i));
    expect(archiveMock).toHaveBeenCalledWith(PROFILE);
    expect(flags.has('foundry:meso_transition')).toBe(false);
    expect(emitMock).toHaveBeenCalledWith('foundry:browse-samples');
  });

  it('sets meso_complete_shown flag on mount and clears it on choice', () => {
    render(<MesoCompleteSheet profile={PROFILE as never} />);
    expect(flags.get('foundry:meso_complete_shown')).toBe('1');
    fireEvent.click(screen.getByText(/build a new meso/i));
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
      expect(buttons).toHaveLength(4);
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
