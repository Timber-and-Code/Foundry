// ─── PHASE COLORS ────────────────────────────────────────────────────────────
// Maps training phases to their UI accent colors
export const PHASE_COLOR = {
  Accumulation: '#E8E4DC',
  Intensification: '#E8651A',
  Peak: '#D4983C',
  Deload: '#5B8FA8',
};

// ─── TAG ACCENT COLORS ───────────────────────────────────────────────────────
// Maps movement tags to their UI accent colors
export const TAG_ACCENT = {
  PUSH: '#E8651A',
  PULL: '#C0592B',
  LEGS: '#D47830',
  UPPER: '#E8651A',
  LOWER: '#D47830',
  FULL: '#E8651A',
  CARDIO: '#D4A03C',
};

// ─── VOLUME LANDMARKS ────────────────────────────────────────────────────────
// Weekly working sets per muscle group: mev (minimum effective volume),
// mavLow–mavHigh (sweet spot range), mrv (maximum recoverable volume)
export const VOLUME_LANDMARKS = {
  Chest: { mev: 8, mavLow: 10, mavHigh: 20, mrv: 22 },
  Back: { mev: 10, mavLow: 14, mavHigh: 22, mrv: 25 },
  Shoulders: { mev: 6, mavLow: 8, mavHigh: 16, mrv: 20 },
  Triceps: { mev: 4, mavLow: 6, mavHigh: 14, mrv: 18 },
  Biceps: { mev: 6, mavLow: 8, mavHigh: 14, mrv: 20 },
  Quads: { mev: 8, mavLow: 10, mavHigh: 20, mrv: 25 },
  Hamstrings: { mev: 6, mavLow: 8, mavHigh: 16, mrv: 20 },
  Glutes: { mev: 4, mavLow: 6, mavHigh: 16, mrv: 20 },
  Calves: { mev: 6, mavLow: 8, mavHigh: 16, mrv: 20 },
  Traps: { mev: 4, mavLow: 6, mavHigh: 12, mrv: 16 },
  Core: { mev: 4, mavLow: 6, mavHigh: 12, mrv: 16 },
};

// ─── DAY COLORS ──────────────────────────────────────────────────────────────
// Cycle of colors for different training days
export const DAY_COLORS = ['#E8651A', '#C87D4A', '#D4983C', '#C0592B'];

// ─── STANDARD WARMUP PROTOCOL ────────────────────────────────────────────────
// Progressive loading steps for any working set
export const WARMUP = [
  {
    load: 'Bar only',
    reps: '10',
    note: 'Neural activation — feel the groove, zero load.',
  },
  { load: '50%', reps: '5', note: 'Dial in bar path. Controlled tempo.' },
  { load: '70%', reps: '3', note: 'Approaching working weight. Stay tight.' },
  { load: '85%', reps: '1', note: 'Final primer — then load up and go.' },
];

// ─── FOUNDRY MOBILITY DATA ───────────────────────────────────────────────────
// Tag-based mobility moves for warmups and recovery.
// Referenced by: HomeView recovery card · calendar rest-day sheet · DayView warmup/cooldown
export const FOUNDRY_MOBILITY = {
  PUSH: [
    {
      name: 'Arm Circles → Wall Slides',
      cue: "10 arm circles each direction, then face a wall, arms in 'goalpost' position, slowly slide up and down. 10 reps. Wakes up shoulders and scapulae.",
    },
    {
      name: 'Band Pull-Aparts',
      cue: 'Light band at chest height, pull apart with straight arms, squeezing shoulder blades. 15–20 reps. Activates rear delts and stabilizers.',
    },
    {
      name: 'Push-Up to Downward Dog',
      cue: 'Do a push-up, then press hips up into downward dog. Hold 2 sec, return. 8 reps. Opens chest, shoulders, and thoracic spine dynamically.',
    },
  ],
  PULL: [
    {
      name: 'Cat-Cow to Thread the Needle',
      cue: 'Start on all fours — 5 cat-cows, then thread one arm under and through, rotating the upper back. 5 per side. Primes thoracic rotation.',
    },
    {
      name: 'Band Face Pulls',
      cue: 'Light band at face height, pull to ears with elbows high. Squeeze rear delts at the top. 15 reps. Activates the pulling muscles.',
    },
    {
      name: 'Scapular Pull-Ups (or Dead Hangs)',
      cue: 'Hang from a bar, retract and depress scapulae without bending elbows. 10 reps. If no bar, do scapular push-ups from plank. Wakes up lats.',
    },
  ],
  LEGS: [
    {
      name: 'Hip Circles to Leg Swings',
      cue: '10 hip circles each direction, then 10 front-to-back and side-to-side leg swings per leg. Opens hip capsule dynamically.',
    },
    {
      name: 'Bodyweight Squats with Pause',
      cue: 'Slow bodyweight squats — 3 sec down, 2 sec pause in the hole, drive up. 10 reps. Greases the groove for the session ahead.',
    },
    {
      name: 'Walking Lunges with Twist',
      cue: 'Step into a lunge, rotate torso over the front knee. Alternate legs, 5 per side. Activates glutes, hip flexors, and core together.',
    },
  ],
};

