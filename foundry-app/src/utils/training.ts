import { store } from './storage';
import { validateProfile } from './validate';
import { syncProfileToSupabase, syncBodyWeightToSupabase, syncMesocycleToSupabase, ensureTrainingStructureRemote } from './sync';
import type {
  Profile,
  Exercise,
  MesoConfig,
  BodyWeightEntry,
  WorkoutDaysHistoryEntry,
} from '../types';

// ─── WARMUP TYPES ────────────────────────────────────────────────────────────

export interface WarmupStep {
  label: string;
  reps: string;
  detail: string;
}

export interface WarmupDetail {
  title: string;
  rationale: string;
  steps: { label: string; detail: string }[];
}

export interface SparklinePoint {
  week: number;
  bestWeight: number;
  bestReps: number;
  e1rm: number;
}

// ─── FUNCTIONS ───────────────────────────────────────────────────────────────

/**
 * Adjust base sets according to training phase.
 * Deload weeks always get 2 sets.
 * Early weeks (MEV phase) get reduced sets.
 * Peak weeks (MRV approach) get extra sets.
 */
export function getWeekSets(baseSets: number, weekIdx: number, mesoLength: number): number {
  if (weekIdx >= mesoLength - 1) return 2; // deload — always 2
  const workingWeeks = mesoLength - 1;
  const third = Math.floor(workingWeeks / 3);
  if (weekIdx < third) return Math.max(2, baseSets - 1); // MEV phase
  if (weekIdx < workingWeeks - third) return baseSets; // MAV phase
  return baseSets + 1; // MRV approach
}

/**
 * Generate warmup steps for an exercise based on equipment and protocol.
 * Returns array of { label, reps, detail } objects describing each warmup set.
 */
export function generateWarmupSteps(
  exercise: Exercise,
  workingWeight: number | string,
): WarmupStep[] | null {
  const w = parseFloat(String(workingWeight));
  const hasWeight = !isNaN(w) && w > 0;
  const equip = exercise.equipment || '';
  const isBarbell = equip === 'barbell';
  const isBW = !!exercise.bw;
  const warmupStr = (exercise.warmup || '').trim();
  const isShort = warmupStr.includes('time is tight');
  const isFeeler = warmupStr === '1 feeler set';
  const isLightFeeler = warmupStr === '1 light feeler set';
  const isFullProtocol = warmupStr === 'Full protocol' || warmupStr === 'Full Protocol';

  function round(lbs: number, increment: number): number {
    return Math.round(lbs / increment) * increment;
  }
  function lbl(pct: number, increment: number): string {
    if (!hasWeight) return `${pct}% of working weight`;
    const rounded = round(w * (pct / 100), increment);
    return `${rounded} lbs  (${pct}%)`;
  }

  if (isBW) return null;

  // Barbell full protocol (4 steps)
  if (isBarbell && isFullProtocol && !isShort) {
    return [
      {
        label: 'Bar only  (0%)',
        reps: '10 reps',
        detail:
          'Zero load. Pure movement rehearsal. Groove the pattern, set foot position, brace practice.',
      },
      {
        label: lbl(50, 5),
        reps: '5 reps',
        detail: 'Controlled tempo. Dial in bar path. If anything feels off, fix it here.',
      },
      {
        label: lbl(70, 5),
        reps: '3 reps',
        detail: 'Approaching working weight. Full intent on each rep. Brace hard.',
      },
      {
        label: lbl(85, 5),
        reps: '1 rep',
        detail:
          'Final primer. Should feel heavy but fast. Rest 2–3 min after this before your first working set.',
      },
    ];
  }

  // Barbell short ramp (2 steps, time-limited)
  if (isBarbell && isShort) {
    return [
      {
        label: lbl(60, 5),
        reps: '5 reps',
        detail: 'Crisp technique, full range of motion. Get blood moving and the pattern dialed.',
      },
      {
        label: lbl(80, 5),
        reps: '2 reps',
        detail: 'Close to working weight. Final primer. Rest 90 seconds then go.',
      },
    ];
  }

  // 1 feeler set (medium accessories — DB, cable, machine)
  if (isFeeler) {
    return [
      {
        label: lbl(65, 2.5),
        reps: '8–10 reps',
        detail:
          'Comfortable pace. Focus on feel and range of motion. Finish thinking the movement feels easy, then rest 45–60 sec before your first working set.',
      },
    ];
  }

  // 1 light feeler set (isolation exercises)
  if (isLightFeeler) {
    return [
      {
        label: lbl(50, 2.5),
        reps: '12–15 reps',
        detail:
          'Weight should feel noticeably light — focus on the muscle contracting, not the load. No rest needed, go straight to working weight.',
      },
    ];
  }

  // 2 ramp sets (DB compounds, KB, other non-barbell anchors)
  return [
    {
      label: lbl(40, 2.5),
      reps: '10 reps',
      detail: 'Light load, full range of motion. Wake up the joint and prime the pattern.',
    },
    {
      label: lbl(65, 2.5),
      reps: '5 reps',
      detail:
        'Moderate load. Confirm the weight feels right before you commit to your working sets.',
    },
  ];
}

