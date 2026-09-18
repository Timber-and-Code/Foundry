/**
 * What an archived meso IS — the rules every archive reader and writer
 * shares. Dependency-free so sync.ts, archive.ts and the aggregators can all
 * import it without a cycle.
 *
 *  1. Logged work is permanent history. Ending a meso early changes its
 *     label, never what is kept.
 *  2. A meso with no logged WORKING sets was a mistake, not history: it is
 *     not archived, not rebuilt from remote, and not shown. (Sets, not
 *     sessions — a session row can exist with nothing in it.)
 *  3. An early-ended meso is shown as such, never passed off as complete.
 *  4. It counts for DATA (exercise history, carryover, PRs) but not for
 *     PROGRESS (meso numbering, completion stats, streaks).
 */

export type ArchiveStatus = 'completed' | 'abandoned';

interface SessionLike {
  w?: number;
  data?: unknown;
}

interface EntryLike {
  id?: unknown;
  status?: string;
  archivedAt?: string | null;
  mesoWeeks?: number;
  mesoDays?: number;
  sessions?: SessionLike[];
}

function sessionHasWork(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return Object.values(data as Record<string, unknown>).some((slice) => {
    if (!slice || typeof slice !== 'object') return false;
    return Object.values(slice as Record<string, unknown>).some((set) => {
      if (!set || typeof set !== 'object') return false; // skips `_exId` stamps
      const s = set as { reps?: unknown; warmup?: unknown };
      return !s.warmup && parseInt(String(s.reps ?? ''), 10) > 0;
    });
  });
}

/** Rule 2: does this meso hold at least one logged working set? */
export function hasLoggedWork(entry: EntryLike | null | undefined): boolean {
  return !!entry?.sessions?.some((s) => sessionHasWork(s?.data));
}

/**
 * Rule 2, for readers. Only an entry whose sessions are KNOWN and hold no
 * work counts as empty — very old entries have no session detail at all and
 * are still real history.
 */
export function isEmptyMeso(entry: EntryLike | null | undefined): boolean {
  return Array.isArray(entry?.sessions) && !hasLoggedWork(entry);
}

/** Weeks with logged work, 1-based count of the furthest one reached. */
export function weeksReached(entry: EntryLike): number {
  let max = -1;
  entry.sessions?.forEach((s) => {
    if (typeof s?.w === 'number' && s.w > max && sessionHasWork(s.data)) max = s.w;
  });
  return max + 1;
}

/**
 * Rule 3/4. Entries written before status existed have none — they came
 * from the end-of-meso flow or an early reset, indistinguishably, so they
 * are treated as completed rather than relabelled on a guess.
 */
export function isEndedEarly(entry: EntryLike): boolean {
  return entry.status === 'abandoned';
}

/**
 * Locally-written entries used a Date.now() id while the remote rebuild keys
 * by meso uuid, so the same meso could land in the archive twice (double
 * counted in Previous Meso Cycles, every `mesosAgo` below it shifted by one).
 * Writers now use the meso uuid; this catches the legacy twins: same UTC day
 * ended, same days/week. Both writers stamp the end date from
 * `new Date().toISOString()`, so the UTC day matches.
 */
export function isLegacyTwin(local: EntryLike, derived: EntryLike): boolean {
  if (!/^\d+$/.test(String(local.id ?? ''))) return false; // only Date.now() ids
  const day = (v: string | null | undefined) => (v ? String(v).slice(0, 10) : '');
  const a = day(local.archivedAt);
  if (!a || a !== day(derived.archivedAt)) return false;
  const localDays = local.mesoDays ?? 0;
  return !localDays || !derived.mesoDays || localDays === derived.mesoDays;
}
