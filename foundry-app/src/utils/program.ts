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
const ALL_EQUIPMENT = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'band', 'kettlebell'];
// Shortcut tokens — onboarding v2 Beat1Essentials + Supabase default column —
// get expanded to the atomic equipment types generateProgram filters on.
const EQUIPMENT_PRESETS: Record<string, string[]> = {
  full_gym: ALL_EQUIPMENT,
  home_gym: ['dumbbell', 'bodyweight', 'band', 'kettlebell'],
  minimal: ['bodyweight', 'band'],
};

/**
 * Expand a profile's equipment value (preset token or atomic list) into the
 * atomic equipment types (`barbell`, `dumbbell`, …) the DB is tagged with.
 * Shared so the swap picker's equipment-match dimming stays in sync with
 * generateProgram's pool filter.
 */
export function expandEquipment(profEq: unknown): string[] {
  let rawEquipment: string[];
  if (Array.isArray(profEq) && profEq.length > 0) {
    rawEquipment = profEq.map((v) => String(v));
  } else if (typeof profEq === 'string' && profEq) {
    rawEquipment = [profEq];
  } else {
    rawEquipment = ALL_EQUIPMENT;
  }
  return Array.from(new Set(
    rawEquipment.flatMap((eq: string) => EQUIPMENT_PRESETS[eq] ?? [eq]),
  ));
}