/**
 * Return warmup protocol details with rationale and step-by-step breakdown.
 * Used by the Warm-up modal in ExerciseCard.
 */
export function getWarmupDetail(warmupStr: string | undefined, _exerciseName: string): WarmupDetail {
  const str = (warmupStr || '').trim();

  if (str === 'Full protocol' || str === 'Full Protocol') {
    return {
      title: 'Full Ramp Protocol',
      rationale:
        'Barbell compounds demand progressive neural activation. Each set primes the CNS, grooves bar path, and lets joints acclimate to load before your working weight. Skipping this is the fastest way to a bad rep at a heavy weight.',
      steps: [
        {
          label: 'Bar only',
          detail:
            '10 reps — zero load. Focus entirely on technique. Feel the groove, reinforce bracing, set your foot position. This is a movement rehearsal, not a warm-up set.',
        },
        {
          label: '50% of working weight',
          detail:
            '5 reps — controlled tempo. Dial in bar path and confirm your setup feels right. If anything feels off, fix it here.',
        },
        {
          label: '70% of working weight',
          detail:
            '3 reps — approaching working weight. Brace hard, full intent on each rep. Tempo slows down naturally — let it.',
        },
        {
          label: '85% of working weight',
          detail:
            '1 rep — final primer. This should feel heavy but fast. Rest 2–3 minutes after this before your first working set.',
        },
      ],
    };
  }

  if (str === '2 ramp sets — time is tight, be thorough') {
    return {
      title: 'Abbreviated Ramp',
      rationale:
        "With limited time, cut volume but not quality. Two ramp sets hit the minimum viable activation for a compound lift. Don't rush the reps themselves.",
      steps: [
        {
          label: '60% of working weight',
          detail:
            '5 reps — crisp technique, full range of motion. Get blood moving and the pattern dialed.',
        },
        {
          label: '80% of working weight',
          detail:
            '2 reps — close to working weight. This is your final primer. Rest 90 seconds then go.',
        },
      ],
    };
  }

  if (str === '2 ramp sets') {
    return {
      title: '2 Ramp Sets',
      rationale:
        'Dumbbell and kettlebell compound movements need joint priming and pattern rehearsal before working weight. Two ramp sets bring blood into the target muscles and let you confirm the weight feels right — without draining the working sets.',
      steps: [
        {
          label: '40% of working weight',
          detail:
            '10 reps — light load, full range of motion. Wake up the joint and prime the movement pattern.',
        },
        {
          label: '65% of working weight',
          detail:
            '5 reps — moderate load. Confirm the weight and feel before committing to working sets. Rest 60–90 sec then go.',
        },
      ],
    };
  }

  // Default empty object for unknown warmup types
  return { title: 'Warmup', rationale: '', steps: [] };
}

