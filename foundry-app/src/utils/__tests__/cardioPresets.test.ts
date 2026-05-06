/**
 * Tests for the user-saved CardioPreset persistence (Group D / C2) and the
 * CARDIO_WORKOUTS → CardioPreset built-in shape compatibility.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../sync', () => ({
  syncWorkoutToSupabase: vi.fn(),
  syncCardioSessionToSupabase: vi.fn(),
  syncNotesToSupabase: vi.fn(),
  syncCardioPresetToSupabase: vi.fn(),
  deleteCardioPresetRemote: vi.fn(),
}));

import {
  loadCardioPresets,
  saveCardioPreset,
  deleteCardioPreset,
} from '../persistence';
import { CARDIO_WORKOUTS } from '../../data/constants';
import type { CardioPreset } from '../../types';

const STORAGE_KEY = 'foundry:cardio:user-presets';

function fixturePreset(over: Partial<CardioPreset> = {}): CardioPreset {
  return {
    id: 'p1',
    label: 'Sunday Bike',
    intensity: 'moderate',
    modality: 'bike',
    protocol: 'zone2',
    target: { kind: 'duration', minutes: 30 },
    isUserSaved: true,
    ...over,
  };
}

describe('cardio user presets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loadCardioPresets returns [] when storage is empty', () => {
    expect(loadCardioPresets()).toEqual([]);
  });

  it('loadCardioPresets returns [] when storage payload is malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json');
    expect(loadCardioPresets()).toEqual([]);
  });

  it('saveCardioPreset round-trips through localStorage', () => {
    const preset = fixturePreset();
    saveCardioPreset(preset);
    const loaded = loadCardioPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(preset);
  });

  it('saveCardioPreset upserts on matching id', () => {
    saveCardioPreset(fixturePreset());
    saveCardioPreset(fixturePreset({ label: 'Renamed' }));
    const loaded = loadCardioPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].label).toBe('Renamed');
  });

  it('saveCardioPreset appends distinct ids', () => {
    saveCardioPreset(fixturePreset({ id: 'p1', label: 'A' }));
    saveCardioPreset(fixturePreset({ id: 'p2', label: 'B' }));
    expect(loadCardioPresets().map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('deleteCardioPreset removes by id', () => {
    saveCardioPreset(fixturePreset({ id: 'p1' }));
    saveCardioPreset(fixturePreset({ id: 'p2', label: 'B' }));
    deleteCardioPreset('p1');
    const remaining = loadCardioPresets();
    expect(remaining.map((p) => p.id)).toEqual(['p2']);
  });

  it('drops entries that are missing an id or label (defensive)', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'good', label: 'OK', intensity: 'easy', modality: 'walk', protocol: 'liss', target: { kind: 'duration', minutes: 30 }, isUserSaved: true },
        { id: 'no-label' },
        null,
        'string',
      ]),
    );
    const loaded = loadCardioPresets();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('good');
  });
});

// ─── Built-in CARDIO_WORKOUTS now carry CardioPreset fields. Each entry
// must be a valid preset (isUserSaved=false, present typed axes). ───────
describe('CARDIO_WORKOUTS → CardioPreset compatibility', () => {
  const VALID_INTENSITY = new Set(['easy', 'moderate', 'hard']);
  const VALID_MODALITY = new Set([
    'walk', 'run', 'bike', 'row', 'swim', 'stairs', 'elliptical', 'jump_rope', 'other',
  ]);
  const VALID_PROTOCOL = new Set([
    'liss', 'zone2', 'tempo', 'tabata', 'emom', 'sprint_intervals', 'free',
  ]);

  it('every entry is a non-user-saved preset', () => {
    expect(CARDIO_WORKOUTS.length).toBeGreaterThan(0);
    for (const w of CARDIO_WORKOUTS) {
      expect(w.isUserSaved).toBe(false);
    }
  });

  it('every entry has valid axis values', () => {
    for (const w of CARDIO_WORKOUTS) {
      expect(VALID_INTENSITY.has(w.intensity)).toBe(true);
      expect(VALID_MODALITY.has(w.modality)).toBe(true);
      expect(VALID_PROTOCOL.has(w.protocol)).toBe(true);
      expect(w.target.kind).toBe('duration');
      expect(typeof w.target.minutes).toBe('number');
      expect(w.target.minutes).toBeGreaterThan(0);
    }
  });

  it('target.minutes mirrors legacy defaultDuration', () => {
    for (const w of CARDIO_WORKOUTS) {
      expect(w.target.minutes).toBe(w.defaultDuration);
    }
  });
});
