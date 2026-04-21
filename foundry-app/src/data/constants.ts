import type { MesoConfig, SplitType } from '../types';
import { store } from '../utils/storage';

// ─── PHASE COLORS ────────────────────────────────────────────────────────────
// Maps training phases to their UI accent colors
export const PHASE_COLOR: Record<string, string> = {
  Establish: '#7A7269',
  Accumulation: '#E8E4DC',
  Intensification: '#E8651A',
  Peak: '#D4983C',
  Deload: '#5B8FA8',
};

// ─── TAG ACCENT COLORS ───────────────────────────────────────────────────────
// Maps movement tags to their UI accent colors
export const TAG_ACCENT: Record<string, string> = {
  PUSH: '#E8651A',
  PULL: '#C0592B',
  LEGS: '#D47830',
  UPPER: '#E8651A',
  LOWER: '#D47830',
  FULL: '#E8651A',
  CARDIO: '#D4A03C',
  // Mobility shares the warm-gold palette (tokens.colors.gold) used by
  // MobilityCard + MobilitySessionView so the ActiveSessionBar matches the
  // in-session chrome.
  MOBILITY: '#D4983C',
};

// ─── VOLUME LANDMARKS ────────────────────────────────────────────────────────
// Weekly working sets per muscle group: mev (minimum effective volume),
// mavLow–mavHigh (sweet spot range), mrv (maximum recoverable volume)
interface VolumeLandmark {
  mev: number;
  mavLow: number;
  mavHigh: number;
  mrv: number;
}

