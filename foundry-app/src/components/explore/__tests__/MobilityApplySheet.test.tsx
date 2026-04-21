/**
 * Tests for MobilityApplySheet — ensures day pills toggle, the apply callback
 * fires with the correct next-schedule, and applyMobilityScheduleUpdate
 * produces a new Profile object.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('../../../data/constants', () => ({
  MOBILITY_PROTOCOLS: [
    { id: 'proto-a', name: 'Protocol A' },
    { id: 'proto-b', name: 'Protocol B' },
  ],
}));

vi.mock('../../../styles/tokens', () => ({
  tokens: {
    colors: { overlay: 'rgba(0,0,0,0.5)' },
    radius: { xs: 2, sm: 4, md: 6, lg: 8, xl: 12, xxl: 16, full: 99 },
  },
}));

import MobilityApplySheet, { applyMobilityScheduleUpdate } from '../MobilityApplySheet';
import type { Profile } from '../../../types';

describe('MobilityApplySheet', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders 7 day-of-week pills inside a dialog', () => {
    render(
      <MobilityApplySheet
        protocolId="proto-a"
        protocolLabel="Protocol A"
        schedule={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('calls onApply with the new schedule including every selected DOW', () => {
    const onApply = vi.fn();
    render(
      <MobilityApplySheet
        protocolId="proto-a"
        protocolLabel="Protocol A"
        schedule={[]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Wed' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onApply).toHaveBeenCalledTimes(1);
    const [nextSchedule, addedCount] = onApply.mock.calls[0];
    expect(addedCount).toBe(2);
    expect(nextSchedule).toEqual([
      { dayOfWeek: 1, protocol: 'proto-a' },
      { dayOfWeek: 3, protocol: 'proto-a' },
    ]);
  });

  it('pre-selects days where this protocol is already scheduled and deselects cleanly', () => {
    const onApply = vi.fn();
    render(
      <MobilityApplySheet
        protocolId="proto-a"
        protocolLabel="Protocol A"
        schedule={[
          { dayOfWeek: 1, protocol: 'proto-a' },
          { dayOfWeek: 3, protocol: 'proto-a' },
        ]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Wed' })).toHaveAttribute('aria-pressed', 'true');

    // Deselect Monday, keep Wednesday
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const [nextSchedule, addedCount] = onApply.mock.calls[0];
    expect(addedCount).toBe(0);
    expect(nextSchedule).toEqual([{ dayOfWeek: 3, protocol: 'proto-a' }]);
  });

  it('overwrites conflicting other-protocol slots on selected days', () => {
    const onApply = vi.fn();
    render(
      <MobilityApplySheet
        protocolId="proto-a"
        protocolLabel="Protocol A"
        schedule={[{ dayOfWeek: 2, protocol: 'proto-b' }]}
        onApply={onApply}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    const [nextSchedule] = onApply.mock.calls[0];
    expect(nextSchedule).toEqual([{ dayOfWeek: 2, protocol: 'proto-a' }]);
  });

  it('Apply is disabled until the user makes a change', () => {
    render(
      <MobilityApplySheet
        protocolId="proto-a"
        protocolLabel="Protocol A"
        schedule={[]}
        onApply={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
    expect(screen.getByRole('button', { name: 'Apply' })).toBeEnabled();
  });

  it('Cancel fires onClose', () => {
    const onClose = vi.fn();
    render(
      <MobilityApplySheet
        protocolId="proto-a"
        protocolLabel="Protocol A"
        schedule={[]}
        onApply={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('applyMobilityScheduleUpdate produces a new Profile object with the schedule', () => {
    const profile = { name: 'Tester', age: 30, experience: 'intermediate' } as unknown as Profile;
    const next = [{ dayOfWeek: 1, protocol: 'proto-a' }];
    const updated = applyMobilityScheduleUpdate(profile, next);
    expect(updated).not.toBe(profile);
    expect(updated.mobilitySchedule).toBe(next);
    expect(updated.name).toBe('Tester');
  });
});
