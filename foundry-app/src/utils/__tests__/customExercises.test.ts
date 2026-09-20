import { describe, it, expect, beforeEach } from 'vitest';
import {
  customIdFor,
  customRowFields,
  exerciseDisplayName,
  healCustomNames,
  isCustomId,
  loadCustomExercises,
  readableFromId,
  rememberCustomExercise,
  resolveCustomExercise,
} from '../customExercises';

describe('customExercises', () => {
  beforeEach(() => localStorage.clear());

  it('builds the same id the app has always used', () => {
    expect(customIdFor('  Cable Y-Raise ')).toBe('custom:cable-y-raise');
    expect(isCustomId('custom:cable-y-raise')).toBe(true);
    expect(isCustomId('bb_flat_bench')).toBe(false);
  });

  it('never shows the raw id', () => {
    expect(exerciseDisplayName('custom:cable-y-raise')).toBe('Cable Y Raise');
    expect(exerciseDisplayName('custom:cable-y-raise', 'custom:cable-y-raise')).toBe('Cable Y Raise');
    expect(readableFromId('custom:db-ez-bar-rdl')).toBe('DB EZ Bar RDL');
    expect(readableFromId('custom:')).toBe('Custom exercise');
  });

  it('prefers a known name, then the name typed on this device', () => {
    expect(exerciseDisplayName('bb_flat_bench', 'Barbell Bench Press')).toBe('Barbell Bench Press');
    rememberCustomExercise('custom:cable-y-raise', 'Cable Y-Raise', 'Shoulders');
    expect(exerciseDisplayName('custom:cable-y-raise')).toBe('Cable Y-Raise');
    expect(exerciseDisplayName('custom:cable-y-raise', 'From Server')).toBe('From Server');
  });

  it("doesn't let a server name overwrite what the lifter typed", () => {
    rememberCustomExercise('custom:cable-y-raise', 'Cable Y-Raise', 'Shoulders');
    rememberCustomExercise('custom:cable-y-raise', 'Cable Y Raise');
    expect(loadCustomExercises()['custom:cable-y-raise'].name).toBe('Cable Y-Raise');
  });

  it('replaces a leaked id that was saved as the name', () => {
    localStorage.setItem(
      'foundry:customExercises',
      JSON.stringify({ 'custom:sled-drag': { name: 'custom:sled-drag' } }),
    );
    rememberCustomExercise('custom:sled-drag', 'Sled Drag');
    expect(loadCustomExercises()['custom:sled-drag'].name).toBe('Sled Drag');
  });

  it('resolves a custom id this device has never seen', () => {
    expect(resolveCustomExercise('custom:sled-drag')).toMatchObject({
      id: 'custom:sled-drag',
      name: 'Sled Drag',
      muscle: 'other',
    });
    expect(resolveCustomExercise('bb_flat_bench')).toBeNull();
  });

  it('gives setup-created records an id (they were saved without one)', () => {
    localStorage.setItem(
      'foundry:customExercises',
      JSON.stringify({ 'custom:sled-drag': { name: 'Sled Drag', muscle: 'Quads' } }),
    );
    expect(resolveCustomExercise('custom:sled-drag')).toEqual({
      id: 'custom:sled-drag',
      name: 'Sled Drag',
      muscle: 'Quads',
    });
  });

  it('writes name + muscle on custom rows only', () => {
    expect(customRowFields({ id: 'bb_flat_bench', name: 'Barbell Bench Press' })).toEqual({
      custom_name: null,
      custom_muscle: null,
    });
    expect(customRowFields({ id: 'custom:sled-drag', name: 'Sled Drag', muscle: 'Quads' })).toEqual({
      custom_name: 'Sled Drag',
      custom_muscle: 'Quads',
    });
    // A program already poisoned with the id as its name still sends a real one.
    expect(customRowFields({ id: 'custom:sled-drag', name: 'custom:sled-drag' }).custom_name).toBe('Sled Drag');
  });

  it('heals a stored program and leaves clean days untouched', () => {
    const clean = { exercises: [{ id: 'bb_flat_bench', name: 'Barbell Bench Press' }] };
    const dirty = { exercises: [{ id: 'custom:sled-drag', name: 'custom:sled-drag' }, clean.exercises[0]] };
    const out = healCustomNames([clean, dirty]);
    expect(out[0]).toBe(clean);
    expect(out[1].exercises[0].name).toBe('Sled Drag');
    expect(out[1].exercises[1]).toBe(clean.exercises[0]);
  });
});
