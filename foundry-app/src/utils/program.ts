import { shuffle } from './training';
import type { Exercise, Profile, TrainingDay } from '../types';

// Internal shape of EXERCISE_DB entries — extends public Exercise with DB-only fields
interface DbExercise extends Exercise {
  diff?: number;
  pattern?: string;
  muscles: string[];
  tag?: string;
}

interface DayBuild {
  anchor: DbExercise | undefined;
  accessories: DbExercise[];
}

interface DayMuscleConfigEntry {
  primary: string[];
  accessory: string[];
}

/**
 * Generate a complete training program from a user profile.
 * Supports PPL, Upper/Lower, Full Body, and Push/Pull splits.
 * Returns array of day objects with exercises, sets, reps, and progressions.
 */
export function generateProgram(profile: Profile, EXERCISE_DB: DbExercise[] = []): TrainingDay[] {
  // AI-built or custom days take priority
  if (profile?.aiDays && profile.aiDays.length > 0) return profile.aiDays;

  const equipment = profile?.equipment || [
    'barbell',
    'dumbbell',
    'cable',
    'machine',
    'bodyweight',
    'band',
    'kettlebell',
  ];
  const duration = profile?.sessionDuration || 60;
  const splitType = profile?.splitType || 'ppl';
  const numDays = profile?.workoutDays?.length || profile?.daysPerWeek || 6;
  const dayMuscleConfig: Record<number, DayMuscleConfigEntry> =
    profile.dayMuscleConfig || {};
  const shortWarmup = Number(duration) <= 30;
  const exCount =
    Number(duration) <= 30 ? 3 : Number(duration) <= 45 ? 4 : Number(duration) <= 60 ? 5 : Number(duration) <= 75 ? 6 : 7;

  const experience = profile?.experience || 'intermediate';
  const maxDiff = experience === 'beginner' ? 1 : experience === 'intermediate' ? 2 : 3;

  const available = EXERCISE_DB.filter(
    (e) => equipment.includes(e.equipment as string) && (e.diff ?? 0) <= maxDiff
  );

  // Goal-based rep range suggestions
  // Compounds: strength=4-6, hypertrophy=6-10, lose_fat=8-12, fitness=8-15
  // Isolations: strength=6-10, hypertrophy=10-15, lose_fat=12-18, fitness=12-20
  const goalId = profile?.goal || '';
  const isStrength = goalId === 'build_strength';
  const isLoseFat = goalId === 'lose_fat';
  const isFitness =
    goalId === 'general_fitness' ||
    goalId === 'improve_fitness' ||
    goalId === 'sport_conditioning';
  function goalReps(e: DbExercise): string {
    const isCompound = ['push', 'pull', 'squat', 'hinge'].includes(e.pattern ?? '');
    if (isStrength) return isCompound ? '4-6' : '6-10';
    if (isLoseFat) return isCompound ? '8-12' : '12-18';
    if (isFitness) return isCompound ? '8-15' : '12-20';
    // build_muscle — pure hypertrophy ranges
    return isCompound ? '6-10' : '10-15';
  }

  function toEx(e: DbExercise, isAnchor: boolean): Exercise {
    const wu = isAnchor
      ? shortWarmup
        ? '2 ramp sets — time is tight, be thorough'
        : e.warmup
      : e.warmup || '1 feeler set';
    return {
      id: e.id,
      name: e.name,
      muscle: e.muscle,
      muscles: e.muscles,
      equipment: e.equipment,
      tag: e.tag,
      anchor: !!isAnchor,
      sets: exCount <= 3 ? 5 : exCount <= 4 ? 4 : (e.sets || 3),
      reps: goalReps(e),
      rest: e.rest,
      warmup: wu,
      progression: e.pattern === 'isolation' ? 'reps' : 'weight',
      description: e.description || '',
      videoUrl: e.videoUrl || '',
      bw: !!e.bw,
    };
  }

  function buildDay(
    pool: DbExercise[],
    anchorPriority: string[],
    musclePriority: string[],
    usedAnchorIds: Set<string | number | undefined>
  ): DayBuild {
    const compoundPatterns = ['push', 'pull', 'squat', 'hinge'];
    const anchorEligible = pool.filter((e) => e.anchor);
    const anchorCandidates =
      anchorEligible.length > 0
        ? anchorEligible
        : shuffle(pool).sort(
            (a, b) =>
              (compoundPatterns.includes(a.pattern ?? '') ? 0 : 1) -
              (compoundPatterns.includes(b.pattern ?? '') ? 0 : 1)
          );

    const anchorPool = shuffle(anchorCandidates.filter((e) => !usedAnchorIds.has(e.id)));
    const anchor =
      anchorPool.find((e) => anchorPriority.includes(e.pattern ?? '')) ||
      anchorPool[0] ||
      shuffle(anchorCandidates)[0];

    const usedIds = new Set<string | number | undefined>([anchor?.id]);
    const usedMuscles = new Set<string>(anchor?.muscles || []);
    const accessories: DbExercise[] = [];

    for (const muscleTarget of musclePriority) {
      if (accessories.length >= exCount - 1) break;
      const cands = shuffle(
        pool.filter(
          (e) =>
            !e.anchor &&
            !usedIds.has(e.id) &&
            e.muscles.some((m) => m === muscleTarget || m.includes(muscleTarget))
        )
      );
      if (cands[0]) {
        accessories.push(cands[0]);
        usedIds.add(cands[0].id);
        cands[0].muscles.forEach((m) => usedMuscles.add(m));
      }
    }

    for (const filler of shuffle(pool.filter((e) => !usedIds.has(e.id) && !e.anchor))) {
      if (accessories.length >= exCount - 1) break;
      accessories.push(filler);
      usedIds.add(filler.id);
    }
    for (const filler of shuffle(pool.filter((e) => !usedIds.has(e.id)))) {
      if (accessories.length >= exCount - 1) break;
      accessories.push(filler);
      usedIds.add(filler.id);
    }
    return { anchor, accessories };
  }

  function makeDay(
    num: number,
    label: string,
    tag: string,
    muscles: string,
    note: string,
    anchor: DbExercise | undefined,
    accessories: DbExercise[]
  ): TrainingDay {
    const exercises = anchor
      ? [toEx(anchor, true), ...accessories.map((a) => toEx(a, false))]
      : accessories.map((a) => toEx(a, false));
    return { dayNum: num, label, tag, muscles, note, cardio: null, exercises };
  }

  const anchorNotes: Record<string, Record<string, string>> = {
    push: {
      push: 'Anchor is your main press — controlled negative, explode up.',
      hinge: 'Hip-hinge focus today — load the stretch, finish tall.',
      squat: 'Drive through the floor, stay tight.',
      isolation: 'Squeeze at the top, slow the negative.',
    },
    pull: {
      pull: 'Retract the scapula, drive elbows to hips.',
      hinge: 'Push the floor away, keep the bar close.',
      squat: 'Brace your core, drive your knees out.',
      isolation: 'Full stretch at the bottom, squeeze at the top.',
    },
    legs: {
      squat: 'Brace hard, drive knees out, full depth.',
      hinge: 'Load the hamstrings, keep the spine neutral.',
      push: 'Full depth, controlled descent.',
      isolation: 'Slow the negative, squeeze the contraction.',
    },
    upper: {
      push: 'Main press anchors today — chest and shoulders.',
      pull: 'Primary pull — back thickness and width.',
      hinge: 'Hinge anchor — load the posterior chain.',
      squat: 'Compound anchor — brace and drive.',
      isolation: 'Isolation anchor — squeeze the contraction.',
    },
    lower: {
      squat: 'Squat anchor — brace hard, full depth.',
      hinge: 'Hinge anchor — hamstrings and glutes loaded.',
      push: 'Leg press anchor — full range, control the descent.',
      isolation: 'Isolation anchor — squeeze at peak contraction.',
    },
    full: {
      push: 'Main press for the day — control the negative.',
      pull: 'Primary pull — retract, drive, squeeze.',
      squat: 'Squat anchor — full depth, knees out.',
      hinge: 'Hinge anchor — load the stretch, neutral spine.',
      isolation: 'Isolation anchor — feel every rep.',
    },
  };

  function dayNote(side: string, ex: DbExercise | undefined): string {
    if (!ex) return 'Train hard and stay focused.';
    return (
      anchorNotes[side]?.[ex.pattern ?? ''] || `${ex.name} anchors today — give it everything.`
    );
  }

  function dayMusclePriority(dayIdx: number, defaultPrimary: string[]): string[] {
    const dm = dayMuscleConfig[dayIdx];
    if (!dm || (dm.primary.length === 0 && dm.accessory.length === 0)) return defaultPrimary;
    return [...dm.primary, ...dm.accessory];
  }

  // Manual builder short-circuit
  if (profile?.manualDayExercises && Object.keys(profile.manualDayExercises).length > 0) {
    const manExs = profile.manualDayExercises;
    const manPairs: Record<string, [number, number][]> = profile.manualDayPairs || {};
    const manDayTemplates: Record<string, Record<number, [string, string][]>> = {
      ppl: {
        3: [
          ['Push Day', 'PUSH'],
          ['Pull Day', 'PULL'],
          ['Legs Day', 'LEGS'],
        ],
        5: [
          ['Push Day 1', 'PUSH'],
          ['Pull Day 1', 'PULL'],
          ['Legs Day', 'LEGS'],
          ['Push Day 2', 'PUSH'],
          ['Pull Day 2', 'PULL'],
        ],
        6: [
          ['Push 1', 'PUSH'],
          ['Pull 1', 'PULL'],
          ['Legs 1', 'LEGS'],
          ['Push 2', 'PUSH'],
          ['Pull 2', 'PULL'],
          ['Legs 2', 'LEGS'],
        ],
      },
      upper_lower: {
        2: [
          ['Upper Body', 'UPPER'],
          ['Lower Body', 'LOWER'],
        ],
        4: [
          ['Upper A', 'UPPER'],
          ['Lower A', 'LOWER'],
          ['Upper B', 'UPPER'],
          ['Lower B', 'LOWER'],
        ],
      },
      full_body: {
        2: [
          ['Full Body A', 'FULL'],
          ['Full Body B', 'FULL'],
        ],
        3: [
          ['Full Body A', 'FULL'],
          ['Full Body B', 'FULL'],
          ['Full Body C', 'FULL'],
        ],
      },
    };
    const templates: [string, string][] =
      manDayTemplates[splitType]?.[numDays] ||
      Array.from({ length: numDays }, (_, i): [string, string] => [`Day ${i + 1}`, 'FULL']);

    const manCardioDays: number[] = profile.manualCardioDays || [];

    const days = templates
      .map(([label, tag], i) => {
        if (manCardioDays.includes(i)) {
          return {
            dayNum: i + 1,
            label: 'Cardio',
            tag: 'CARDIO',
            muscles: 'Cardio / Conditioning',
            note: 'Log your cardio session below — type, duration, and intensity.',
            cardio: null,
            exercises: [],
          } as any;
        }
        const exIds: (string | number)[] = (manExs[i] as any) || [];
        const exObjs = exIds
          .map((id) => EXERCISE_DB.find((e) => e.id === id))
          .filter(Boolean) as DbExercise[];
        if (exObjs.length === 0) return null;
        const anchorEx = exObjs[0];
        const accs = exObjs.slice(1);
        const side = tag.toLowerCase();
        const note = dayNote(side, anchorEx);
        const day = makeDay(i + 1, label, tag, '', note, anchorEx, accs) as any;
        const pairs = manPairs[i] || [];
        pairs.forEach(([a, b]) => {
          if (a < day.exercises.length && b < day.exercises.length) {
            day.exercises[a] = { ...day.exercises[a], supersetWith: b };
          }
        });
        return day as TrainingDay;
      })
      .filter(Boolean) as TrainingDay[];

    return days;
  }

  // PPL SPLITS
  if (splitType === 'ppl' || !splitType) {
    const pushPool = available.filter((e) => e.tag === 'PUSH');
    const pullPool = available.filter((e) => e.tag === 'PULL');
    const legsPool = available.filter((e) => e.tag === 'LEGS');

    const usedPA = new Set<string | number | undefined>(),
      usedRA = new Set<string | number | undefined>(),
      usedLA = new Set<string | number | undefined>();
    const p1 = buildDay(
      pushPool,
      ['push'],
      dayMusclePriority(0, ['Chest', 'Shoulders', 'Triceps']),
      usedPA
    );
    if (p1.anchor) usedPA.add(p1.anchor.id);
    const r1 = buildDay(
      pullPool,
      ['pull'],
      dayMusclePriority(1, ['Lats', 'Back', 'Shoulders', 'Biceps', 'Upper Traps']),
      usedRA
    );
    if (r1.anchor) usedRA.add(r1.anchor.id);
    const l1 = buildDay(
      legsPool,
      ['squat'],
      dayMusclePriority(2, ['Hamstrings', 'Quads', 'Glutes', 'Gastrocnemius']),
      usedLA
    );
    if (l1.anchor) usedLA.add(l1.anchor.id);

    if (numDays <= 3) {
      return [
        makeDay(
          1,
          'Push Day',
          'PUSH',
          'Chest · Shoulders · Triceps',
          dayNote('push', p1.anchor),
          p1.anchor,
          p1.accessories
        ),
        makeDay(
          2,
          'Pull Day',
          'PULL',
          'Back · Biceps · Rear Delts',
          dayNote('pull', r1.anchor),
          r1.anchor,
          r1.accessories
        ),
        makeDay(
          3,
          'Legs Day',
          'LEGS',
          'Quads · Hamstrings · Glutes · Calves',
          dayNote('legs', l1.anchor),
          l1.anchor,
          l1.accessories
        ),
      ];
    }

    const p2 = buildDay(pushPool, ['push'], ['Chest', 'Shoulders', 'Triceps'], usedPA);
    const r2 = buildDay(
      pullPool,
      ['pull'],
      ['Lats', 'Back', 'Shoulders', 'Biceps', 'Teres Major'],
      usedRA
    );
    const l2 = buildDay(legsPool, ['hinge'], ['Quads', 'Glutes', 'Hamstrings', 'Soleus'], usedLA);

    if (numDays === 5) {
      return [
        makeDay(
          1,
          'Push Day 1',
          'PUSH',
          'Chest · Shoulders · Triceps',
          dayNote('push', p1.anchor),
          p1.anchor,
          p1.accessories
        ),
        makeDay(
          2,
          'Pull Day 1',
          'PULL',
          'Back · Biceps · Rear Delts',
          dayNote('pull', r1.anchor),
          r1.anchor,
          r1.accessories
        ),
        makeDay(
          3,
          'Legs Day',
          'LEGS',
          'Quads · Hamstrings · Glutes · Calves',
          dayNote('legs', l1.anchor),
          l1.anchor,
          l1.accessories
        ),
        makeDay(
          4,
          'Push Day 2',
          'PUSH',
          'Chest · Shoulders · Triceps (Variation)',
          dayNote('push', p2.anchor),
          p2.anchor,
          p2.accessories
        ),
        makeDay(
          5,
          'Pull Day 2',
          'PULL',
          'Back · Biceps · Rear Delts (Variation)',
          dayNote('pull', r2.anchor),
          r2.anchor,
          r2.accessories
        ),
      ];
    }

    // 6-day PPL ×2
    return [
      makeDay(
        1,
        'Push Day 1',
        'PUSH',
        'Chest · Shoulders · Triceps',
        dayNote('push', p1.anchor),
        p1.anchor,
        p1.accessories
      ),
      makeDay(
        2,
        'Pull Day 1',
        'PULL',
        'Back · Biceps · Rear Delts',
        dayNote('pull', r1.anchor),
        r1.anchor,
        r1.accessories
      ),
      makeDay(
        3,
        'Legs Day 1',
        'LEGS',
        'Quads · Hamstrings · Glutes · Calves',
        dayNote('legs', l1.anchor),
        l1.anchor,
        l1.accessories
      ),
      makeDay(
        4,
        'Push Day 2',
        'PUSH',
        'Chest · Shoulders · Triceps (Variation)',
        dayNote('push', p2.anchor),
        p2.anchor,
        p2.accessories
      ),
      makeDay(
        5,
        'Pull Day 2',
        'PULL',
        'Back · Biceps · Rear Delts (Variation)',
        dayNote('pull', r2.anchor),
        r2.anchor,
        r2.accessories
      ),
      makeDay(
        6,
        'Legs Day 2',
        'LEGS',
        'Hamstrings · Glutes · Quads (Variation)',
        dayNote('legs', l2.anchor),
        l2.anchor,
        l2.accessories
      ),
    ];
  }

  // UPPER / LOWER SPLITS
  if (splitType === 'upper_lower') {
    const upperPool = available.filter((e) => e.tag === 'PUSH' || e.tag === 'PULL');
    const lowerPool = available.filter((e) => e.tag === 'LEGS');

    const usedUA = new Set<string | number | undefined>(),
      usedLA = new Set<string | number | undefined>();
    const u1 = buildDay(
      upperPool,
      ['push'],
      ['Chest', 'Lats', 'Shoulders', 'Biceps', 'Triceps'],
      usedUA
    );
    if (u1.anchor) usedUA.add(u1.anchor.id);

    const l1 = buildDay(
      lowerPool,
      ['squat'],
      ['Hamstrings', 'Quads', 'Glutes', 'Gastrocnemius'],
      usedLA
    );
    if (l1.anchor) usedLA.add(l1.anchor.id);

    if (numDays <= 2) {
      return [
        makeDay(
          1,
          'Upper Body',
          'UPPER',
          'Chest · Back · Shoulders · Arms',
          dayNote('upper', u1.anchor),
          u1.anchor,
          u1.accessories
        ),
        makeDay(
          2,
          'Lower Body',
          'LOWER',
          'Quads · Hamstrings · Glutes · Calves',
          dayNote('lower', l1.anchor),
          l1.anchor,
          l1.accessories
        ),
      ];
    }

    const u2 = buildDay(
      upperPool,
      ['push'],
      ['Chest', 'Back', 'Shoulders', 'Biceps', 'Long Head Tri'],
      usedUA
    );
    if (u2.anchor) usedUA.add(u2.anchor.id);

    const l2 = buildDay(lowerPool, ['hinge'], ['Quads', 'Glutes', 'Hamstrings', 'Soleus'], usedLA);

    return [
      makeDay(
        1,
        'Upper A',
        'UPPER',
        'Chest · Back · Shoulders · Arms',
        dayNote('upper', u1.anchor),
        u1.anchor,
        u1.accessories
      ),
      makeDay(
        2,
        'Lower A',
        'LOWER',
        'Quads · Hamstrings · Glutes · Calves',
        dayNote('lower', l1.anchor),
        l1.anchor,
        l1.accessories
      ),
      makeDay(
        3,
        'Upper B',
        'UPPER',
        'Shoulders · Back · Arms (Variation)',
        dayNote('upper', u2.anchor),
        u2.anchor,
        u2.accessories
      ),
      makeDay(
        4,
        'Lower B',
        'LOWER',
        'Hamstrings · Glutes · Quads (Variation)',
        dayNote('lower', l2.anchor),
        l2.anchor,
        l2.accessories
      ),
    ];
  }

  // FULL BODY SPLITS
  if (splitType === 'full_body') {
    const pushPool = available.filter((e) => e.tag === 'PUSH');
    const pullPool = available.filter((e) => e.tag === 'PULL');
    const legsPool = available.filter((e) => e.tag === 'LEGS');

    const usedPA = new Set<string | number | undefined>(),
      usedRA = new Set<string | number | undefined>(),
      usedLA = new Set<string | number | undefined>();

    function buildFullBodyDay(
      pushPriority: string[],
      pullPriority: string[],
      legsPriority: string[],
      dayNum: number
    ): TrainingDay {
      const pDay = buildDay(pushPool, pushPriority, ['Chest', 'Shoulders', 'Triceps'], usedPA);
      if (pDay.anchor) usedPA.add(pDay.anchor.id);
      const rDay = buildDay(
        pullPool,
        pullPriority,
        ['Lats', 'Back', 'Biceps', 'Shoulders'],
        usedRA
      );
      if (rDay.anchor) usedRA.add(rDay.anchor.id);
      const lDay = buildDay(
        legsPool,
        legsPriority,
        ['Quads', 'Hamstrings', 'Glutes', 'Gastrocnemius'],
        usedLA
      );
      if (lDay.anchor) usedLA.add(lDay.anchor.id);

      const pushEx = pDay.anchor ? [toEx(pDay.anchor, true)] : [];
      const pullEx = rDay.anchor ? [toEx(rDay.anchor, true)] : [];
      const legsEx = lDay.anchor ? [toEx(lDay.anchor, true)] : [];

      const pAcc = pDay.accessories.slice(0, Math.ceil((exCount - 3) / 3));
      const rAcc = rDay.accessories.slice(0, Math.ceil((exCount - 3) / 3));
      const lAcc = lDay.accessories.slice(0, Math.ceil((exCount - 3) / 3));
      const allAccessories: Exercise[] = [];
      const maxAcc = exCount - 3;
      for (let i = 0; i < maxAcc; i++) {
        const pool = [pAcc, rAcc, lAcc];
        const src = pool[i % 3];
        const ex = src.shift();
        if (ex) allAccessories.push(toEx(ex, false));
      }

      const exercises = [...pushEx, ...pullEx, ...legsEx, ...allAccessories];
      return {
        dayNum,
        label: `Full Body ${dayNum === 1 ? 'A' : dayNum === 2 ? 'B' : 'C'}`,
        tag: 'FULL',
        muscles: 'Full Body — Push · Pull · Legs',
        note: 'Full body session — compound anchors for push, pull, and legs.',
        cardio: null,
        exercises,
      } as any;
    }

    const fb1 = buildFullBodyDay(['push'], ['pull'], ['squat'], 1);
    if (numDays <= 2) {
      const fb2 = buildFullBodyDay(['push'], ['pull'], ['hinge'], 2);
      return [fb1, fb2];
    }
    const fb2 = buildFullBodyDay(['push'], ['pull'], ['hinge'], 2);
    const fb3 = buildFullBodyDay(['push'], ['pull'], ['squat'], 3);
    return [fb1, fb2, fb3];
  }

  // PUSH / PULL 4-DAY
  if (splitType === 'push_pull') {
    const pushPlusLegs = available.filter(
      (e) => e.tag === 'PUSH' || (e.tag === 'LEGS' && e.pattern === 'squat')
    );
    const pullPlusLegs = available.filter(
      (e) => e.tag === 'PULL' || (e.tag === 'LEGS' && e.pattern === 'hinge')
    );

    const usedPA = new Set<string | number | undefined>(),
      usedRA = new Set<string | number | undefined>();
    const p1 = buildDay(pushPlusLegs, ['push'], ['Chest', 'Shoulders', 'Quads', 'Triceps'], usedPA);
    if (p1.anchor) usedPA.add(p1.anchor.id);
    const r1 = buildDay(
      pullPlusLegs,
      ['pull'],
      ['Lats', 'Back', 'Hamstrings', 'Biceps', 'Shoulders'],
      usedRA
    );
    if (r1.anchor) usedRA.add(r1.anchor.id);
    const p2 = buildDay(
      pushPlusLegs,
      ['push'],
      ['Chest', 'Shoulders', 'Quads', 'Long Head Tri'],
      usedPA
    );
    const r2 = buildDay(
      pullPlusLegs,
      ['pull'],
      ['Lats', 'Back', 'Hamstrings', 'Glutes', 'Biceps'],
      usedRA
    );

    return [
      makeDay(
        1,
        'Push A',
        'PUSH',
        'Chest · Shoulders · Triceps · Quads',
        dayNote('push', p1.anchor),
        p1.anchor,
        p1.accessories
      ),
      makeDay(
        2,
        'Pull A',
        'PULL',
        'Back · Biceps · Rear Delts · Hamstrings',
        dayNote('pull', r1.anchor),
        r1.anchor,
        r1.accessories
      ),
      makeDay(
        3,
        'Push B',
        'PUSH',
        'Shoulders · Chest · Triceps · Quads (Variation)',
        dayNote('push', p2.anchor),
        p2.anchor,
        p2.accessories
      ),
      makeDay(
        4,
        'Pull B',
        'PULL',
        'Back · Biceps · Rear Delts · Hamstrings (Variation)',
        dayNote('pull', r2.anchor),
        r2.anchor,
        r2.accessories
      ),
    ];
  }

  // Fallback
  return generateProgram(
    { ...profile, splitType: 'ppl', daysPerWeek: 3, workoutDays: [1, 3, 5] },
    EXERCISE_DB
  );
}
