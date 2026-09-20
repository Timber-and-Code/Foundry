import { store } from './storage.js';

/**
 * Custom exercises — lifts the user typed in because the library didn't have
 * them. Their id is `custom:<slug>`; that id is a storage key and must NEVER
 * reach the screen. Every surface resolves a name through here:
 *
 *   library name → the name the lifter typed → a readable form of the slug
 *
 * The typed name is kept in `foundry:customExercises` on the device that
 * created it and travels with the program row (`custom_name`, migration
 * 015), so other devices and shared-meso members get the real name too. The
 * slug fallback covers rows written before that existed.
 */

const KEY = 'foundry:customExercises';
const PREFIX = 'custom:';
export const CUSTOM_NAME_MAX = 80;

export interface CustomExercise {
  id: string;
  name: string;
  muscle?: string;
  muscles?: string[];
  equipment?: string | string[];
  tag?: string;
  sets?: number | string;
  reps?: number | string;
  rest?: string;
  warmup?: string;
  pattern?: string;
  description?: string;
  videoUrl?: string;
  bw?: boolean;
}

export function isCustomId(id: unknown): id is string {
  return typeof id === 'string' && id.startsWith(PREFIX);
}

export function customIdFor(name: string): string {
  return `${PREFIX}${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

// Short words that read wrong title-cased ("Db Row", "Ez Bar Curl").
const UPPER = new Set(['db', 'bb', 'kb', 'ez', 'rdl', 'sldl', 'ohp', 'ghr', 'trx', 'bw', 'jm']);

/** `custom:cable-y-raise` → `Cable Y Raise`. Last resort, never the raw id. */
export function readableFromId(id: string): string {
  const slug = (isCustomId(id) ? id.slice(PREFIX.length) : id).replace(/[-_]+/g, ' ').trim();
  if (!slug) return 'Custom exercise';
  return slug
    .split(' ')
    .map((w) => (UPPER.has(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

export function loadCustomExercises(): Record<string, CustomExercise> {
  try {
    const parsed = JSON.parse(store.get(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * A usable record for ANY custom id — even one this device has never seen
 * (a shared-meso member, a reinstall). Null for library ids.
 */
export function resolveCustomExercise(id: unknown): CustomExercise | null {
  if (!isCustomId(id)) return null;
  const saved = loadCustomExercises()[id];
  return { muscle: 'other', ...saved, id, name: exerciseDisplayName(id, saved?.name) };
}

/**
 * Record a custom exercise's name on this device. Never downgrades: a name
 * the lifter typed here beats one derived elsewhere, and existing fields
 * (sets, reps, tag…) are kept.
 */
export function rememberCustomExercise(id: string, name: string, muscle?: string): void {
  if (!isCustomId(id)) return;
  const trimmed = (name || '').trim();
  if (!trimmed || isCustomId(trimmed)) return;
  const all = loadCustomExercises();
  const prev = all[id];
  if (prev?.name && !isCustomId(prev.name)) {
    if (muscle && !prev.muscle) {
      all[id] = { ...prev, muscle };
      store.set(KEY, JSON.stringify(all));
    }
    return;
  }
  all[id] = { ...prev, id, name: trimmed, muscle: muscle || prev?.muscle || 'other' };
  store.set(KEY, JSON.stringify(all));
}

/**
 * The name to SHOW for an exercise id. `known` is whatever name the caller
 * already has (library, program row, server) — used unless it's empty or is
 * itself a leaked id.
 */
export function exerciseDisplayName(id: string, known?: string | null): string {
  const k = (known || '').trim();
  if (k && !isCustomId(k) && k !== id) return k;
  if (!isCustomId(id)) return k || id;
  const saved = loadCustomExercises()[id]?.name;
  if (saved && !isCustomId(saved)) return saved;
  return readableFromId(id);
}

/** Columns for a `training_day_exercises` row. Both null for library lifts. */
export function customRowFields(ex: { id?: unknown; name?: unknown; muscle?: unknown }): {
  custom_name: string | null;
  custom_muscle: string | null;
} {
  if (!isCustomId(ex.id)) return { custom_name: null, custom_muscle: null };
  const name = exerciseDisplayName(ex.id, typeof ex.name === 'string' ? ex.name : null);
  const muscle =
    (typeof ex.muscle === 'string' && ex.muscle) || loadCustomExercises()[ex.id]?.muscle || null;
  return {
    custom_name: name.slice(0, CUSTOM_NAME_MAX),
    custom_muscle: muscle ? String(muscle).slice(0, 40) : null,
  };
}

/**
 * Repair a program whose custom lifts were saved with the id as their name
 * (every pull before migration 015 did this). Returns the same objects when
 * nothing needs fixing, so memoised consumers don't churn.
 */
export function healCustomNames<D extends { exercises?: Array<{ id?: unknown; name?: unknown }> }>(
  days: D[],
): D[] {
  return days.map((day) => {
    const exs = day.exercises || [];
    const broken = exs.some((e) => isCustomId(e.id) && (!e.name || isCustomId(e.name)));
    if (!broken) return day;
    return {
      ...day,
      exercises: exs.map((e) =>
        isCustomId(e.id) ? { ...e, name: exerciseDisplayName(e.id, e.name as string) } : e,
      ),
    };
  });
}
