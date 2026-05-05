/**
 * Tests for CardioDesigner cross-axis rules + save-as-preset round-trip
 * (Group D / C2).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../../utils/sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
}));

import CardioDesigner, {
  reconcileComposition,
  describeCardioComp,
  DEFAULT_CARDIO_COMP,
} from '../CardioDesigner';
import { loadCardioPresets } from '../../../utils/persistence';

describe('reconcileComposition', () => {
  it('returns the comp unchanged when valid', () => {
    const c = { ...DEFAULT_CARDIO_COMP };
    expect(reconcileComposition(c)).toEqual(c);
  });

  it('clamps Tabata duration to a multiple of 4 (snap to 4 if invalid)', () => {
    const c = reconcileComposition({
      intensity: 'hard',
      modality: 'bike',
      protocol: 'tabata',
      duration: 45, // not in TABATA_DURATIONS
    });
    expect(c.duration).toBe(4);
  });

  it('keeps a valid Tabata duration', () => {
    const c = reconcileComposition({
      intensity: 'hard',
      modality: 'bike',
      protocol: 'tabata',
      duration: 12,
    });
    expect(c.duration).toBe(12);
  });

  it('coerces Swim+Tabata to Swim+Zone 2', () => {
    const c = reconcileComposition({
      intensity: 'moderate',
      modality: 'swim',
      protocol: 'tabata',
      duration: 8,
    });
    expect(c.protocol).toBe('zone2');
    expect(c.duration).toBe(30); // zone2 default
  });

  it('snaps invalid duration to the protocol default', () => {
    const c = reconcileComposition({
      intensity: 'easy',
      modality: 'walk',
      protocol: 'liss',
      duration: 7, // not in STANDARD_DURATIONS
    });
    expect(c.duration).toBe(45); // liss default
  });
});

describe('describeCardioComp', () => {
  it('formats the Bebas-cased composition line', () => {
    const { line } = describeCardioComp({
      intensity: 'moderate',
      modality: 'bike',
      protocol: 'zone2',
      duration: 30,
    });
    expect(line).toBe('MODERATE · BIKE · ZONE 2 · 30 MIN');
  });

  it('uses customLabel for Other modality when present', () => {
    const { line } = describeCardioComp({
      intensity: 'easy',
      modality: 'other',
      modalityCustom: 'Spin Class',
      protocol: 'free',
      duration: 30,
    });
    expect(line).toContain('SPIN CLASS');
  });
});

describe('CardioDesigner — cross-axis interactions', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('selecting Tabata after a 45-min LISS clamps duration to 4', () => {
    render(
      <CardioDesigner
        initial={{ intensity: 'easy', modality: 'walk', protocol: 'liss', duration: 45 }}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    // Open PROTOCOL axis
    const protocolBtn = screen.getByRole('button', { name: /PROTOCOL/i });
    fireEvent.click(protocolBtn);
    // Tap Tabata
    const tabataOpt = screen.getByRole('button', { name: /Tabata/i });
    fireEvent.click(tabataOpt);
    // Re-read the preview line — should now show 4 MIN.
    expect(screen.getByText(/TABATA · 4 MIN/i)).toBeTruthy();
  });

  it('switching protocol resets duration to that protocol default when current is invalid', () => {
    render(
      <CardioDesigner
        initial={{ intensity: 'hard', modality: 'bike', protocol: 'tabata', duration: 8 }}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    // Open protocol, pick LISS — 8 isn't in STANDARD_DURATIONS so it
    // should snap to 45 (LISS default).
    fireEvent.click(screen.getByRole('button', { name: /PROTOCOL/i }));
    fireEvent.click(screen.getByRole('button', { name: /^LISS/i }));
    expect(screen.getByText(/LISS · 45 MIN/i)).toBeTruthy();
  });

  it('preserves duration across protocol switch when the new protocol allows it', () => {
    render(
      <CardioDesigner
        initial={{ intensity: 'moderate', modality: 'bike', protocol: 'zone2', duration: 20 }}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    // 20 is in STANDARD_DURATIONS — switching to Tempo keeps 20.
    fireEvent.click(screen.getByRole('button', { name: /PROTOCOL/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Tempo/i }));
    expect(screen.getByText(/TEMPO · 20 MIN/i)).toBeTruthy();
  });

  it('save-as-preset round-trips through localStorage', () => {
    render(
      <CardioDesigner
        initial={{ intensity: 'moderate', modality: 'bike', protocol: 'zone2', duration: 30 }}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    // Open the save UI
    fireEvent.click(screen.getByRole('button', { name: /Save as preset/i }));
    const labelInput = screen.getByLabelText('Preset name');
    fireEvent.change(labelInput, { target: { value: 'Sunday Bike' } });
    fireEvent.click(screen.getByRole('button', { name: 'SAVE' }));

    const all = loadCardioPresets();
    expect(all).toHaveLength(1);
    expect(all[0].label).toBe('Sunday Bike');
    expect(all[0].intensity).toBe('moderate');
    expect(all[0].modality).toBe('bike');
    expect(all[0].protocol).toBe('zone2');
    expect(all[0].target).toEqual({ kind: 'duration', minutes: 30 });
    expect(all[0].isUserSaved).toBe(true);
    expect(all[0].id).toMatch(/^usr_/);
  });

  it('Done button is disabled when modality=Other has no customLabel', () => {
    render(
      <CardioDesigner
        initial={{
          intensity: 'easy',
          modality: 'other',
          modalityCustom: '',
          protocol: 'free',
          duration: 30,
        }}
        onClose={() => {}}
        onDone={() => {}}
      />,
    );
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done.getAttribute('aria-disabled')).toBe('true');
  });
});

describe('CardioDesigner — done callback', () => {
  it('passes the reconciled composition back to the caller', () => {
    const onDone = vi.fn();
    render(
      <CardioDesigner
        initial={{ intensity: 'moderate', modality: 'run', protocol: 'zone2', duration: 30 }}
        onClose={() => {}}
        onDone={onDone}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone.mock.calls[0][0]).toMatchObject({
      intensity: 'moderate',
      modality: 'run',
      protocol: 'zone2',
      duration: 30,
    });
  });
});

// ─── helper to make TS happy when probing the rendered DOM hierarchy ──
// (`within` is imported but currently unused — keep available for future
// scope-narrowing tests without forcing a re-import.)
void within;