// ─── DAILY MOBILITY ROUTINE ──────────────────────────────────────────────────
// Neutral, tag-agnostic movements for daily mobility work
export const DAILY_MOBILITY = [
  {
    name: 'Cat-Cow',
    cue: 'On hands and knees, alternate between arching your back up (cat) and dropping your belly down (cow). 10 slow reps, breathing with each movement.',
  },
  {
    name: '90/90 Hip Stretch',
    cue: 'Sit on the ground, one leg bent in front (90°), one bent to the side (90°). Fold forward gently. Hold 30 sec each side. Deep hip opener.',
  },
  {
    name: "Child's Pose",
    cue: 'Knees wide, sink your hips to your heels, arms extended forward. Hold 45 sec. Rests the lower back and stretches lats.',
  },
  {
    name: 'Quadruped Rocks',
    cue: 'Hands and knees, rock hips back and forth over your heels. 20 slow rocks. Opens hip flexors and quiets the nervous system.',
  },
  {
    name: 'Seated Spinal Twist',
    cue: 'Sit tall, cross one leg over the other, hug the top knee to your chest, twist gently. Hold 30 sec each side. Decompress the spine.',
  },
];

// ─── GOAL OPTIONS ────────────────────────────────────────────────────────────
// User training goal profiles
export const GOAL_OPTIONS = [
  {
    id: 'build_muscle',
    label: 'Build Muscle',
    desc: 'Maximize hypertrophy. High volume, progressive overload, size-focused.',
    priority: 'size',
  },
  {
    id: 'build_strength',
    label: 'Build Strength',
    desc: 'Chase PRs. Heavier loads, lower reps, strength-first programming.',
    priority: 'strength',
  },
  {
    id: 'lose_fat',
    label: 'Lose Fat',
    desc: 'Body recomp. Cardio pairing matters. Lift to retain muscle.',
    priority: 'both',
  },
  {
    id: 'improve_fitness',
    label: 'Improve Fitness',
    desc: 'General health and conditioning. Balanced lifting and cardio capacity.',
    priority: 'both',
  },
  {
    id: 'sport_conditioning',
    label: 'Sport & Conditioning',
    desc: 'Athletic output. Power, work capacity, performance transfer.',
    priority: 'both',
  },
];

// ─── CARDIO WORKOUTS ─────────────────────────────────────────────────────────
// Pre-built cardio session templates
export const CARDIO_WORKOUTS = [
  {
    id: 'easy_walk',
    label: 'Easy Walk',
    description: 'Low-intensity steady state. Improves aerobic base and is recovery-friendly.',
    category: 'Endurance',
    defaultType: 'Walk',
    defaultDuration: 35,
    defaultIntensity: 'Easy',
    recommendedFor: ['build_muscle', 'build_strength', 'lose_fat', 'improve_fitness'],
  },
  {
    id: 'zone2_run',
    label: 'Zone 2 Run',
    description: 'Build your aerobic engine. Sweet spot for fat loss and endurance.',
    category: 'Endurance',
    defaultType: 'Run',
    defaultDuration: 40,
    defaultIntensity: 'Moderate',
    recommendedFor: ['lose_fat', 'improve_fitness', 'sport_conditioning'],
  },
  {
    id: 'tempo_run',
    label: 'Tempo Run',
    description: 'Threshold work. Improves lactate clearance and sustained work capacity.',
    category: 'Performance',
    defaultType: 'Run',
    defaultDuration: 25,
    defaultIntensity: 'Hard',
    recommendedFor: ['improve_fitness', 'sport_conditioning'],
  },
  {
    id: 'hiit_bike',
    label: 'HIIT Bike (Tabata)',
    description: 'Max-effort intervals. Boosts VO2 max and metabolic conditioning fast.',
    category: 'Quick & Intense',
    defaultType: 'Bike',
    defaultDuration: 20,
    defaultIntensity: 'Hard',
    recommendedFor: ['lose_fat', 'improve_fitness', 'sport_conditioning'],
    intervals: { workSecs: 20, restSecs: 10, rounds: 8 },
  },
  {
    id: 'long_steady',
    label: 'Long Steady State',
    description: 'Build mental toughness and aerobic depth. Often a weekend session.',
    category: 'Endurance',
    defaultType: 'Run',
    defaultDuration: 75,
    defaultIntensity: 'Moderate',
    recommendedFor: ['improve_fitness', 'sport_conditioning'],
  },
  {
    id: 'swim',
    label: 'Steady Swim',
    description: 'Low-impact, full-body cardio. Great for recovery and supplemental conditioning.',
    category: 'Conditioning',
    defaultType: 'Swim',
    defaultDuration: 35,
    defaultIntensity: 'Moderate',
    recommendedFor: ['build_muscle', 'build_strength', 'improve_fitness'],
  },
  {
    id: 'jump_rope',
    label: 'Jump Rope Circuit',
    description: 'High coordination and high calorie burn. Keep rest short.',
    category: 'Conditioning',
    defaultType: 'Other',
    defaultDuration: 20,
    defaultIntensity: 'Hard',
    recommendedFor: ['lose_fat', 'sport_conditioning'],
  },
];

