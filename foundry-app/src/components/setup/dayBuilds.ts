/**
 * Converting between a program (TrainingDay[]) and the editable per-day list
 * DayAccordion works on. Shared by the new-lifter preview (Beat2Preview) and
 * the returning-lifter review (ProgramReview) so both install exactly what
 * the lifter approved.
 */
import type { Exercise, TrainingDay } from '../../types';
import { repsForGoal } from '../../utils/program';
import type { DayBuild } from './DayAccordion';

/**
 * Map program.ts TrainingDay[] output into the DayBuild[] shape the
 * DayAccordion works with. Anchors become an indices-array instead of
 * per-exercise booleans to keep state mutations simple.
 */
export function toDayBuilds(days: TrainingDay[]): DayBuild[] {
  return days.map((d) => {
    const exercises = (d.exercises || []).map((e) => ({
      id: String(e.id ?? e.name ?? ''),
      name: String(e.name ?? ''),
      muscle: String(e.muscle ?? 'other'),
    }));
    const anchors: number[] = [];
    (d.exercises || []).forEach((e, i) => {
      if (e.anchor) anchors.push(i);
    });
    return {
      tag: String(d.tag ?? 'CUSTOM'),
      label: String(d.label ?? `Day ${d.dayNum ?? '?'}`),
      exercises,
      anchors,
    };
  });
}

/**
 * Back to a full program. With `original` (the program the list was made
 * from), untouched exercises and day fields are carried over verbatim;
 * swapped-in or added exercises are filled from the exercise DB.
 */
export function hydrateDayBuilds(
  days: DayBuild[],
  dbNow: { [k: string]: unknown }[],
  original?: TrainingDay[],
  /** Training goal — picks the rep range for lifts added in the review. */
  goal?: string | null,
): TrainingDay[] {
  return days
    .map((d, i): TrainingDay => {
      const exercises: Exercise[] = d.exercises.map((e, idx) => {
        const isAnchor = d.anchors.includes(idx);
        // Unchanged exercises keep the builder's own prescription (sets,
        // reps, rest, warm-up) — only the anchor flag can change here.
        const kept = original?.[i]?.exercises?.find((x) => String(x.id ?? x.name) === e.id);
        if (kept) return { ...kept, anchor: isAnchor };
        const match = dbNow.find((x) => x.id === e.id) as unknown as
          | { [k: string]: unknown }
          | undefined;
        if (match) {
          return {
            id: String(match.id),
            name: String(match.name),
            muscle: String(match.muscle || e.muscle || 'other'),
            muscles: (match.muscles as string[] | undefined) || [String(match.muscle || e.muscle)],
            equipment: (match.equipment as string | string[] | undefined) || 'barbell',
            tag: String(match.tag || d.tag || 'FULL'),
            anchor: isAnchor,
            sets: isAnchor ? 4 : 3,
            reps: repsForGoal(goal, { pattern: typeof match.pattern === 'string' ? match.pattern : null }),
            rest: typeof match.rest === 'string' ? match.rest : isAnchor ? '3 min' : '2 min',
            warmup: isAnchor ? 'Full protocol' : '1 feeler set',
            progression: match.pattern === 'isolation' ? 'reps' : 'weight',
            description: typeof match.description === 'string' ? match.description : '',
            videoUrl: typeof match.videoUrl === 'string' ? match.videoUrl : '',
            bw: !!match.bw,
          } as Exercise;
        }
        return {
          id: e.id,
          name: e.name,
          muscle: e.muscle,
          muscles: [e.muscle],
          equipment: 'barbell',
          tag: d.tag,
          anchor: isAnchor,
          sets: isAnchor ? 4 : 3,
          reps: '6-12',
          rest: isAnchor ? '3 min' : '2 min',
          warmup: isAnchor ? 'Full protocol' : '1 feeler set',
          progression: 'weight',
          description: '',
          videoUrl: '',
        } as Exercise;
      });
      return {
        muscles: '',
        note: '',
        cardio: null,
        ...(original?.[i] ?? {}),
        dayNum: i + 1,
        label: d.label,
        tag: d.tag,
        exercises,
      };
    })
    .filter((d) => d.exercises.length > 0);
}
