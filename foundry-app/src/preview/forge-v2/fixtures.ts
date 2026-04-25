// Fake session data for the forge-v2 preview. Deliberately isolated from
// real stores so the preview never reads or writes app state.

export type Phase = 'Accumulation' | 'Intensification' | 'Peak' | 'Deload';

export type SetEntry = {
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
};

export type Exercise = {
  id: string;
  name: string;
  setsTarget: number;
  repLow: number;
  repHigh: number;
  rpeTarget: number;
  target: string;
  lastWeek: string;
  sets: SetEntry[];
};

export type Session = {
  id: string;
  name: string;
  dayOfMeso: number;
  weekOfMeso: number;
  phase: Phase;
  /** Tag used to filter the exercise DB when the user adds a movement.
   *  Matches the EXERCISE_DB `tag` field — PUSH / PULL / LEGS / CORE. */
  tag: 'PUSH' | 'PULL' | 'LEGS' | 'CORE';
  exercises: Exercise[];
  currentExerciseIdx: number;
  startedAt: number;
};

export const PHASE_COLORS: Record<Phase, string> = {
  Accumulation: '#E8E4DC',
  Intensification: '#E8651A',
  Peak: '#D4983C',
  Deload: '#5B8FA8',
};

const mkSets = (target: number, doneCount: number, weight: string, reps: string, rpe: string): SetEntry[] =>
  Array.from({ length: target }, (_, i) => ({
    weight: i < doneCount ? weight : '',
    reps: i < doneCount ? reps : '',
    rpe: i < doneCount ? rpe : '',
    done: i < doneCount,
  }));

export const FIXTURE_SESSION: Session = {
  id: 'fixture-push-a',
  name: 'PUSH A',
  dayOfMeso: 1,
  weekOfMeso: 4,
  phase: 'Intensification',
  tag: 'PUSH',
  currentExerciseIdx: 2,
  startedAt: Date.now() - 1000 * 60 * 23,
  exercises: [
    {
      id: 'bench-press',
      name: 'BARBELL BENCH PRESS',
      setsTarget: 4,
      repLow: 6,
      repHigh: 8,
      rpeTarget: 8,
      target: '200 LB',
      lastWeek: '185 × 8 @ 7.5',
      sets: mkSets(4, 4, '200', '7', '8'),
    },
    {
      id: 'incline-db',
      name: 'INCLINE DB PRESS',
      setsTarget: 3,
      repLow: 8,
      repHigh: 10,
      rpeTarget: 8,
      target: '75 LB',
      lastWeek: '70 × 10 @ 8',
      sets: mkSets(3, 3, '75', '9', '8'),
    },
    {
      id: 'cable-fly',
      name: 'CABLE FLY',
      setsTarget: 3,
      repLow: 10,
      repHigh: 12,
      rpeTarget: 9,
      target: '40 LB',
      lastWeek: '35 × 12 @ 8.5',
      sets: mkSets(3, 0, '', '', ''),
    },
    {
      id: 'lateral-raise',
      name: 'DB LATERAL RAISE',
      setsTarget: 4,
      repLow: 12,
      repHigh: 15,
      rpeTarget: 9,
      target: '22.5 LB',
      lastWeek: '20 × 15 @ 8',
      sets: mkSets(4, 0, '', '', ''),
    },
    {
      id: 'tricep-pushdown',
      name: 'TRICEP ROPE PUSHDOWN',
      setsTarget: 3,
      repLow: 10,
      repHigh: 12,
      rpeTarget: 8,
      target: '60 LB',
      lastWeek: '55 × 12 @ 8',
      sets: mkSets(3, 0, '', '', ''),
    },
    {
      id: 'overhead-tricep',
      name: 'OVERHEAD TRICEP EXTENSION',
      setsTarget: 3,
      repLow: 12,
      repHigh: 15,
      rpeTarget: 9,
      target: '35 LB',
      lastWeek: '30 × 15 @ 8.5',
      sets: mkSets(3, 0, '', '', ''),
    },
  ],
};
