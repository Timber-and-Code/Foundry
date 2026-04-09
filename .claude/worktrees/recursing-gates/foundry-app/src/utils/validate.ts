// ─── SCHEMA VALIDATORS FOR LOCALSTORAGE READS ────────────────────────────────

import type { Profile, DayData, WorkoutSet, MesoConfig, SplitType, ArchiveEntry } from '../types';

const VALID_SPLITS: SplitType[] = ['ppl', 'upper_lower', 'full_body', 'push_pull'];

export function validateProfile(data: unknown): Profile | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.warn('[Foundry] validateProfile: invalid data shape', data);
    return null;
  }
  const d = data as Record<string, unknown>;
  if (typeof d.experience !== 'string') {
    console.warn('[Foundry] validateProfile: missing required experience field', data);
    return null;
  }
  return d as unknown as Profile;
}

export function validateDayData(data: unknown): DayData {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {};
  }
  const raw = data as Record<string, unknown>;
  const cleaned: DayData = {};
  for (const exIdx of Object.keys(raw)) {
    const sets = raw[exIdx];
    if (!sets || typeof sets !== 'object' || Array.isArray(sets)) continue;
    const setsMap = sets as Record<string, unknown>;
    cleaned[exIdx] = {};
    for (const setIdx of Object.keys(setsMap)) {
      const s = setsMap[setIdx];
      if (!s || typeof s !== 'object' || Array.isArray(s)) continue;
      const set = s as Record<string, unknown>;
      cleaned[exIdx][setIdx] = {
        ...set,
        weight: !isNaN(parseFloat(set.weight as string)) ? (set.weight as number) : 0,
        reps: !isNaN(parseInt(set.reps as string, 10)) ? (set.reps as number) : 0,
      } as WorkoutSet;
    }
  }
  return cleaned;
}

export function validateMesoConfig(data: unknown): MesoConfig {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    console.warn('[Foundry] validateMesoConfig: invalid data shape', data);
    return { days: 4, weeks: 6, split: 'ppl' };
  }
  const d = data as Record<string, unknown>;
  const days = Number(d.days);
  const weeks = Number(d.weeks);
  const split = d.split as string;
  return {
    ...d,
    days: days >= 2 && days <= 6 ? days : 4,
    weeks: weeks >= 4 && weeks <= 8 ? weeks : 6,
    split: VALID_SPLITS.includes(split as SplitType) ? (split as SplitType) : 'ppl',
  } as MesoConfig;
}

export function validateArchive(data: unknown): ArchiveEntry[] {
  if (!Array.isArray(data)) {
    console.warn('[Foundry] validateArchive: expected array', data);
    return [];
  }
  return data.filter((entry): entry is ArchiveEntry => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    if ((entry as Record<string, unknown>).id == null) return false;
    return true;
  });
}