// ─── MOBILITY PROTOCOLS ──────────────────────────────────────────────────────
// Longer, structured mobility routines for deep work and injury prevention
export const MOBILITY_PROTOCOLS = [
  {
    id: 'shoulder_rehab',
    name: 'Shoulder Rehab & Prevention',
    duration: '15 min',
    moves: [
      {
        name: 'Shoulder Dislocations',
        reps: '12 each direction',
        cue: 'Light band or dowel. Start narrow, move through full range.',
      },
      {
        name: 'Wall Slides',
        reps: '15',
        cue: 'Back against wall, slide arms up and down, keeping contact.',
      },
      {
        name: 'YTWs',
        reps: '10 each position',
        cue: 'Prone, form Y, T, W shapes. Light weight or bodyweight.',
      },
      {
        name: 'Dead Hangs',
        reps: '30 sec hold',
        cue: 'Relax shoulders into stretch. 3 sets.',
      },
    ],
  },
  {
    id: 'hip_mobility',
    name: 'Deep Hip Opener',
    duration: '20 min',
    moves: [
      {
        name: '90/90 Stretch',
        reps: '45 sec each side',
        cue: 'One leg forward, one to side, fold gently over front leg.',
      },
      {
        name: 'Pigeon Pose',
        reps: '60 sec each side',
        cue: 'Quad stretched leg in back, hip-opener leg in front. Relax torso forward.',
      },
      {
        name: "World's Greatest Stretch",
        reps: '5 each side',
        cue: 'Lunge, rotate, touch ground. Hits everything.',
      },
      {
        name: 'Lizard Pose',
        reps: '45 sec each side',
        cue: 'Low lunge, forearms down. Feel the groin and hip flexor.',
      },
    ],
  },
  {
    id: 'spine_decompression',
    name: 'Spine Decompression & Breathing',
    duration: '10 min',
    moves: [
      {
        name: 'Dead Hangs',
        reps: '30 sec × 3',
        cue: 'Let gravity do the work. Relax.',
      },
      {
        name: "Child's Pose",
        reps: '60 sec',
        cue: 'Wide knees, sink hips, breathe into lower back.',
      },
      {
        name: 'Sphinx Pose',
        reps: '30 sec × 2',
        cue: "Gentle backbend on forearms. Don't force extension.",
      },
      {
        name: 'Box Breathing',
        reps: '5 min',
        cue: '4 count in, 4 hold, 4 out, 4 hold. Settle the nervous system.',
      },
    ],
  },
  {
    id: 'full_body_flow',
    name: 'Full-Body Mobility Flow',
    duration: '25 min',
    moves: [
      { name: 'Cat-Cow', reps: '10 slow', cue: 'Move with breath.' },
      {
        name: 'Inchworms',
        reps: '8',
        cue: 'Walk hands out to plank, walk feet to hands, stand.',
      },
      {
        name: "World's Greatest Stretch",
        reps: '3 each side',
        cue: 'Lunge, rotate, reach. Covers everything.',
      },
      {
        name: 'Downward Dog to Upward Dog',
        reps: '10',
        cue: 'Alternate between poses, breathe steadily.',
      },
      {
        name: 'Walking Lunges with Twist',
        reps: '10 each leg',
        cue: 'Step, rotate torso, feel the hip opening.',
      },
      {
        name: 'Spinal Twists',
        reps: '30 sec each side',
        cue: 'Lying on back, pull one knee across, let gravity twist.',
      },
    ],
  },
];