export const VOLUME_LANDMARKS: Record<string, VolumeLandmark> = {
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
export const DAY_COLORS = ['#E8651A', '#C87D4A', '#D4983C', '#C0592B'] as const;

// ─── STANDARD WARMUP PROTOCOL ────────────────────────────────────────────────
// Progressive loading steps for any working set
interface WarmupStep {
  load: string;
  reps: string;
  note: string;
}

export const WARMUP: readonly WarmupStep[] = [
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
interface MobilityMove {
  name: string;
  cue: string;
}

export const FOUNDRY_MOBILITY: Record<string, readonly MobilityMove[]> = {
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
export const DAILY_MOBILITY: readonly MobilityMove[] = [
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
interface GoalOption {
  id: string;
  label: string;
  desc: string;
  priority: string;
}

export const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    id: 'build_muscle',
    label: 'Build Muscle',
    desc: 'Grow bigger. Higher training volume with rep ranges designed for muscle growth.',
    priority: 'size',
  },
  {
    id: 'build_strength',
    label: 'Build Strength',
    desc: 'Get stronger. Heavier weights, fewer reps, focused on hitting new PRs.',
    priority: 'strength',
  },
  {
    id: 'lose_fat',
    label: 'Lose Fat & Stay Strong',
    desc: 'Burn fat while keeping the muscle you\'ve built. Pairs well with cardio.',
    priority: 'both',
  },
  {
    id: 'general_fitness',
    label: 'General Fitness',
    desc: 'Balanced training for overall health, endurance, and feeling good.',
    priority: 'both',
  },
];

// ─── CARDIO WORKOUTS ─────────────────────────────────────────────────────────
// Pre-built cardio session templates
interface CardioWorkout {
  id: string;
  label: string;
  description: string;
  category: string;
  defaultType: string;
  defaultDuration: number;
  defaultIntensity: string;
  recommendedFor: string[];
  intervals?: { workSecs: number; restSecs: number; rounds: number };
}

export const CARDIO_WORKOUTS: readonly CardioWorkout[] = [
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
export type MobilityCategory = 'warmup' | 'recovery' | 'targeted';

interface MobilityProtocolMove {
  name: string;
  reps: string;
  cue: string;
  /** YouTube search URL. Matches exercise library pattern so results stay fresh. */
  videoUrl?: string;
}

interface MobilityProtocol {
  id: string;
  name: string;
  duration: string;
  /** Warmup = pre-training; Recovery = rest-day/post-training; Targeted = prehab/rehab. */
  category: MobilityCategory;
  /** One-line purpose shown on cards and protocol detail. */
  description: string;
  /** Optional — day tags this warmup pairs with (e.g. ['PUSH','UPPER']). */
  dayTags?: string[];
  moves: MobilityProtocolMove[];
}

const YT = (q: string) =>
  `https://www.youtube.com/results?search_query=${q.replace(/\s+/g, '+')}`;

export const MOBILITY_PROTOCOLS: readonly MobilityProtocol[] = [
  // ── WARMUP ─────────────────────────────────────────────────────────────────
  {
    id: 'daily_warmup',
    name: 'Daily Mobility',
    duration: '3 min',
    category: 'warmup',
    description: 'Neutral, tag-agnostic mobility. Safe default before any session or on its own as a morning routine.',
    moves: [
      {
        name: 'Cat-Cow',
        reps: '10 slow reps',
        cue: 'On hands and knees, alternate arching up (cat) and dropping belly down (cow). Breathe with each rep.',
        videoUrl: YT('cat cow stretch form tutorial'),
      },
      {
        name: '90/90 Hip Stretch',
        reps: '30 sec / side',
        cue: 'Sit with one leg bent in front (90°), one to side (90°). Fold forward gently. Deep hip opener.',
        videoUrl: YT('90 90 hip stretch form tutorial'),
      },
      {
        name: "Child's Pose",
        reps: '45 sec',
        cue: 'Knees wide, sink hips to heels, arms extended forward. Decompresses the lower back.',
        videoUrl: YT('childs pose yoga form tutorial'),
      },
      {
        name: 'Quadruped Rocks',
        reps: '20 rocks',
        cue: 'Hands and knees, rock hips back and forth over heels. Opens hip flexors, quiets the nervous system.',
        videoUrl: YT('quadruped rocking mobility tutorial'),
      },
      {
        name: 'Seated Spinal Twist',
        reps: '30 sec / side',
        cue: 'Sit tall, cross one leg over, hug top knee, twist gently. Decompresses the spine.',
        videoUrl: YT('seated spinal twist form tutorial'),
      },
    ],
  },
  {
    id: 'push_warmup',
    name: 'Push Day Warmup',
    duration: '3 min',
    category: 'warmup',
    description: 'Primes scapula, thoracic spine, and shoulders for bench and press days.',
    dayTags: ['PUSH', 'UPPER'],
    moves: [
      {
        name: 'Band Pull-Aparts',
        reps: '15',
        cue: 'Arms straight, pull band apart at chest height. Shoulder blades squeeze.',
        videoUrl: YT('band pull apart form tutorial'),
      },
      {
        name: 'Scapular Wall Slides',
        reps: '10',
        cue: 'Back flat to wall, slide arms up overhead without losing wall contact.',
        videoUrl: YT('scapular wall slide form tutorial'),
      },
      {
        name: 'Open Book (T-Spine Rotation)',
        reps: '8 / side',
        cue: 'Side-lying, top arm sweeps open to the floor. Eyes track the hand.',
        videoUrl: YT('open book thoracic rotation tutorial'),
      },
      {
        name: 'Shoulder Dislocations',
        reps: '10',
        cue: 'Wide grip on band or dowel, arms straight, rotate overhead and behind, return.',
        videoUrl: YT('shoulder dislocations mobility tutorial'),
      },
      {
        name: 'Push-Up to Downward Dog',
        reps: '8',
        cue: 'Full extension at top, drive hips back and up. Hamstring stretch at the bottom.',
        videoUrl: YT('push up to downward dog tutorial'),
      },
    ],
  },
  {
    id: 'pull_warmup',
    name: 'Pull Day Warmup',
    duration: '3 min',
    category: 'warmup',
    description: 'Wakes up lats, rhomboids, and rear delts for row and pull-up days.',
    dayTags: ['PULL'],
    moves: [
      {
        name: 'Dead Hangs',
        reps: '30 sec',
        cue: 'Full hang from a bar. Shoulders active, not shrugged. Breathe.',
        videoUrl: YT('dead hang form tutorial'),
      },
      {
        name: 'Scapular Pulls',
        reps: '10',
        cue: 'Hanging from a bar, pull shoulder blades down and together. No elbow bend.',
        videoUrl: YT('scapular pull hang tutorial'),
      },
      {
        name: 'Cat-Cow',
        reps: '10 slow',
        cue: 'Flow through full spine, sync with breath.',
        videoUrl: YT('cat cow stretch form tutorial'),
      },
      {
        name: 'Banded Face Pulls',
        reps: '15',
        cue: 'Pull band to forehead, elbows high and wide. Rear delts squeeze.',
        videoUrl: YT('banded face pull form tutorial'),
      },
      {
        name: 'Thoracic Extensions',
        reps: '10',
        cue: 'Hands behind head, arch upper back over a foam roller or bench edge.',
        videoUrl: YT('thoracic extension foam roller tutorial'),
      },
    ],
  },
  {
    id: 'legs_warmup',
    name: 'Legs Day Warmup',
    duration: '3 min',
    category: 'warmup',
    description: 'Hip, ankle, and knee prep for squat and hinge patterns.',
    dayTags: ['LEGS', 'LOWER'],
    moves: [
      {
        name: 'Hip Circles',
        reps: '10 each direction / side',
        cue: 'Standing, circle one knee wide then back. Big range of motion.',
        videoUrl: YT('hip circle mobility tutorial'),
      },
      {
        name: '90/90 Hip Switches',
        reps: '10',
        cue: 'Sit, flip legs from one 90/90 position to the other. Active hip mobility.',
        videoUrl: YT('90 90 hip switch tutorial'),
      },
      {
        name: 'Deep Bodyweight Squat Hold',
        reps: '60 sec',
        cue: 'Feet shoulder-width, drop as deep as possible, heels down, spine long.',
        videoUrl: YT('deep squat hold mobility tutorial'),
      },
      {
        name: 'Half-Kneeling Ankle Pulses',
        reps: '15 / side',
        cue: 'Drive front knee over toes and back. Heel stays down.',
        videoUrl: YT('half kneeling ankle mobility tutorial'),
      },
      {
        name: 'Glute Bridges',
        reps: '15',
        cue: 'Feet flat, drive hips up. Squeeze glutes hard at the top.',
        videoUrl: YT('glute bridge form tutorial'),
      },
    ],
  },

  // ── RECOVERY ───────────────────────────────────────────────────────────────
  {
    id: 'post_training_downshift',
    name: 'Post-Training Downshift',
    duration: '8 min',
    category: 'recovery',
    description: 'Shift out of sympathetic drive. Parasympathetic activation via slow breathing + inversions.',
    moves: [
      {
        name: 'Legs Up the Wall',
        reps: '3 min',
        cue: 'Hips near wall, legs vertical. Hands on belly. Slow nasal breaths.',
        videoUrl: YT('legs up the wall pose tutorial'),
      },
      {
        name: 'Box Breathing',
        reps: '5 min',
        cue: '4 in · 4 hold · 4 out · 4 hold. Eyes closed, count.',
        videoUrl: YT('box breathing technique tutorial'),
      },
      {
        name: 'Supine Spinal Twist',
        reps: '60 sec / side',
        cue: 'On back, drop knees to one side, arms wide. Look opposite direction.',
        videoUrl: YT('supine spinal twist tutorial'),
      },
      {
        name: 'Happy Baby',
        reps: '45 sec',
        cue: 'On back, knees to armpits, grab outside of feet. Rock gently side to side.',
        videoUrl: YT('happy baby pose tutorial'),
      },
    ],
  },
  {
    id: 'full_body_foam_roll',
    name: 'Full-Body Foam Roll',
    duration: '10 min',
    category: 'recovery',
    description: 'Myofascial release for DOMS reduction. 10–20 min post-training is the evidence-backed window.',
    moves: [
      {
        name: 'Upper Back Roll',
        reps: '90 sec',
        cue: 'Roller across mid-back, arms crossed. Roll bra line to shoulder blades.',
        videoUrl: YT('upper back foam roll tutorial'),
      },
      {
        name: 'Lats Roll',
        reps: '60 sec / side',
        cue: 'Side-lying, arm overhead, roll from armpit to waist.',
        videoUrl: YT('lat foam roll tutorial'),
      },
      {
        name: 'Glutes Roll',
        reps: '90 sec / side',
        cue: 'Sit on roller, cross ankle over opposite knee, lean into target glute.',
        videoUrl: YT('glute foam roll tutorial'),
      },
      {
        name: 'Quads Roll',
        reps: '60 sec / side',
        cue: 'Prone on roller, roll from above the knee to the hip. Slow.',
        videoUrl: YT('quad foam roll tutorial'),
      },
      {
        name: 'IT Band / Lateral Thigh',
        reps: '60 sec / side',
        cue: 'Side-lying on roller, roll outer thigh. Breathe through discomfort.',
        videoUrl: YT('it band foam roll tutorial'),
      },
      {
        name: 'Calves Roll',
        reps: '60 sec / side',
        cue: 'Calf on roller, cross other leg on top for pressure. Ankle to below knee.',
        videoUrl: YT('calf foam roll tutorial'),
      },
    ],
  },
  {
    id: 'off_day_flow',
    name: 'Off-Day Flow',
    duration: '7 min',
    category: 'recovery',
    description: 'Light restorative movement on rest days. Maintains range of motion without loading.',
    moves: [
      {
        name: 'Cat-Cow',
        reps: '10 slow',
        cue: 'Breathe with the movement.',
        videoUrl: YT('cat cow stretch form tutorial'),
      },
      {
        name: 'Thread the Needle',
        reps: '45 sec / side',
        cue: 'On all fours, slide one arm under the other. Shoulder and temple to the floor.',
        videoUrl: YT('thread the needle stretch tutorial'),
      },
      {
        name: "World's Greatest Stretch",
        reps: '5 / side',
        cue: 'Deep lunge, rotate torso up, touch the ground. Hits everything.',
        videoUrl: YT('worlds greatest stretch tutorial'),
      },
      {
        name: 'Seated Forward Fold',
        reps: '60 sec',
        cue: "Sit tall, hinge at the hips. Don't round to reach further.",
        videoUrl: YT('seated forward fold tutorial'),
      },
      {
        name: 'Reclined Butterfly',
        reps: '90 sec',
        cue: 'Lie back, soles of feet together, knees fall wide. Passive hip opener.',
        videoUrl: YT('reclined butterfly pose tutorial'),
      },
    ],
  },

  // ── TARGETED ───────────────────────────────────────────────────────────────
  {
    id: 'shoulder_rehab',
    name: 'Shoulder Rehab & Prevention',
    duration: '15 min',
    category: 'targeted',
    description: 'Prehab circuit for chronically cranky shoulders. Good every 2–3 days if you press heavy.',
    moves: [
      {
        name: 'Shoulder Dislocations',
        reps: '12 each direction',
        cue: 'Light band or dowel. Start narrow, move through full range.',
        videoUrl: YT('shoulder dislocations mobility tutorial'),
      },
      {
        name: 'Wall Slides',
        reps: '15',
        cue: 'Back against wall, slide arms up and down, keeping contact.',
        videoUrl: YT('wall slide shoulder tutorial'),
      },
      {
        name: 'YTWs',
        reps: '10 each position',
        cue: 'Prone, form Y, T, W shapes. Light weight or bodyweight.',
        videoUrl: YT('YTW shoulder rehab tutorial'),
      },
      {
        name: 'Dead Hangs',
        reps: '30 sec hold × 3',
        cue: 'Relax shoulders into the stretch. Active, not shrugged.',
        videoUrl: YT('dead hang form tutorial'),
      },
    ],
  },
  {
    id: 'hip_mobility',
    name: 'Deep Hip Opener',
    duration: '20 min',
    category: 'targeted',
    description: 'Long-hold positions for tight hips. Good for desk workers and heavy squatters.',
    moves: [
      {
        name: '90/90 Stretch',
        reps: '45 sec each side',
        cue: 'One leg forward, one to side, fold gently over front leg.',
        videoUrl: YT('90 90 hip stretch form tutorial'),
      },
      {
        name: 'Pigeon Pose',
        reps: '60 sec each side',
        cue: 'Back leg extended, front leg in front. Relax torso forward.',
        videoUrl: YT('pigeon pose form tutorial'),
      },
      {
        name: "World's Greatest Stretch",
        reps: '5 each side',
        cue: 'Lunge, rotate, touch ground. Hits everything.',
        videoUrl: YT('worlds greatest stretch tutorial'),
      },
      {
        name: 'Lizard Pose',
        reps: '45 sec each side',
        cue: 'Low lunge, forearms down. Feel the groin and hip flexor.',
        videoUrl: YT('lizard pose yoga tutorial'),
      },
    ],
  },
  {
    id: 'spine_decompression',
    name: 'Spine Decompression & Breathing',
    duration: '10 min',
    category: 'targeted',
    description: 'Unloads the spine after heavy deadlifts or long sitting days. Finishes with breath work.',
    moves: [
      {
        name: 'Dead Hangs',
        reps: '30 sec × 3',
        cue: 'Let gravity do the work. Relax.',
        videoUrl: YT('dead hang form tutorial'),
      },
      {
        name: "Child's Pose",
        reps: '60 sec',
        cue: 'Wide knees, sink hips, breathe into the lower back.',
        videoUrl: YT('childs pose yoga form tutorial'),
      },
      {
        name: 'Sphinx Pose',
        reps: '30 sec × 2',
        cue: "Gentle backbend on forearms. Don't force extension.",
        videoUrl: YT('sphinx pose form tutorial'),
      },
      {
        name: 'Box Breathing',
        reps: '5 min',
        cue: '4 count in, 4 hold, 4 out, 4 hold. Settle the nervous system.',
        videoUrl: YT('box breathing technique tutorial'),
      },
    ],
  },
  {
    id: 'full_body_flow',
    name: 'Full-Body Mobility Flow',
    duration: '25 min',
    category: 'targeted',
    description: 'Long flow hitting every major joint. Good once a week as a standalone mobility session.',
    moves: [
      {
        name: 'Cat-Cow',
        reps: '10 slow',
        cue: 'Move with breath.',
        videoUrl: YT('cat cow stretch form tutorial'),
      },
      {
        name: 'Inchworms',
        reps: '8',
        cue: 'Walk hands out to plank, walk feet to hands, stand.',
        videoUrl: YT('inchworm exercise tutorial'),
      },
      {
        name: "World's Greatest Stretch",
        reps: '3 each side',
        cue: 'Lunge, rotate, reach. Covers everything.',
        videoUrl: YT('worlds greatest stretch tutorial'),
      },
      {
        name: 'Downward Dog to Upward Dog',
        reps: '10',
        cue: 'Alternate between poses, breathe steadily.',
        videoUrl: YT('down dog up dog flow tutorial'),
      },
      {
        name: 'Walking Lunges with Twist',
        reps: '10 each leg',
        cue: 'Step, rotate torso, feel the hip opening.',
        videoUrl: YT('walking lunge with twist tutorial'),
      },
      {
        name: 'Spinal Twists',
        reps: '30 sec each side',
        cue: 'Lying on back, pull one knee across, let gravity twist.',
        videoUrl: YT('supine spinal twist tutorial'),
      },
    ],
  },
];

// ─── MESO CONFIG BUILDER ─────────────────────────────────────────────────────
// Builds the mesocycle configuration object from user profile settings.
// Returns { weeks, days, splitType, phases, rirs, mesoRows, progTargets }

type MesoRow = [number | null, string, string, string];

interface MesoLengthConfig {
  rirs: string[];
  mesoRows: MesoRow[];
}

export interface MesoConfigResult extends MesoConfig {
  weeks: number;
  days: number;
  splitType: string;
  phases: string[];
  rirs: string[];
  mesoRows: MesoRow[];
  progTargets: { weight: string[]; reps: string[] };
}

export function buildMesoConfig(
  mesoLen: number,
  daysPerWeek: number,
  splitType: SplitType | string
): MesoConfigResult {
  const configs: Record<number, MesoLengthConfig> = {
    4: {
      rirs: ['3 RIR', '2 RIR', '1 RIR', '0-1 RIR'],
      mesoRows: [
        [0, '3 RIR', 'Establish', 'Establish your baseline. Find a challenging but manageable working weight — no rep targets this week.'],
        [
          1,
          '2 RIR',
          'Accumulation',
          'Match weights, refine technique. Add weight where it feels easy.',
        ],
        [2, '1 RIR', 'Intensification', 'Push closer to failure. +5 lbs on anchors.'],
        [3, '0-1 RIR', 'Peak', 'PR attempts on anchors. Maximum effort week.'],
        [null, 'N/A', 'DELOAD', '50-60% of peak weight. 2 sets only. Zero failure. Recover.'],
      ],
    },
    6: {
      rirs: ['3 RIR', '2-3 RIR', '2 RIR', '1-2 RIR', '1 RIR', '0-1 RIR'],
      mesoRows: [
        [0, '3 RIR', 'Establish', 'Establish your baseline. Find a challenging but manageable working weight — no rep targets this week.'],
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
        [0, '4 RIR', 'Establish', 'Establish your baseline. Find a challenging but manageable working weight — no rep targets this week.'],
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
        [0, '4 RIR', 'Establish', 'Establish your baseline. Find a challenging but manageable working weight — no rep targets this week.'],
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
        [0, '4 RIR', 'Establish', 'Establish your baseline. Find a challenging but manageable working weight — no rep targets this week.'],
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
let _mesoCache: MesoConfigResult | null = null;
export function getMeso(): MesoConfigResult {
  if (_mesoCache) return _mesoCache;
  try {
    const raw = store.get('foundry:profile');
    const p = raw ? JSON.parse(raw) : null;
    if (p) {
      _mesoCache = buildMesoConfig(
        p.mesoLength || 6,
        p.workoutDays?.length || p.daysPerWeek || 6,
        p.splitType || 'ppl'
      );
      return _mesoCache;
    }
  } catch (_) { /* fallback to defaults */ }
  return buildMesoConfig(6, 6, 'ppl');
}
export function resetMesoCache(): void {
  _mesoCache = null;
}

// Convenience getters for commonly imported derived values
export function getWeekPhase(): string[] {
  return getMeso().phases;
}
export function getWeekRir(): string[] {
  return getMeso().rirs;
}
export function getProgTargets(): { weight: string[]; reps: string[] } {
  return getMeso().progTargets;
}
export function getMesoRows(): MesoRow[] {
  return getMeso().mesoRows;
}

// ─── COOLDOWN MOBILITY (post-workout, tag-specific) ─────────────────────────
export const FOUNDRY_COOLDOWN: Record<string, readonly MobilityMove[]> = {
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
export const REST_QUOTES: readonly string[] = [
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
interface RecoveryTip {
  label: string;
  tip: string;
}

export const RECOVERY_TIPS: readonly RecoveryTip[] = [
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
interface CongratsEntry {
  headline: string;
  sub: string;
}

export const CONGRATS: readonly CongratsEntry[] = [
  {
    headline: 'EARNED.',
    sub: "The rep count doesn't care how you felt. You showed up.",
  },
  {
    headline: "THAT'S THE WORK.",
    sub: 'Progress is built in increments. This was one.',
  },
  { headline: 'RESPECT.', sub: 'You made a commitment and you kept it.' },
  { headline: 'SHOWED UP.', sub: 'Not everyone did today. You did.' },
  {
    headline: 'CONSISTENT.',
    sub: "Consistency over time. That's the whole system.",
  },
  {
    headline: 'STANDARD MET.',
    sub: 'Every session is a deposit. This one counts.',
  },
  {
    headline: 'ANOTHER ONE IN.',
    sub: 'Strength is built in sessions exactly like this one.',
  },
  {
    headline: 'WEEK ADVANCES.',
    sub: 'Rest well. The next session is already on the schedule.',
  },
  {
    headline: 'GROUND GAINED.',
    sub: 'Small increments compound. This is the math.',
  },
  {
    headline: 'THE BAR MOVED.',
    sub: 'Literally and figuratively. Put it away clean.',
  },
];

// ─── MOTIVATIONAL QUOTES ─────────────────────────────────────────────────────
interface Quote {
  text: string;
  author: string;
}

export const QUOTES: readonly Quote[] = [
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

export const QUOTES_FEMALE: readonly Quote[] = [
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

export const QUOTES_MALE: readonly Quote[] = [
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

export function randomQuote(gender?: string): Quote {
  let pool: readonly Quote[];
  if (gender === 'f') {
    pool = [...QUOTES_FEMALE, ...QUOTES_FEMALE, ...QUOTES];
  } else if (gender === 'm') {
    pool = [...QUOTES_MALE, ...QUOTES_MALE, ...QUOTES];
  } else {
    pool = QUOTES;
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

export function randomCongrats(): CongratsEntry {
  return CONGRATS[Math.floor(Math.random() * CONGRATS.length)];
}