/**
 * Fisher-Yates shuffle for array randomization.
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function loadBwLog(): BodyWeightEntry[] {
  try {
    return JSON.parse(store.get('foundry:bwlog') || '[]') as BodyWeightEntry[];
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load body weight log', e);
    return [];
  }
}

export function saveBwLog(entries: BodyWeightEntry[]): void {
  store.set('foundry:bwlog', JSON.stringify(entries));
}

export function addBwEntry(weight: number | string): BodyWeightEntry[] {
  const date = new Date().toISOString().slice(0, 10);
  const entries = loadBwLog().filter((e) => e.date !== date);
  entries.unshift({ date, weight: parseFloat(String(weight)) });
  if (entries.length > 52) entries.length = 52;
  saveBwLog(entries);
  syncBodyWeightToSupabase(date, parseFloat(String(weight)));
  return entries;
}

export function bwLoggedThisWeek(): boolean {
  const entries = loadBwLog();
  if (!entries.length) return false;
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(0, 0, 0, 0);
  return entries.some((e) => new Date(e.date) >= sunday);
}

export function currentWeekSundayStr(): string {
  const now = new Date();
  const s = new Date(now);
  s.setDate(now.getDate() - now.getDay());
  s.setHours(0, 0, 0, 0);
  return s.toISOString().slice(0, 10);
}

export function markBwPromptShown(): void {
  store.set('foundry:bwPromptSunday', currentWeekSundayStr());
}

export function bwPromptShownThisWeek(): boolean {
  return store.get('foundry:bwPromptSunday') === currentWeekSundayStr();
}

export function saveSessionDuration(dayIdx: number, weekIdx: number, minutes: number): void {
  store.set(`foundry:sess:lift:d${dayIdx}:w${weekIdx}`, String(Math.round(minutes)));
}

export function loadSessionDuration(dayIdx: number, weekIdx: number): number | null {
  const v = store.get(`foundry:sess:lift:d${dayIdx}:w${weekIdx}`);
  return v !== null ? parseInt(v) : null;
}

export function loadSparklineData(
  dayIdx: number,
  exIdx: number,
  mesoWeeks: number = 7,
): SparklinePoint[] {
  const weeks = mesoWeeks;
  const pts: SparklinePoint[] = [];
  for (let w = 0; w < weeks; w++) {
    const raw = store.get(`foundry:day${dayIdx}:week${w}`);
    if (!raw) continue;
    try {
      const exData = (JSON.parse(raw) as Record<string, Record<string, { warmup?: boolean; weight?: string; reps?: string }>>)[exIdx] || {};
      let bestWeight = 0,
        bestReps = 0;
      Object.values(exData).forEach((s) => {
        if (!s || s.warmup) return;
        const wt = parseFloat(s.weight || '0') || 0;
        const rp = parseInt(s.reps || '0') || 0;
        if (wt > bestWeight) {
          bestWeight = wt;
          bestReps = rp;
        }
      });
      if (bestWeight > 0 || bestReps > 0) {
        const e1rm =
          bestWeight > 0 && bestReps > 0
            ? Math.round(bestWeight * (1 + bestReps / 30))
            : bestWeight || 0;
        pts.push({ week: w, bestWeight, bestReps, e1rm });
      }
    } catch (e) {
      console.warn('[Foundry]', 'Failed to parse sparkline week data', e);
    }
  }
  return pts;
}

export function loadCurrentWeek(): number {
  const v = store.get('foundry:currentWeek');
  return v !== null ? parseInt(v) : 0;
}

export function saveCurrentWeek(w: number): void {
  store.set('foundry:currentWeek', String(w));
}

export function loadCompleted(mesoConfig: MesoConfig | null | undefined): Set<string> {
  const done = new Set<string>();
  const days = mesoConfig?.days || 6;
  const weeks = mesoConfig?.weeks || 6;
  for (let d = 0; d < days; d++)
    for (let w = 0; w < weeks; w++)
      if (store.get(`foundry:done:d${d}:w${w}`) === '1') done.add(`${d}:${w}`);
  return done;
}

export function markComplete(dayIdx: number, weekIdx: number): void {
  store.set(`foundry:done:d${dayIdx}:w${weekIdx}`, '1');
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  store.set(`foundry:completedDate:d${dayIdx}:w${weekIdx}`, dateStr);
}

export function loadProfile(): Profile | null {
  const raw = store.get('foundry:profile');
  return raw ? validateProfile(JSON.parse(raw)) : null;
}

export function saveProfile(profile: Profile): void {
  store.set('foundry:profile', JSON.stringify(profile));
  // Sync order matters: mesocycle must exist before user_profiles
  // (active_meso_id FK), and training_days/training_day_exercises must
  // wait for the mesocycle too (meso_id FK). Chain via .then so the
  // writes sequence correctly even though saveProfile itself stays
  // synchronous to its callers.
  syncMesocycleToSupabase(profile)
    .then(() => syncProfileToSupabase(profile))
    .then(() => {
      if (typeof window === 'undefined') return;
      const mesoId = localStorage.getItem('foundry:active_meso_id');
      if (!mesoId) return;
      return ensureTrainingStructureRemote(mesoId, profile);
    });
}

export function isSkipped(dayIdx: number, weekIdx: number): boolean {
  return store.get(`foundry:skip:d${dayIdx}:w${weekIdx}`) === '1';
}

export function setSkipped(dayIdx: number, weekIdx: number, val: boolean): void {
  if (val) store.set(`foundry:skip:d${dayIdx}:w${weekIdx}`, '1');
  else {
    try {
      localStorage.removeItem(`foundry:skip:d${dayIdx}:w${weekIdx}`);
    } catch (e) {
      console.warn('[Foundry]', 'Failed to remove skip key', e);
    }
  }
}

export function getWorkoutDaysForWeek(
  profile: Profile | null | undefined,
  weekIdx: number,
): number[] {
  const history = profile?.workoutDaysHistory;
  if (!history || history.length === 0) return profile?.workoutDays || [];
  let best: WorkoutDaysHistoryEntry | null = null;
  for (const entry of history) {
    if (entry.fromWeek <= weekIdx) {
      if (!best || entry.fromWeek >= best.fromWeek) best = entry;
    }
  }
  return best ? best.days : profile?.workoutDays || [];
}

export function ensureWorkoutDaysHistory(profile: Profile): Profile {
  if (profile?.workoutDaysHistory?.length && profile.workoutDaysHistory.length > 0) return profile;
  const days = profile?.workoutDays || [];
  return { ...profile, workoutDaysHistory: [{ fromWeek: 0, days }] };
}

interface Dob {
  month?: string | number;
  day?: string | number;
  year?: string | number;
}

export function ageFromDob(dob: Dob | null | undefined): number | null {
  if (!dob || !dob.month || !dob.day || !dob.year) return null;
  const m = parseInt(String(dob.month), 10);
  const d = parseInt(String(dob.day), 10);
  const y = parseInt(String(dob.year), 10);
  if (isNaN(m) || isNaN(d) || isNaN(y) || y < 1900 || y > new Date().getFullYear()) return null;
  const today = new Date();
  let age = today.getFullYear() - y;
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age--;
  return age >= 0 ? age : null;
}

// ─── ACCOUNT TIER RESOLUTION ────────────────────────────────────────────────

interface TierResult {
  tier: 'free' | 'pro' | 'trainer';
  reason: 'student' | 'under_18' | 'senior' | 'subscription' | null;
  qualifiesForFree: boolean;
}

/**
 * Resolve the user's account tier from their profile.
 * Free tier: students (.edu verified), under 18, or 62+.
 * Pro/Trainer: future subscription (not yet implemented).
 * Returns the effective tier and the reason for free qualification.
 */