// ─── MESO CONFIG BUILDER ─────────────────────────────────────────────────────
// Builds the mesocycle configuration object from user profile settings.
// Returns { weeks, days, splitType, phases, rirs, mesoRows, progTargets }
export function buildMesoConfig(mesoLen, daysPerWeek, splitType) {
  const configs = {
    4: {
      rirs: ['3 RIR', '2 RIR', '1 RIR', '0-1 RIR'],
      mesoRows: [
        [0, '3 RIR', 'Accumulation', 'Establish baseline. Leave plenty in the tank. Form focus.'],
        [
          1,
          '2 RIR',
          'Accumulation',
          'Match weights, refine technique. Add weight where it feels easy.',
        ],
        [2, '1 RIR', 'Peak', 'Push close to failure. +5 lbs on anchors.'],
        [3, '0-1 RIR', 'Peak', 'PR attempts on anchors. Maximum effort week.'],
        [null, 'N/A', 'DELOAD', '50-60% of peak weight. 2 sets only. Zero failure. Recover.'],
      ],
    },
    6: {
      rirs: ['3 RIR', '2-3 RIR', '2 RIR', '1-2 RIR', '1 RIR', '0-1 RIR'],
      mesoRows: [
        [0, '3 RIR', 'Accumulation', 'Establish baseline. Leave plenty in the tank. Form focus.'],
        [1, '2-3 RIR', 'Accumulation', 'Match weights with better technique. Small adds if easy.'],
        [2, '2 RIR', 'Intensification', '+5 lbs anchors. Push closer to failure on accessories.'],
        [3, '1-2 RIR', 'Intensification', '+5 lbs anchors again. Accessories +2.5-5 lbs.'],
        [4, '1 RIR', 'Peak', '+5 lbs. One rep from failure. Push hard.'],
        [5, '0-1 RIR', 'Peak', 'PR attempts on anchors. Max effort week.'],
        [null, 'N/A', 'DELOAD', '50-60% of W6 weight. 2 sets only. Zero failure. Recover.'],
      ],
    },
    8: {
      rirs: ['4 RIR', '3 RIR', '2-3 RIR', '2 RIR', '1-2 RIR', '1-2 RIR', '1 RIR', '0-1 RIR'],
      mesoRows: [
        [0, '4 RIR', 'Accumulation', 'Establish baseline. Technique first. Build the groove.'],
        [1, '3 RIR', 'Accumulation', 'Small weight adds. Stay far from failure.'],
        [2, '2-3 RIR', 'Accumulation', '+2.5-5 lbs. Volume is the goal this block.'],
        [
          3,
          '2 RIR',
          'Intensification',
          'Transition week. +5 lbs on anchors. Technique stays tight.',
        ],
        [4, '1-2 RIR', 'Intensification', '+5 lbs. Push accessories near failure.'],
        [5, '1-2 RIR', 'Intensification', 'Hold or add small. Fatigue management.'],
        [6, '1 RIR', 'Peak', 'One rep from failure. PR setup week.'],
        [7, '0-1 RIR', 'Peak', 'PR attempts on all anchors. Max effort.'],
        [null, 'N/A', 'DELOAD', '50-60% of peak weight. 2 sets only. Zero failure. Recover.'],
      ],
    },
    10: {
      rirs: [
        '4 RIR',
        '3-4 RIR',
        '3 RIR',
        '2-3 RIR',
        '2 RIR',
        '1-2 RIR',
        '1-2 RIR',
        '1 RIR',
        '0-1 RIR',
        '0 RIR',
      ],
      mesoRows: [
        [0, '4 RIR', 'Accumulation', 'Establish baseline. Volume focus. No heroics.'],
        [1, '3-4 RIR', 'Accumulation', 'Small adds on anchors. Build work capacity.'],
        [2, '3 RIR', 'Accumulation', '+2.5-5 lbs across the board.'],
        [3, '2-3 RIR', 'Accumulation', 'Final accumulation push. High volume.'],
        [4, '2 RIR', 'Intensification', 'Transition to heavier loads. +5 lbs anchors.'],
        [5, '1-2 RIR', 'Intensification', '+5 lbs. Accessories follow suit.'],
        [6, '1-2 RIR', 'Intensification', 'Hold or small adds. Manage fatigue.'],
        [7, '1 RIR', 'Peak', 'One rep from failure. PR prep.'],
        [8, '0-1 RIR', 'Peak', 'Near-limit loads. Set up the PR week.'],
        [9, '0 RIR', 'Peak', 'Max effort. PR attempts on all anchors.'],
        [null, 'N/A', 'DELOAD', '50-60% of peak weight. 2 sets only. Zero failure. Recover.'],
      ],
    },
    12: {
      rirs: [
        '4 RIR',
        '4 RIR',
        '3 RIR',
        '3 RIR',
        '2-3 RIR',
        '2 RIR',
        '2 RIR',
        '1-2 RIR',
        '1 RIR',
        '0-1 RIR',
        '0-1 RIR',
        '0 RIR',
      ],
      mesoRows: [
        [0, '4 RIR', 'Accumulation', 'Establish baseline. Long meso — patience pays off.'],
        [1, '4 RIR', 'Accumulation', 'Refine technique. Small adds only if very easy.'],
        [2, '3 RIR', 'Accumulation', '+2.5 lbs. Build the volume base.'],
        [3, '3 RIR', 'Accumulation', '+2.5-5 lbs. Final volume block push.'],
        [4, '2-3 RIR', 'Intensification', 'Transition. +5 lbs anchors. Technique stays tight.'],
        [5, '2 RIR', 'Intensification', '+5 lbs across. Push accessories toward failure.'],
        [6, '2 RIR', 'Intensification', 'Hold or +2.5 lbs. Fatigue management block.'],
        [
          7,
          '1-2 RIR',
          'Intensification',
          'Final intensification push. High load, controlled failure.',
        ],
        [8, '1 RIR', 'Peak', 'One rep from failure. PR setup begins.'],
        [9, '0-1 RIR', 'Peak', 'Near-limit. Lock in the numbers.'],
        [10, '0-1 RIR', 'Peak', 'Set your stage. Final prep.'],
        [11, '0 RIR', 'Peak', 'Max effort. PR attempts on all anchors.'],
        [null, 'N/A', 'DELOAD', '50-60% of peak weight. 2 sets only. Zero failure. Recover.'],
      ],
    },
  };
  const cfg = configs[mesoLen] || configs[6];
  const pw = Array.from({ length: mesoLen }, (_, i) => {
    if (i === 0) return 'Establish';
    if (i === mesoLen - 1) return 'PR attempt';
    if (i < Math.ceil(mesoLen * 0.4)) return '+ 2.5 lbs';
    return '+5 lbs';
  });
  const pr = Array.from({ length: mesoLen }, (_, i) => {
    if (i === 0) return 'Establish';
    if (i === mesoLen - 1) return 'Max reps / PR';
    if (i === Math.floor(mesoLen / 2)) return '↑ weight';
    return '+1-2 reps';
  });
  const weekPhases = cfg.mesoRows.filter((r) => r[0] !== null).map((r) => r[2]);
  weekPhases.push('Deload');

  return {
    weeks: mesoLen + 1,
    days: daysPerWeek || 6,
    splitType: splitType || 'ppl',
    phases: weekPhases,
    rirs: [...cfg.rirs, 'N/A — DELOAD'],
    mesoRows: cfg.mesoRows,
    progTargets: { weight: pw, reps: pr },
  };
}

