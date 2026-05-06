/**
 * Tests for CardioApplySheet payload schema (Bundle G).
 *
 * Verifies both branches of the discriminated payload:
 *   - { kind: 'preset', presetId } — keeps the legacy CARDIO_WORKOUTS path
 *     working for built-in protocols.
 *   - { kind: 'composed', session } — Designer hands in an inline
 *     CardioComposition, the sheet auto-mints a user preset on apply, and
 *     schedules that fresh preset's id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
  syncCardioPresetToSupabase: vi.fn(),
  deleteCardioPresetRemote: vi.fn(),
}));

import CardioApplySheet, {
  applyCardioScheduleUpdate,
  type CardioApplyPayload,
} from '../CardioApplySheet';
import { loadCardioPresets } from '../../../utils/persistence';
import type { Profile } from '../../../types';
import type { CardioComposition } from '../CardioDesigner';

describe('CardioApplySheet', () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders 7 day-of-week pills inside a dialog', () => {
    render(
      <CardioApplySheet
        payload={{ kind: 'preset', presetId: 'zone2_run' }}
        protocolLabel="Zone 2 Run"
        schedule={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('preset payload: schedules selected DOWs with the given presetId', () => {
    const onApply = vi.fn();
    render(
      <CardioApplySheet
        payload={{ kind: 'preset', presetId: 'zone2_run' }}
        protocolLabel="Zone 2 Run"
        schedule={[]}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [nextSchedule, addedCount, resolvedId] = onApply.mock.calls[0];
    expect(addedCount).toBe(2);
    expect(resolvedId).toBe('zone2_run');
    expect(nextSchedule).toEqual([
      { dayOfWeek: 1, protocol: 'zone2_run' },
      { dayOfWeek: 3, protocol: 'zone2_run' },
    ]);
  });

  it('preset payload: pre-selects DOWs already scheduled for that preset', () => {
    render(
      <CardioApplySheet
        payload={{ kind: 'preset', presetId: 'zone2_run' }}
        protocolLabel="Zone 2 Run"
        schedule={[
          { dayOfWeek: 1, protocol: 'zone2_run' },
          { dayOfWeek: 3, protocol: 'zone2_run' },
        ]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Wed' })).toHaveAttribute('aria-pressed', 'true');
    // Tue should not be selected
    expect(screen.getByRole('button', { name: 'Tue' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('preset payload: overwrites conflicting other-protocol slots on selected days', () => {
    const onApply = vi.fn();
    render(
      <CardioApplySheet
        payload={{ kind: 'preset', presetId: 'zone2_run' }}
        protocolLabel="Zone 2 Run"
        schedule={[{ dayOfWeek: 2, protocol: 'sprint_intervals_run' }]}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const [nextSchedule, _addedCount, resolvedId] = onApply.mock.calls[0];
    expect(resolvedId).toBe('zone2_run');
    expect(nextSchedule).toEqual([{ dayOfWeek: 2, protocol: 'zone2_run' }]);
  });

  it('composed payload: persists a new user preset and schedules its fresh id', () => {
    const session: CardioComposition = {
      intensity: 'moderate',
      modality: 'bike',
      protocol: 'zone2',
      duration: 30,
    };
    const payload: CardioApplyPayload = { kind: 'composed', session };

    const onApply = vi.fn();
    render(
      <CardioApplySheet
        payload={payload}
        protocolLabel="MODERATE · BIKE · ZONE 2 · 30 MIN"
        schedule={[]}
        onApply={onApply}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    // A fresh user preset was minted.
    const presets = loadCardioPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].isUserSaved).toBe(true);
    expect(presets[0].intensity).toBe('moderate');
    expect(presets[0].modality).toBe('bike');
    expect(presets[0].protocol).toBe('zone2');
    expect(presets[0].target).toEqual({ kind: 'duration', minutes: 30 });
    expect(presets[0].id).toMatch(/^usr_/);

    // The sheet schedules that newly-minted preset's id.
    expect(onApply).toHaveBeenCalledTimes(1);
    const [nextSchedule, addedCount, resolvedId] = onApply.mock.calls[0];
    expect(addedCount).toBe(1);
    expect(resolvedId).toBe(presets[0].id);
    expect(nextSchedule).toEqual([{ dayOfWeek: 6, protocol: presets[0].id }]);
  });

  it('composed payload: derives the preset label from describeCardioComp', () => {
    const session: CardioComposition = {
      intensity: 'hard',
      modality: 'run',
      protocol: 'sprint_intervals',
      duration: 15,
    };
    render(
      <CardioApplySheet
        payload={{ kind: 'composed', session }}
        protocolLabel="HARD · RUN · SPRINT INTERVALS · 15 MIN"
        schedule={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Sun' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const presets = loadCardioPresets();
    expect(presets).toHaveLength(1);
    expect(presets[0].label).toBe('HARD · RUN · SPRINT INTERVALS · 15 MIN');
  });

  it('Apply is disabled until the user makes a change', () => {
    render(
      <CardioApplySheet
        payload={{ kind: 'preset', presetId: 'zone2_run' }}
        protocolLabel="Zone 2 Run"
        schedule={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('Cancel fires onClose', () => {
    const onClose = vi.fn();
    render(
      <CardioApplySheet
        payload={{ kind: 'preset', presetId: 'zone2_run' }}
        protocolLabel="Zone 2 Run"
        schedule={[]}
        onApply={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('applyCardioScheduleUpdate produces a new Profile object with the schedule', () => {
    const profile = { name: 'Tester', age: 30, experience: 'intermediate' } as unknown as Profile;
    const next = [{ dayOfWeek: 1, protocol: 'zone2_run' }];
    const updated = applyCardioScheduleUpdate(profile, next);
    expect(updated).not.toBe(profile);
    expect(updated.cardioSchedule).toBe(next);
    expect(updated.name).toBe('Tester');
  });
});
