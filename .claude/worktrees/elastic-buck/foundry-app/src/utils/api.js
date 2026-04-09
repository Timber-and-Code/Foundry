import { store } from './store.js';

/**
 * Call the Foundry AI Worker to generate a personalized training program.
 * Uses Claude AI to create exercise selections and progression based on profile.
 */
export async function callFoundryAI(
  { split, daysPerWeek, mesoLength, experience, equipment, name, gender, goal, goalNote },
  EXERCISE_DB = []
) {
  const splitLabels = {
    ppl: 'Push/Pull/Legs',
    upper_lower: 'Upper/Lower',
    full_body: 'Full Body',
    push_pull: 'Push/Pull',
  };

  // Normalize experience values — unify all formats to canonical labels
  const expNormalize = {
    new: 'beginner',
    beginner: 'beginner',
    intermediate: 'intermediate',
    advanced: 'experienced',
    experienced: 'experienced',
  };
  const expKey = expNormalize[experience] || 'intermediate';
  const expLabels = {
    beginner: 'beginner (under 1 year)',
    intermediate: 'intermediate (1–3 years)',
    experienced: 'experienced (3+ years)',
  };

  // Client-side intensity norms — enforced regardless of AI response
  const EXPERIENCE_NORMS = {
    beginner: { anchorSets: 3, accSets: 2, repFloor: 8, repCeil: 15 },
    intermediate: { anchorSets: 4, accSets: 3, repFloor: 6, repCeil: 12 },
    experienced: { anchorSets: 5, accSets: 4, repFloor: 3, repCeil: 12 },
  };
  const norms = EXPERIENCE_NORMS[expKey];

  // Experience-specific volume guidance
  const expGuidance = {
    beginner: `- Experience level: BEGINNER (under 1 year)
  • 3 working sets on anchor/compound lifts, 2–3 on accessories
  • Rep ranges: 8–15 across all exercises — no heavy loading
  • Exercise selection: foundational movements only — barbell squat, deadlift, bench press, row, OHP; no complex variations
  • Progression: rep-first — fill out reps before adding weight
  • Keep sessions simple — 3–4 exercises/day, nothing exotic`,
    intermediate: `- Experience level: INTERMEDIATE (1–3 years)
  • 4 working sets on anchor/compound lifts, 3–4 on accessories
  • Rep ranges: 6–12 for compounds, 10–15 for isolations
  • Exercise selection: compound-heavy with accessory work; moderate complexity variations allowed
  • Progression: weekly weight increases on anchors once top reps are hit
  • 4–5 exercises/day`,
    experienced: `- Experience level: EXPERIENCED (3+ years)
  • 5 working sets on anchor/compound lifts, 4–5 on accessories
  • Rep ranges: 3–12 — heavy compounds, moderate accessories
  • Exercise selection: full exercise library; advanced variations, tempo work, intensity techniques permitted
  • Progression: load-first on anchors, volume-driven on accessories
  • 5–6 exercises/day`,
  };

  const goalGuidance = {
    build_muscle: `- Goal: BUILD MUSCLE (hypertrophy)
  • Rep ranges: 8–12 for compounds, 10–15 for isolations
  • Sets: lean toward higher end (4–5 working sets for anchors, 3–4 for accessories)
  • Exercise selection: prioritize stretch-loaded movements (incline DB, RDL, leg press), include isolation work for target muscles
  • Progression: volume-first — add reps before adding weight`,
    build_strength: `- Goal: BUILD STRENGTH
  • Rep ranges: 3–6 for anchors, 6–10 for accessories
  • Sets: moderate volume, high intensity (3–5 heavy working sets on anchors)
  • Exercise selection: prioritize the big barbell movements (squat, deadlift, bench, OHP, row); accessories support the main lifts
  • Progression: load-first — increase weight as the primary driver`,
    lose_fat: `- Goal: LOSE FAT (muscle retention + recomposition)
  • Rep ranges: 10–15 across the board to maximize caloric burn while retaining muscle
  • Sets: moderate (3–4 per exercise); session density matters — keep rest periods tighter
  • Exercise selection: compound-dominant to maximize muscle mass worked per session; include supersets wherever possible
  • Progression: consistency-first — maintain weights as long as possible during a cut`,
    improve_fitness: `- Goal: IMPROVE GENERAL FITNESS
  • Rep ranges: balanced — 8–12 for upper, 10–15 for lower, 12–15 for isolations
  • Sets: 3–4 per exercise; prioritize movement quality and variety
  • Exercise selection: broad coverage — hit all major movement patterns each week (push, pull, hinge, squat, carry)
  • Progression: rep-first, then weight; no specialization bias`,
    sport_conditioning: `- Goal: SPORT & CONDITIONING (athletic performance)
  • Rep ranges: power movements 3–5 reps, strength work 5–8, hypertrophy accessories 10–12
  • Sets: 3–5 on power/strength anchors; 2–3 on accessories
  • Exercise selection: bias toward explosive and athletic movements (power cleans, trap bar, Bulgarian splits, single-leg work); minimize pure isolation
  • Progression: power and strength gains are the signal — prioritize quality of movement over volume`,
  };
  const goalBlock =
    goalGuidance[goal] ||
    `- Goal: General fitness — balanced rep ranges (8–12), moderate volume, broad exercise selection`;
  const goalNoteBlock =
    goalNote && goalNote.trim()
      ? `- Trainee notes (read carefully and let this shape the program): ${goalNote.trim()}`
      : '';

  const exerciseNames = EXERCISE_DB.map(
    (e) =>
      `${e.id}|${e.name}|${e.tag}|${e.muscle}|${e.anchor ? 'anchor' : 'acc'}|sets:${e.sets}|reps:${e.reps}`
  ).join('\n');

  // Meso 2+ context injection — if this is a continuation
  let mesoTransitionBlock = '';
  try {
    const t = JSON.parse(store.get('foundry:meso_transition') || 'null');
    if (t && t.anchorPeaks && t.anchorPeaks.length > 0) {
      const anchorList = t.anchorPeaks.map((a) => `${a.name}: ${a.peak} lbs peak`).join(', ');
      const accList = (t.accessoryIds || []).slice(0, 20).join(', ');
      mesoTransitionBlock = `
MESO 2 CONTEXT (this is a continuation — apply these rules):
- Previous anchor peak weights: ${anchorList}
- Program Week 1 at approximately 85% of these peak weights to allow supercompensation
- Keep ALL anchor lift IDs IDENTICAL to previous meso — do NOT swap anchors
- Rotate approximately 40% of accessories to fresh variations targeting the same muscle groups
- Do NOT reuse these accessory IDs from last meso: ${accList}`;

      if (t.readinessSummary && t.readinessSummary.totalLogged >= 5) {
        const rs = t.readinessSummary;
        const pct = Math.round((rs.totalLogged / rs.totalDays) * 100);
        const chronic =
          rs.avgScore <= 2.5 ? 'chronically low' : rs.avgScore <= 3.5 ? 'moderate' : 'good';
        mesoTransitionBlock += `
- Recovery profile (meso 1): logged ${rs.totalLogged}/${rs.totalDays} days (${pct}%). Avg readiness: ${rs.avgScore}/6. Low-readiness days: ${rs.lowDays}.
- Recovery capacity is ${chronic}. ${rs.avgScore <= 2.5 ? 'Keep weeks 1–2 conservative — fewer sets, higher RIR. Let fatigue clear before ramping. Do not front-load intensity.' : rs.avgScore <= 3.5 ? 'Use standard volume ramp. Watch for fatigue accumulation in peak weeks.' : 'This athlete recovers well. Standard or slightly aggressive volume ramp is appropriate.'}`;
      }
    }
  } catch (e) {
    console.warn('[Foundry]', 'Failed to load meso transition context', e);
  }

  const prompt = `You are an elite personal trainer with 40 years of experience designing mesocycle programs using progressive overload and linear periodization principles. You specialize in hypertrophy and strength development.

Design a complete ${mesoLength}-week mesocycle for a ${expLabels[expKey]} trainee named ${name || 'the user'} using a ${splitLabels[split] || split} split, training ${daysPerWeek} days per week.

AVAILABLE EXERCISES (id|name|tag|muscle|type|sets|reps):
${exerciseNames}

REQUIREMENTS:
${expGuidance[expKey]}
- Always start each day with 1 anchor (compound) lift
- Select exercises appropriate for equipment: ${equipment.join(', ')}
- Use progressive overload: first week establishes baseline, last week targets PRs
- Balance muscle groups appropriately across the week
- Identify 1–2 antagonist superset pairs per day where appropriate. Classic pairs: bench press + row, OHP + lat pulldown, curl + tricep pushdown, leg extension + leg curl, chest fly + rear delt fly. Only pair accessories — never pair two anchor/compound lifts. Mark the PRIMARY exercise in each pair with "supersetWith": <index of partner in this day's exercises array (0-based)>. Only the primary (lower index) exercise carries this field.
${goalBlock}${goalNoteBlock ? '\n' + goalNoteBlock : ''}${mesoTransitionBlock ? '\n' + mesoTransitionBlock : ''}

Return ONLY valid JSON (no markdown, no explanation) with this exact structure:
{
  "days": [
    {
      "dayNum": 1,
      "label": "Push Day 1",
      "tag": "PUSH",
      "muscles": "Chest · Shoulders · Triceps",
      "note": "Training note for the day. What to focus on, cues.",
      "exercises": [
        {
          "id": "exercise_id_from_list",
          "name": "Exercise Name",
          "muscle": "Primary Muscle",
          "sets": 4,
          "reps": "4-6",
          "rest": "3-4 min",
          "anchor": true,
          "progression": "weight",
          "supersetWith": null
        }
      ]
    }
  ],
  "coachNote": "Overall philosophy note for this meso from the coach."
}`;

  const workerUrl =
    import.meta.env.VITE_FOUNDRY_AI_WORKER_URL || 'https://foundry-ai.timberandcode3.workers.dev';
  const appKey = import.meta.env.VITE_FOUNDRY_APP_KEY || '';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Foundry-Key': appKey },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`AI API error: ${response.status}`);
    const data = await response.json();
    const text = data.content?.find((b) => b.type === 'text')?.text || '';
    const clean = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();
    const parsed = JSON.parse(clean);

    // Clamp set counts and rep ranges to experience norms
    const clampSets = (aiSets, isAnchor) => {
      const target = isAnchor ? norms.anchorSets : norms.accSets;
      return Math.min(aiSets || target, target);
    };

    const clampReps = (repsStr) => {
      if (!repsStr) return `${norms.repFloor}-${norms.repCeil}`;
      const str = String(repsStr).replace('–', '-');
      const parts = str
        .split('-')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      if (parts.length === 2) {
        const lo = Math.max(parts[0], norms.repFloor);
        const hi = Math.min(parts[1], norms.repCeil);
        return lo >= hi ? `${Math.min(lo, norms.repCeil)}` : `${lo}-${hi}`;
      }
      if (parts.length === 1) {
        return `${Math.max(Math.min(parts[0], norms.repCeil), norms.repFloor)}`;
      }
      return `${norms.repFloor}-${norms.repCeil}`;
    };

    // Hydrate exercises by matching to EXERCISE_DB
    const hydrated = parsed.days.map((day) => ({
      ...day,
      cardio: null,
      exercises: day.exercises.map((ex) => {
        const dbEx = EXERCISE_DB.find((e) => e.id === ex.id);
        const isAnchor = !!ex.anchor;
        return {
          id: ex.id,
          name: ex.name || dbEx?.name || ex.id,
          muscle: ex.muscle || dbEx?.muscle || '',
          muscles: dbEx?.muscles || [ex.muscle || ''],
          equipment: dbEx?.equipment || equipment[0] || 'barbell',
          tag: day.tag,
          anchor: isAnchor,
          sets: clampSets(
            ex.sets || dbEx?.sets || (isAnchor ? norms.anchorSets : norms.accSets),
            isAnchor
          ),
          reps: clampReps(ex.reps || dbEx?.reps),
          rest: ex.rest || dbEx?.rest || '2 min',
          warmup: isAnchor ? 'Full protocol' : '1 feeler set',
          progression: ex.progression || 'weight',
          description: dbEx?.description || '',
          videoUrl: dbEx?.videoUrl || '',
          supersetWith:
            ex.supersetWith != null && typeof ex.supersetWith === 'number'
              ? ex.supersetWith
              : undefined,
        };
      }),
    }));

    return { days: hydrated, coachNote: parsed.coachNote || '' };
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}