// ─── LAZY MESO SINGLETON ─────────────────────────────────────────────────────
// Reads stored profile to compute MESO config. Components can import getMeso().
let _mesoCache = null;
export function getMeso() {
  if (_mesoCache) return _mesoCache;
  try {
    const raw = localStorage.getItem('foundry:profile');
    const p = raw ? JSON.parse(raw) : null;
    if (p) {
      _mesoCache = buildMesoConfig(
        p.mesoLength || 6,
        p.workoutDays?.length || p.daysPerWeek || 6,
        p.splitType || 'ppl'
      );
      return _mesoCache;
    }
  } catch {}
  return buildMesoConfig(6, 6, 'ppl');
}
export function resetMesoCache() {
  _mesoCache = null;
}

// Convenience getters for commonly imported derived values
export function getWeekPhase() {
  return getMeso().phases;
}
export function getWeekRir() {
  return getMeso().rirs;
}
export function getProgTargets() {
  return getMeso().progTargets;
}
export function getMesoRows() {
  return getMeso().mesoRows;
}

// ─── COOLDOWN MOBILITY (post-workout, tag-specific) ─────────────────────────
export const FOUNDRY_COOLDOWN = {
  PUSH: [
    {
      name: 'Doorway Pec Stretch',
      cue: 'Place forearm on a doorframe, step through gently. Hold 30s each side. Opens up the chest after pressing.',
    },
    {
      name: 'Overhead Tricep Stretch',
      cue: 'Reach one arm overhead, bend elbow, press with opposite hand. 30s each. Releases triceps and shoulder.',
    },
    {
      name: 'Wall Slide Cool-Down',
      cue: 'Back flat on wall, arms in goalpost. Slide up/down slowly x10. Resets scapulae after pressing work.',
    },
  ],
  PULL: [
    {
      name: 'Cross-Body Shoulder Stretch',
      cue: 'Pull one arm across your chest with the opposite hand. 30s each side. Opens rear delts after pulling.',
    },
    {
      name: 'Lat Hang / Dead Hang',
      cue: 'Hang from a bar with relaxed grip, 20–30s. Decompresses spine and stretches lats after rows and pulldowns.',
    },
    {
      name: 'Seated Spinal Twist',
      cue: 'Sit cross-legged, twist gently to each side. 30s each. Releases mid-back tension from pulling.',
    },
  ],
  LEGS: [
    {
      name: 'Standing Quad Stretch',
      cue: 'Grab ankle behind you, keep knees together. 30s each leg. Essential after squats and leg presses.',
    },
    {
      name: 'Seated Hamstring Stretch',
      cue: 'Sit with one leg extended, reach for toes. 30s each side. Loosens hamstrings after deadlifts and curls.',
    },
    {
      name: '90/90 Hip Stretch',
      cue: 'Sit with both legs at 90°, lean gently over front shin. 30s each side. Opens hips after any leg work.',
    },
  ],
};