export function generateProgram(profile: Profile, EXERCISE_DB: DbExercise[] = []): TrainingDay[] {
  // AI-built or custom days take priority
  if (profile?.aiDays && profile.aiDays.length > 0) return profile.aiDays;

  const equipment = expandEquipment(profile?.equipment);
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
  //
  // Pure Strength (profile.goal === 'build_strength') is the strictest tier —
  // anchors drop to 3-6 and accessories shed one set (floor 2) to keep total
  // volume sustainable under heavy loading. Matched to the IntakeCard
  // "Pure Strength" pill; muscle+strength bias users stay on the standard
  // hypertrophy ranges.
  const goalId = profile?.goal || '';
  const isPureStrength = goalId === 'build_strength';
  const isLoseFat = goalId === 'lose_fat';
  const isFitness =
    goalId === 'general_fitness' ||
    goalId === 'improve_fitness' ||
    goalId === 'sport_conditioning';
  function goalReps(e: DbExercise): string {
    const isCompound = ['push', 'pull', 'squat', 'hinge'].includes(e.pattern ?? '');
    if (isPureStrength) return isCompound ? '4-6' : '6-10';
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
    // Base set count — short sessions compress to 4-5 sets across the board so
    // the session still produces enough stimulus; longer sessions respect the
    // DB's per-exercise set suggestion.
    const baseSets = exCount <= 3 ? 5 : exCount <= 4 ? 4 : (Number(e.sets) || 3);
    // Pure Strength tweak — keep anchors at full sets (the heavy work), trim
    // accessory volume by one set (floor 2) so total volume stays sane.
    const sets = isPureStrength && !isAnchor ? Math.max(2, baseSets - 1) : baseSets;
    // Pure Strength anchors: stricter 3-6 range. Accessories still follow the
    // usual goalReps mapping so you keep a hypertrophy backstop.
    const reps = isPureStrength && isAnchor ? '3-6' : goalReps(e);
    return {
      id: e.id,
      name: e.name,
      muscle: e.muscle,
      muscles: e.muscles,
      equipment: e.equipment,
      tag: e.tag,
      anchor: !!isAnchor,
      sets,
      reps,
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
      const matching = pool.filter(
        (e) =>
          !e.anchor &&
          !usedIds.has(e.id) &&
          e.muscles.some((m) => m === muscleTarget || m.includes(muscleTarget))
      );
      // Prefer exercises whose primary muscle is the target — a bicep curl
      // for the "Biceps" slot, not a row that happens to list Biceps as a
      // secondary. Without this, shuffle often handed the slot to a
      // compound and dedicated isolation work (notably biceps) never made
      // it into the meso.
      const primary = matching.filter((e) => e.muscle === muscleTarget);
      const cands = shuffle(primary.length > 0 ? primary : matching);
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
          'Push',
          'PUSH',
          'Chest · Shoulders · Triceps',
          dayNote('push', p1.anchor),
          p1.anchor,
          p1.accessories
        ),
        makeDay(
          2,
          'Pull',
          'PULL',
          'Back · Biceps · Rear Delts',
          dayNote('pull', r1.anchor),
          r1.anchor,
          r1.accessories
        ),
        makeDay(
          3,
          'Legs',
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
          'Push 1',
          'PUSH',
          'Chest · Shoulders · Triceps',
          dayNote('push', p1.anchor),
          p1.anchor,
          p1.accessories
        ),
        makeDay(
          2,
          'Pull 1',
          'PULL',
          'Back · Biceps · Rear Delts',
          dayNote('pull', r1.anchor),
          r1.anchor,
          r1.accessories
        ),
        makeDay(
          3,
          'Legs',
          'LEGS',
          'Quads · Hamstrings · Glutes · Calves',
          dayNote('legs', l1.anchor),
          l1.anchor,
          l1.accessories
        ),
        makeDay(
          4,
          'Push 2',
          'PUSH',
          'Chest · Shoulders · Triceps (Variation)',
          dayNote('push', p2.anchor),
          p2.anchor,
          p2.accessories
        ),
        makeDay(
          5,
          'Pull 2',
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
        'Push 1',
        'PUSH',
        'Chest · Shoulders · Triceps',
        dayNote('push', p1.anchor),
        p1.anchor,
        p1.accessories
      ),
      makeDay(
        2,
        'Pull 1',
        'PULL',
        'Back · Biceps · Rear Delts',
        dayNote('pull', r1.anchor),
        r1.anchor,
        r1.accessories
      ),
      makeDay(
        3,
        'Legs 1',
        'LEGS',
        'Quads · Hamstrings · Glutes · Calves',
        dayNote('legs', l1.anchor),
        l1.anchor,
        l1.accessories
      ),
      makeDay(
        4,
        'Push 2',
        'PUSH',
        'Chest · Shoulders · Triceps (Variation)',
        dayNote('push', p2.anchor),
        p2.anchor,
        p2.accessories
      ),
      makeDay(
        5,
        'Pull 2',
        'PULL',
        'Back · Biceps · Rear Delts (Variation)',
        dayNote('pull', r2.anchor),
        r2.anchor,
        r2.accessories
      ),
      makeDay(
        6,
        'Legs 2',
        'LEGS',
        'Hamstrings · Glutes · Quads (Variation)',
        dayNote('legs', l2.anchor),
        l2.anchor,
        l2.accessories
      ),
    ];
  }

  // UPPER / LOWER SPLITS — 2..6 days, alternating primary (Upper) first.
  // Odd day counts favor Upper (ceil(n/2) upper, floor(n/2) lower).
  if (splitType === 'upper_lower') {
    const upperPool = available.filter((e) => e.tag === 'PUSH' || e.tag === 'PULL');
    const lowerPool = available.filter((e) => e.tag === 'LEGS');

    // Alternate tags: U, L, U, L, ... — odd counts end on Upper.
    const tags: ('UPPER' | 'LOWER')[] = Array.from({ length: numDays }, (_, i) =>
      i % 2 === 0 ? 'UPPER' : 'LOWER'
    );
    const upperCount = tags.filter((t) => t === 'UPPER').length;
    const lowerCount = tags.filter((t) => t === 'LOWER').length;

    const usedUA = new Set<string | number | undefined>();
    const usedLA = new Set<string | number | undefined>();
    // Build one DayBuild per upper / lower slot; alternate anchor priority to
    // spread squat / hinge (and push / pull-focused anchors) across sessions.
    const upperBuilds: DayBuild[] = [];
    for (let i = 0; i < upperCount; i++) {
      const priority = i % 2 === 0 ? ['push'] : ['pull'];
      const muscles =
        i % 2 === 0
          ? ['Chest', 'Lats', 'Shoulders', 'Biceps', 'Triceps']
          : ['Chest', 'Back', 'Shoulders', 'Biceps', 'Long Head Tri'];
      const b = buildDay(upperPool, priority, muscles, usedUA);
      if (b.anchor) usedUA.add(b.anchor.id);
      upperBuilds.push(b);
    }
    const lowerBuilds: DayBuild[] = [];
    for (let i = 0; i < lowerCount; i++) {
      const priority = i % 2 === 0 ? ['squat'] : ['hinge'];
      const muscles =
        i % 2 === 0
          ? ['Hamstrings', 'Quads', 'Glutes', 'Gastrocnemius']
          : ['Quads', 'Glutes', 'Hamstrings', 'Soleus'];
      const b = buildDay(lowerPool, priority, muscles, usedLA);
      if (b.anchor) usedLA.add(b.anchor.id);
      lowerBuilds.push(b);
    }

    // Simple labels when only one of each kind, letter-suffixed otherwise.
    const upperLabel = (idx: number): string =>
      upperCount === 1 ? 'Upper' : `Upper ${String.fromCharCode(65 + idx)}`;
    const lowerLabel = (idx: number): string =>
      lowerCount === 1 ? 'Lower' : `Lower ${String.fromCharCode(65 + idx)}`;
    const upperMuscles = (idx: number): string =>
      idx % 2 === 0
        ? 'Chest · Back · Shoulders · Arms'
        : 'Shoulders · Back · Arms (Variation)';
    const lowerMuscles = (idx: number): string =>
      idx % 2 === 0
        ? 'Quads · Hamstrings · Glutes · Calves'
        : 'Hamstrings · Glutes · Quads (Variation)';

    let upperIdx = 0;
    let lowerIdx = 0;
    const days: TrainingDay[] = tags.map((tag, i) => {
      if (tag === 'UPPER') {
        const b = upperBuilds[upperIdx];
        const day = makeDay(
          i + 1,
          upperLabel(upperIdx),
          'UPPER',
          upperMuscles(upperIdx),
          dayNote('upper', b.anchor),
          b.anchor,
          b.accessories
        );
        upperIdx++;
        return day;
      }
      const b = lowerBuilds[lowerIdx];
      const day = makeDay(
        i + 1,
        lowerLabel(lowerIdx),
        'LOWER',
        lowerMuscles(lowerIdx),
        dayNote('lower', b.anchor),
        b.anchor,
        b.accessories
      );
      lowerIdx++;
      return day;
    });

    return days;
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
      const label =
        numDays === 1
          ? 'Full Body'
          : `Full Body ${String.fromCharCode(64 + dayNum)}`; // 1→A, 2→B, 3→C, 4→D, 5→E
      return {
        dayNum,
        label,
        tag: 'FULL',
        muscles: 'Full Body — Push · Pull · Legs',
        note: 'Full body session — compound anchors for push, pull, and legs.',
        cardio: null,
        exercises,
      } as any;
    }

    // Full Body — 2..5 days. Leg anchor alternates squat / hinge across sessions
    // to spread stress; push / pull anchors both run every day by design.
    const fullDays: TrainingDay[] = [];
    for (let i = 0; i < numDays; i++) {
      const legPriority = i % 2 === 0 ? ['squat'] : ['hinge'];
      fullDays.push(buildFullBodyDay(['push'], ['pull'], legPriority, i + 1));
    }
    return fullDays;
  }

  // PUSH / PULL — 2..6 days, alternating primary (Push) first.
  // Legs folded in — squats live on Push days, hinges on Pull days.
  if (splitType === 'push_pull') {
    const pushPlusLegs = available.filter(
      (e) => e.tag === 'PUSH' || (e.tag === 'LEGS' && e.pattern === 'squat')
    );
    const pullPlusLegs = available.filter(
      (e) => e.tag === 'PULL' || (e.tag === 'LEGS' && e.pattern === 'hinge')
    );

    const tags: ('PUSH' | 'PULL')[] = Array.from({ length: numDays }, (_, i) =>
      i % 2 === 0 ? 'PUSH' : 'PULL'
    );
    const pushCount = tags.filter((t) => t === 'PUSH').length;
    const pullCount = tags.filter((t) => t === 'PULL').length;

    const usedPA = new Set<string | number | undefined>();
    const usedRA = new Set<string | number | undefined>();

    const pushBuilds: DayBuild[] = [];
    for (let i = 0; i < pushCount; i++) {
      const muscles =
        i % 2 === 0
          ? ['Chest', 'Shoulders', 'Quads', 'Triceps']
          : ['Chest', 'Shoulders', 'Quads', 'Long Head Tri'];
      const b = buildDay(pushPlusLegs, ['push'], muscles, usedPA);
      if (b.anchor) usedPA.add(b.anchor.id);
      pushBuilds.push(b);
    }
    const pullBuilds: DayBuild[] = [];
    for (let i = 0; i < pullCount; i++) {
      const muscles =
        i % 2 === 0
          ? ['Lats', 'Back', 'Hamstrings', 'Biceps', 'Shoulders']
          : ['Lats', 'Back', 'Hamstrings', 'Glutes', 'Biceps'];
      const b = buildDay(pullPlusLegs, ['pull'], muscles, usedRA);
      if (b.anchor) usedRA.add(b.anchor.id);
      pullBuilds.push(b);
    }

    const pushLabel = (idx: number): string =>
      pushCount === 1 ? 'Push' : `Push ${String.fromCharCode(65 + idx)}`;
    const pullLabel = (idx: number): string =>
      pullCount === 1 ? 'Pull' : `Pull ${String.fromCharCode(65 + idx)}`;
    const pushMuscles = (idx: number): string =>
      idx % 2 === 0
        ? 'Chest · Shoulders · Triceps · Quads'
        : 'Shoulders · Chest · Triceps · Quads (Variation)';
    const pullMuscles = (idx: number): string =>
      idx % 2 === 0
        ? 'Back · Biceps · Rear Delts · Hamstrings'
        : 'Back · Biceps · Rear Delts · Hamstrings (Variation)';

    let pushIdx = 0;
    let pullIdx = 0;
    const days: TrainingDay[] = tags.map((tag, i) => {
      if (tag === 'PUSH') {
        const b = pushBuilds[pushIdx];
        const day = makeDay(
          i + 1,
          pushLabel(pushIdx),
          'PUSH',
          pushMuscles(pushIdx),
          dayNote('push', b.anchor),
          b.anchor,
          b.accessories
        );
        pushIdx++;
        return day;
      }
      const b = pullBuilds[pullIdx];
      const day = makeDay(
        i + 1,
        pullLabel(pullIdx),
        'PULL',
        pullMuscles(pullIdx),
        dayNote('pull', b.anchor),
        b.anchor,
        b.accessories
      );
      pullIdx++;
      return day;
    });

    return days;
  }

  // TRADITIONAL (Bro Split) — one body-part per day.
  // 5-day: Arms · Shoulders · Back · Chest · Legs (classic bodybuilding order).
  // 4-day: Chest · Back · Legs · Shoulders+Arms (combined — the most common
  //   4-day bro variant; user didn't specify, chose the convention that keeps
  //   legs isolated and pairs the two smaller muscle groups).
  //
  // Note: EXERCISE_DB's `tag` field is only PUSH/PULL/LEGS/CORE, so this split
  // filters pools by `muscle` (the primary muscle group) instead. Day-level
  // tags map each day back to an existing bucket (PUSH/PULL/LEGS) plus a new
  // ARMS tag for arm-focused days — verified via grep that nothing currently
  // consumes 'ARMS' as a day-level tag.
  if (splitType === 'traditional') {
    const chestPool = available.filter((e) => e.muscle === 'Chest');
    const backPool = available.filter(
      (e) => e.muscle === 'Back' || e.muscle === 'Lats'
    );
    const shouldersPool = available.filter((e) => e.muscle === 'Shoulders');
    const armsPool = available.filter(
      (e) => e.muscle === 'Biceps' || e.muscle === 'Triceps'
    );
    const legsPool = available.filter((e) => e.tag === 'LEGS');
    const shouldersArmsPool = available.filter((e) =>
      ['Shoulders', 'Biceps', 'Triceps'].includes(e.muscle)
    );

    const usedCA = new Set<string | number | undefined>();
    const usedBA = new Set<string | number | undefined>();
    const usedSA = new Set<string | number | undefined>();
    const usedAA = new Set<string | number | undefined>();
    const usedLA = new Set<string | number | undefined>();

    if (numDays === 4) {
      const chest = buildDay(
        chestPool,
        ['push'],
        dayMusclePriority(0, ['Chest', 'Shoulders', 'Triceps']),
        usedCA
      );
      const back = buildDay(
        backPool,
        ['pull'],
        dayMusclePriority(1, ['Lats', 'Back', 'Biceps', 'Upper Traps']),
        usedBA
      );
      const legs = buildDay(
        legsPool,
        ['squat'],
        dayMusclePriority(2, ['Hamstrings', 'Quads', 'Glutes', 'Gastrocnemius']),
        usedLA
      );
      const shoulArms = buildDay(
        shouldersArmsPool,
        ['push'],
        dayMusclePriority(3, ['Shoulders', 'Biceps', 'Triceps']),
        new Set<string | number | undefined>()
      );

      return [
        makeDay(
          1,
          'Chest',
          'PUSH',
          'Chest',
          dayNote('push', chest.anchor),
          chest.anchor,
          chest.accessories
        ),
        makeDay(
          2,
          'Back',
          'PULL',
          'Back · Lats',
          dayNote('pull', back.anchor),
          back.anchor,
          back.accessories
        ),
        makeDay(
          3,
          'Legs',
          'LEGS',
          'Quads · Hamstrings · Glutes · Calves',
          dayNote('legs', legs.anchor),
          legs.anchor,
          legs.accessories
        ),
        makeDay(
          4,
          'Shoulders + Arms',
          'PUSH',
          'Shoulders · Biceps · Triceps',
          dayNote('push', shoulArms.anchor),
          shoulArms.anchor,
          shoulArms.accessories
        ),
      ];
    }

    // 5-day: Arms · Shoulders · Back · Chest · Legs
    // Arms pool has no `anchor: true` exercises — buildDay falls back to the
    // compound-pattern sort (close-grip bench, diamond push-up, etc.).
    const arms = buildDay(
      armsPool,
      ['push'],
      dayMusclePriority(0, ['Triceps', 'Biceps']),
      usedAA
    );
    const shoulders = buildDay(
      shouldersPool,
      ['push'],
      dayMusclePriority(1, ['Shoulders']),
      usedSA
    );
    const back = buildDay(
      backPool,
      ['pull'],
      dayMusclePriority(2, ['Lats', 'Back', 'Biceps', 'Upper Traps']),
      usedBA
    );
    const chest = buildDay(
      chestPool,
      ['push'],
      dayMusclePriority(3, ['Chest', 'Shoulders', 'Triceps']),
      usedCA
    );
    const legs = buildDay(
      legsPool,
      ['squat'],
      dayMusclePriority(4, ['Hamstrings', 'Quads', 'Glutes', 'Gastrocnemius']),
      usedLA
    );

    return [
      makeDay(
        1,
        'Arms',
        'ARMS',
        'Biceps · Triceps',
        dayNote('push', arms.anchor),
        arms.anchor,
        arms.accessories
      ),
      makeDay(
        2,
        'Shoulders',
        'PUSH',
        'Shoulders',
        dayNote('push', shoulders.anchor),
        shoulders.anchor,
        shoulders.accessories
      ),
      makeDay(
        3,
        'Back',
        'PULL',
        'Back · Lats',
        dayNote('pull', back.anchor),
        back.anchor,
        back.accessories
      ),
      makeDay(
        4,
        'Chest',
        'PUSH',
        'Chest',
        dayNote('push', chest.anchor),
        chest.anchor,
        chest.accessories
      ),
      makeDay(
        5,
        'Legs',
        'LEGS',
        'Quads · Hamstrings · Glutes · Calves',
        dayNote('legs', legs.anchor),
        legs.anchor,
        legs.accessories
      ),
    ];
  }

  // Fallback
  return generateProgram(
    { ...profile, splitType: 'ppl', daysPerWeek: 3, workoutDays: [1, 3, 5] },
    EXERCISE_DB
  );
}
