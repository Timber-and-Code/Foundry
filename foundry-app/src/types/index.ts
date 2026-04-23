// ─── CORE DOMAIN TYPES ────────────────────────────────────────────────────────

export interface WorkoutSet {
  weight: number | string;
  reps: number | string;
  rpe?: number | string;
  confirmed?: boolean;
  warmup?: boolean;
  suggested?: boolean;
  repsSuggested?: boolean;
}

/** { [exerciseIndex]: { [setIndex]: WorkoutSet } } */
export type DayData = Record<string, Record<string, WorkoutSet>>;

export interface Exercise {
  id?: string | number;
  name: string;
  muscle: string;
  equipment?: string | string[];
  anchor?: boolean;
  sets?: number | string;
  reps?: number | string;
  rest?: string;
  warmup?: string;
  bw?: boolean;
  supersetWith?: number;
  progression?: string;
  modifier?: string;
  description?: string;
  howTo?: string;
  videoUrl?: string;
  tag?: string;
  muscles?: string[];
  pattern?: string;
  cardio?: boolean;
}

export interface TrainingDay {
  label?: string;
  exercises: Exercise[];
  type?: string;
  isRest?: boolean;
  isCardio?: boolean;
  tag?: string;
  name?: string;
  dayNum?: number;
  muscles?: string;
  note?: string;
  cardio?: unknown;
}

// ─── ACCOUNT TIER ───────────────────────────────────────────────────────────

export type AccountTier = 'free' | 'pro' | 'trainer';

export type FreeTierReason = 'student' | 'under_18' | 'senior';

// ─── PROFILE ─────────────────────────────────────────────────────────────────

export interface WorkoutDaysHistoryEntry {
  fromWeek: number;
  days: number[];
}

export interface Profile {
  name?: string;
  age?: number | string;
  gender?: string;
  weight?: number | string;
  experience: string;
  goal?: string;
  splitType?: string;
  daysPerWeek?: number;
  workoutDays?: number[];
  mesoLength?: number;
  startDate?: string;
  equipment?: string | string[];
  sessionDuration?: number | string;
  autoBuilt?: boolean;
  aiDays?: TrainingDay[];
  manualDayExercises?: Record<string, Exercise[]>;
  manualDayPairs?: Record<string, [number, number][]>;
  manualCardioDays?: number[];
  workoutDaysHistory?: WorkoutDaysHistoryEntry[];
  birthdate?: string;
  cardioSchedule?: CardioScheduleSlot[];
  mobilitySchedule?: MobilityScheduleSlot[];
  addedDayExercises?: Record<string, Exercise[]>;
  dayMuscleConfig?: Record<number, { primary: string[]; accessory: string[] }>;
  pplLegBalance?: boolean;
  theme?: string;
  goalNote?: string;
  isStudent?: boolean;
  studentEmail?: string;
  studentVerifiedAt?: string;
  /**
   * Per-date session remap for the interactive Schedule tab. Keys are the
   * ORIGINAL (source) date strings (YYYY-MM-DD) produced by the base
   * schedule walk; values point at the target date plus the sessionKey
   * "dayIdx:weekIdx" so we can tell which session moved when a day ends
   * up double-booked.
   */
  scheduleOverrides?: Record<string, { to: string; sessionKey: string }>;
}

// ─── CARDIO ─────────────────────────────────────────────────────────────────

export interface CardioScheduleSlot {
  dayOfWeek: number;
  protocol: string;
}

export interface CardioSession {
  completed?: boolean;
  type?: string;
  duration?: number | string;
  intensity?: string;
  protocolId?: string;
  startedAt?: number | string;
  data?: Record<string, unknown>;
}

// ─── MOBILITY ───────────────────────────────────────────────────────────────

/**
 * A scheduled mobility protocol for a specific day of the week. Mirrors the
 * CardioScheduleSlot shape so sync / calendar rendering plumbing stays
 * parallel. Local-only today (not synced to Supabase); follow the same
 * pattern as cardioSchedule.
 */
export interface MobilityScheduleSlot {
  dayOfWeek: number;
  protocol: string;
}

// ─── MESO CONFIG ─────────────────────────────────────────────────────────────

export type SplitType = 'ppl' | 'upper_lower' | 'full_body' | 'push_pull';

export interface MesoConfig {
  days: number;
  weeks: number;
  split?: SplitType;
  splitType?: string;
  phases?: string[];
  rirs?: (number | string)[];
  mesoRows?: [number | null, string, string, string][];
  progTargets?: { weight: string[]; reps: string[] };
}

// ─── READINESS ───────────────────────────────────────────────────────────────

export interface ReadinessEntry {
  sleep?: 'poor' | 'ok' | 'good';
  soreness?: 'high' | 'moderate' | 'low';
  energy?: 'low' | 'moderate' | 'high';
}

// ─── BODY WEIGHT ─────────────────────────────────────────────────────────────

export interface BodyWeightEntry {
  date: string;
  weight: number;
}

// ─── ARCHIVE ─────────────────────────────────────────────────────────────────

export interface ArchiveEntry {
  id: number | string;
  profile?: Partial<Profile> & Record<string, unknown>;
  builtBy?: 'ai' | 'manual';
  completedAt?: string;
  weeks?: number;
  date?: string;
}

// ─── SOCIAL (Train with Friends) ────────────────────────────────────────────

/**
 * Privacy level a member exposes on a shared mesocycle.
 *  - `full`  — completion status + workout sets (weight/reps/RPE) + bodyweight
 *  - `basic` — completion status only (did they train this day yes/no)
 *
 * Enforced by RLS on workout_sets and body_weight_log (see migration 003).
 * Client reads also honour it so the UI matches what the server will
 * return (e.g. the friend dashboard hides PRs + volume on 'basic').
 */
export type MesoShareLevel = 'full' | 'basic';

export interface MesoMember {
  mesoId: string;
  userId: string;
  role: 'owner' | 'member';
  name: string;
  joinedAt: string;
  /** Privacy level the member has set on this meso. Defaults to 'full'
   *  when the server column hasn't been backfilled yet. */
  shareLevel: MesoShareLevel;
  latestActivity?: {
    dayIdx: number;
    weekIdx: number;
    completedAt: string | null;
  } | null;
}

export interface FriendWorkoutData {
  userId: string;
  userName: string;
  dayIdx: number;
  weekIdx: number;
  /** Mirrors MesoMember.shareLevel so consumers can render the right empty
   *  state (e.g. "Basic sharing — completion only" vs "No sets logged"). */
  shareLevel: MesoShareLevel;
  exercises: {
    name: string;
    muscle: string;
    sets: {
      weight: number | string;
      reps: number | string;
      rpe?: number | string;
    }[];
  }[];
}