// ─── REST DAY QUOTES ────────────────────────────────────────────────────────
export const REST_QUOTES = [
  'Recovery is where growth happens. You broke it down — now let it build back stronger.',
  "The iron doesn't make you strong. Rest does. The iron just shows you where you're going.",
  'Sleep, eat, hydrate. The boring stuff is what separates good from great.',
  "Your muscles don't grow in the gym. They grow right now, while you recover.",
  "A rest day isn't a day off — it's a day your body catches up to your effort.",
  'Trust the process. The gains are being forged while you rest.',
  'Every elite athlete prioritizes recovery. You should too.',
  'You earned this rest. Tomorrow, you come back sharper.',
  "Discipline isn't just showing up. It's knowing when to step back.",
  'Stretch. Walk. Breathe. Your body will thank you in the next session.',
  "The best program in the world fails without recovery. You're doing this right.",
  'Think of rest days as part of your training — because they are.',
];

// ─── RECOVERY TIPS ───────────────────────────────────────────────────────────
export const RECOVERY_TIPS = [
  {
    label: 'Protein window',
    tip: 'Get 40–50g of protein within 90 minutes. Muscle protein synthesis peaks in this window and drops off sharply after 2 hours.',
  },
  {
    label: 'Hydration',
    tip: "Drink 16–24 oz of water in the next hour. You lost more fluid than you realize, even if you didn't feel like you sweat much.",
  },
  {
    label: 'Sleep is the rep',
    tip: "More adaptation happens during deep sleep than in the gym. 7–9 hours tonight isn't optional — it's where the gains are built.",
  },
  {
    label: "Don't sit for long",
    tip: 'Keep moving gently for the next few hours. A 10-minute walk after training clears lactate and reduces next-day soreness more than static rest.',
  },
  {
    label: 'Carbs matter now',
    tip: 'Replenish glycogen with 50–100g of carbs in the next two hours — especially before a back-to-back training day. Rice, oats, fruit all work.',
  },
  {
    label: 'Cold vs. heat',
    tip: 'Ice baths blunt inflammation — which also blunts adaptation. For hypertrophy, skip the cold plunge on heavy days. Save it for competition or injury.',
  },
  {
    label: 'Manage stress',
    tip: 'Cortisol competes directly with testosterone and growth hormone. High stress outside the gym slows recovery more than most training variables.',
  },
  {
    label: 'Mobility window',
    tip: "Your muscles are warm and pliable for the next 30 minutes. 5–10 minutes of targeted stretching now will pay off in next session's range of motion.",
  },
  {
    label: 'Creatine timing',
    tip: 'If you take creatine, post-workout with carbs and protein is the most studied timing. Muscle uptake is elevated for 1–2 hours after training.',
  },
  {
    label: 'Next session prep',
    tip: "The best warmup for tomorrow's session starts with today's recovery. Enough sleep, food, and water means you arrive primed — not just present.",
  },
  {
    label: 'Rate your soreness',
    tip: "Some soreness is normal. Joint pain is not. Track which exercises left you sore — if the same joint hurts after multiple sessions, it's a signal to address technique or load.",
  },
  {
    label: 'Alcohol blunts gains',
    tip: "Even moderate alcohol intake in the 4 hours post-training measurably reduces muscle protein synthesis. One drink won't ruin anything — a night out might.",
  },
  {
    label: 'Magnesium for sleep',
    tip: 'Magnesium glycinate (200–400mg before bed) supports deeper sleep and reduces muscle cramps overnight — both matter on heavy training days.',
  },
  {
    label: 'Progressive overload is cumulative',
    tip: "Today's session contributes to a trend, not a single outcome. Recovery determines whether today's stimulus becomes tomorrow's adaptation.",
  },
];

