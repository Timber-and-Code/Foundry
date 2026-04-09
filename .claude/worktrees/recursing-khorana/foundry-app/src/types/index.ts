// ─── CORE DOMAIN TYPES ────────────────────────────────────────────────────────

export interface WorkoutSet {
  weight: number | string;
  reps: number | string;
  [key: string]: unknown;
}

/** { [exerciseIndex]: { [setIndex]: WorkoutSet } } */
export type DayData = Record<string, Record<string, WorkoutSet>>;

export interface Exercise {
  id?: string | number;
  name: string;
  muscle: string;
  equipment?: string;
  anchor?: boolean;
  sets?: number | string;
  reps?: number | string;
  rest?: string;
  warmup?: string;
  bw?: boolean;
  supersetWith?: number;
  [key: string]: unknown;
}

export interface TrainingDay {
  label?: string;
  exercises: Exercise[];
  type?: string;
  isRest?: boolean;
  isCardio?: boolean;
  [key: string]: unknown;
}

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
  equipment?: string;
  sessionDuration?: number | string;
  autoBuilt?: boolean;
  aiDays?: TrainingDay[];
  manualDayExercises?: Record<string, Exercise[]>;
  manualDayPairs?: Record<string, [number, number][]>;
  manualCardioDays?: number[];
  workoutDaysHistory?: WorkoutDaysHistoryEntry[];
  [key: string]: unknown;
}

// ─── MESO CONFIG ─────────────────────────────────────────────────────────────

export type SplitType = 'ppl' | 'upper_lower' | 'full_body' | 'push_pull';

export interface MesoConfig {
  days: number;
  weeks: number;
  split: SplitType;
  [key: string]: unknown;
}

// ─── READINESS ───────────────────────────────────────────────────────────────

export interface ReadinessEntry {
  sleep?: 'poor' | 'ok' | 'good';
  soreness?: 'high' | 'moderate' | 'low';
  energy?: 'low' | 'moderate' | 'high';
  [key: string]: unknown;
}

// ─── BODY WEIGHT ─────────────────────────────────────────────────────────────

export interface BodyWeightEntry {
  date: string;
  weight: number;
}

// ─── ARCHIVE ─────────────────────────────────────────────────────────────────

export interface ArchiveEntry {
  id: number | string;
  profile?: Partial<Profile>;
  builtBy?: 'ai' | 'manual';
  [key: string]: unknown;
}