export function resolveAccountTier(profile: {
  birthdate?: string;
  isStudent?: boolean;
  studentEmail?: string;
} | null | undefined): TierResult {
  if (!profile) return { tier: 'free', reason: null, qualifiesForFree: false };

  // Check age-based free tier
  if (profile.birthdate) {
    const parts = profile.birthdate.split('-');
    if (parts.length === 3) {
      const age = ageFromDob({ year: parts[0], month: parts[1], day: parts[2] });
      if (age !== null) {
        if (age < 18) return { tier: 'free', reason: 'under_18', qualifiesForFree: true };
        if (age >= 62) return { tier: 'free', reason: 'senior', qualifiesForFree: true };
      }
    }
  }

  // Check student status
  if (profile.isStudent && profile.studentEmail) {
    return { tier: 'free', reason: 'student', qualifiesForFree: true };
  }

  // Default: free tier (no subscription system yet)
  // When subscriptions are wired up, this will check payment status
  // and return 'pro' or 'trainer' for paying users.
  return { tier: 'free', reason: null, qualifiesForFree: false };
}

/**
 * Validate a .edu email address for student verification.
 * Returns true if the email ends with .edu (case-insensitive).
 */
export function isEduEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 4 && trimmed.endsWith('.edu');
}

export function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  return 'Good evening';
}
