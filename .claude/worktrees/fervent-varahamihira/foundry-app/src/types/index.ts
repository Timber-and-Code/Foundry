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
  addedDayExercises?: Record<string, Exercise[]>;
  pplLegBalance?: boolean;
  theme?: string;
  goalNote?: string;
}

// ─── CARDIO ─────────────────────────────────────────────────────────────────

export interface CardioScheduleSlot {
  dayOfWeek: number;
  protocol: string;
}

export interface CardioSession {
  completed?: boolean;
  type?: string;
  duration?: number;
  intensity?: string;
  protocolId?: string;
  startedAt?: number | string;
  data?: Record<string, unknown>;
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