// ─── CONGRATS ────────────────────────────────────────────────────────────────
export const CONGRATS = [
  {
    headline: 'SESSION LOGGED.',
    sub: 'Work done. Rest, recover, come back stronger.',
  },
  {
    headline: 'STANDARD MET.',
    sub: 'Every session is a deposit. This one counts.',
  },
  { headline: 'WORK COMPLETE.', sub: 'Not everyone showed up today. You did.' },
  {
    headline: 'SESSION RECORDED.',
    sub: 'Progress is built in increments. This was one.',
  },
  { headline: 'DONE.', sub: "Consistency over time. That's the whole system." },
  { headline: 'LOGGED.', sub: 'You made a commitment and you kept it.' },
  {
    headline: 'ANOTHER ONE IN.',
    sub: 'Strength is built in sessions exactly like this one.',
  },
  {
    headline: 'WEEK ADVANCES.',
    sub: 'Rest well. The next session is already on the schedule.',
  },
];

// ─── MOTIVATIONAL QUOTES ─────────────────────────────────────────────────────
export const QUOTES = [
  {
    text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    author: 'Aristotle',
  },
  {
    text: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
  },
  {
    text: 'The secret of getting ahead is getting started.',
    author: 'Mark Twain',
  },
  {
    text: "Don't count the days, make the days count.",
    author: 'Muhammad Ali',
  },
  {
    text: "Success isn't always about greatness. It's about consistency.",
    author: 'Dwayne Johnson',
  },
  {
    text: "You don't have to be great to start, but you have to start to be great.",
    author: 'Zig Ziglar',
  },
  {
    text: 'Small daily improvements over time lead to stunning results.',
    author: 'Robin Sharma',
  },
  {
    text: 'The pain you feel today will be the strength you feel tomorrow.',
    author: 'Arnold Schwarzenegger',
  },
  {
    text: 'Motivation gets you started. Habit keeps you going.',
    author: 'Jim Ryun',
  },
  {
    text: 'Strength does not come from the body. It comes from the will of the soul.',
    author: 'Mahatma Gandhi',
  },
  {
    text: "The only bad workout is the one that didn't happen.",
    author: 'Unknown',
  },
  {
    text: "Your body can stand almost anything. It's your mind you have to convince.",
    author: 'Unknown',
  },
  {
    text: "If it doesn't challenge you, it doesn't change you.",
    author: 'Fred DeVito',
  },
  {
    text: "The harder you work for something, the greater you'll feel when you achieve it.",
    author: 'Unknown',
  },
  {
    text: 'Push yourself because no one else is going to do it for you.',
    author: 'Unknown',
  },
  {
    text: 'Tough times never last, but tough people do.',
    author: 'Robert H. Schuller',
  },
  {
    text: 'The difference between the impossible and the possible lies in determination.',
    author: 'Tommy Lasorda',
  },
  { text: "Go the extra mile. It's never crowded.", author: 'Wayne Dyer' },
  {
    text: "Champions aren't made in gyms. Champions are made from something they have deep inside.",
    author: 'Muhammad Ali',
  },
  {
    text: 'The only way to define your limits is by going beyond them.',
    author: 'Arthur C. Clarke',
  },
  { text: 'Great things never came from comfort zones.', author: 'Unknown' },
  {
    text: "Whether you think you can or you think you can't, you're right.",
    author: 'Henry Ford',
  },
  {
    text: "It's not whether you get knocked down, it's whether you get up.",
    author: 'Vince Lombardi',
  },
  {
    text: 'The mind is the limit. As long as the mind can envision it, you can achieve it.',
    author: 'Arnold Schwarzenegger',
  },
  {
    text: "You miss 100% of the shots you don't take.",
    author: 'Wayne Gretzky',
  },
  { text: 'I never lose. I either win or I learn.', author: 'Nelson Mandela' },
  {
    text: "Believe you can and you're halfway there.",
    author: 'Theodore Roosevelt',
  },
  {
    text: 'The only person you are destined to become is the person you decide to be.',
    author: 'Ralph Waldo Emerson',
  },
  {
    text: 'Do something today that your future self will thank you for.',
    author: 'Sean Patrick Flanery',
  },
  {
    text: 'Act as if what you do makes a difference. It does.',
    author: 'William James',
  },
];

export const QUOTES_FEMALE = [
  {
    text: "I'd rather regret the things I've done than regret the things I haven't done.",
    author: 'Lucille Ball',
  },
  {
    text: 'A woman is like a tea bag — you never know how strong she is until she gets in hot water.',
    author: 'Eleanor Roosevelt',
  },
  {
    text: 'Well-behaved women seldom make history.',
    author: 'Laurel Thatcher Ulrich',
  },
  {
    text: 'I am not afraid of storms, for I am learning how to sail my ship.',
    author: 'Louisa May Alcott',
  },
  {
    text: "The question isn't who's going to let me; it's who's going to stop me.",
    author: 'Ayn Rand',
  },
  { text: 'She believed she could, so she did.', author: 'R.S. Grey' },
  {
    text: "Nothing is impossible. The word itself says 'I'm possible.'",
    author: 'Audrey Hepburn',
  },
  { text: 'I can and I will. Watch me.', author: 'Carrie Green' },
  {
    text: 'Think like a queen. A queen is not afraid to fail. Failure is another stepping stone to greatness.',
    author: 'Oprah Winfrey',
  },
  {
    text: 'No one can make you feel inferior without your consent.',
    author: 'Eleanor Roosevelt',
  },
  {
    text: "Strong women don't have attitudes — they have standards.",
    author: 'Unknown',
  },
  {
    text: "Make yourself a priority once in a while. It's not selfish. It's necessary.",
    author: 'Unknown',
  },
  {
    text: 'A strong woman looks a challenge dead in the eye and gives it a wink.',
    author: 'Gina Carey',
  },
  {
    text: 'The most alluring thing a woman can have is confidence.',
    author: 'Beyoncé',
  },
  {
    text: 'The vision of a champion is bent over, drenched in sweat, at the point of exhaustion, when nobody else is looking.',
    author: 'Mia Hamm',
  },
  {
    text: 'Lift up your head queen, if not the crown falls.',
    author: 'Unknown',
  },
  {
    text: "Be your own hero. It's cheaper than therapy and more fun.",
    author: 'Unknown',
  },
  {
    text: 'You are more powerful than you know; you are beautiful just as you are.',
    author: 'Melissa Etheridge',
  },
];

export const QUOTES_MALE = [
  {
    text: "I hated every minute of training, but I said, don't quit. Suffer now and live the rest of your life as a champion.",
    author: 'Muhammad Ali',
  },
  {
    text: 'The mind is the limit. As long as the mind can envision it, you can achieve it.',
    author: 'Arnold Schwarzenegger',
  },
  {
    text: "You can't climb the ladder of success with your hands in your pockets.",
    author: 'Arnold Schwarzenegger',
  },
  {
    text: "Today I will do what others won't, so tomorrow I can do what others can't.",
    author: 'Jerry Rice',
  },
  {
    text: 'Pain is temporary. Quitting lasts forever.',
    author: 'Lance Armstrong',
  },
  {
    text: "There may be people that have more talent than you, but there's no excuse for anyone to work harder than you do.",
    author: 'Derek Jeter',
  },
  {
    text: "I've failed over and over again. And that is why I succeed.",
    author: 'Michael Jordan',
  },
  {
    text: 'Some people want it to happen, some wish it would happen, others make it happen.',
    author: 'Michael Jordan',
  },
  {
    text: "I can accept failure, everyone fails at something. But I can't accept not trying.",
    author: 'Michael Jordan',
  },
  {
    text: "Champions aren't made in gyms. Champions are made from something they have deep inside.",
    author: 'Muhammad Ali',
  },
  {
    text: "Don't count the days, make the days count.",
    author: 'Muhammad Ali',
  },
  {
    text: "Success isn't always about greatness. It's about consistency.",
    author: 'Dwayne Johnson',
  },
  {
    text: 'The more difficult the victory, the greater the happiness in winning.',
    author: 'Pelé',
  },
  {
    text: 'You were born to be a player. You were meant to be here.',
    author: 'Herb Brooks',
  },
  {
    text: "Hard work beats talent when talent doesn't work hard.",
    author: 'Tim Notke',
  },
  {
    text: "Most people give up just when they're about to achieve success.",
    author: 'Ross Perot',
  },
  { text: 'The more I practice, the luckier I get.', author: 'Arnold Palmer' },
  {
    text: "Set your goals high and don't stop until you get there.",
    author: 'Bo Jackson',
  },
];

export function randomQuote(gender) {
  let pool;
  if (gender === 'f') {
    pool = [...QUOTES_FEMALE, ...QUOTES_FEMALE, ...QUOTES];
  } else if (gender === 'm') {
    pool = [...QUOTES_MALE, ...QUOTES_MALE, ...QUOTES];
  } else {
    pool = QUOTES;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomCongrats() {
  return CONGRATS[Math.floor(Math.random() * CONGRATS.length)];
}
