import { store } from './storage';
import { validateDayData } from './validate';
import { getMeso } from '../data/constants';
import { loadSessionDuration, loadSparklineData } from './training';
import { tokens } from '../styles/tokens';
import type { TrainingDay, Exercise, WorkoutSet, DayData } from '../types';

// ── Volume tier types ───────────────────────────────────────────────────────

export interface LandmarkStatus {
  label: 'MV' | 'Optimal' | 'Exceeding';
  fill: string;
  color: string;
  bg: string;
  border: string;
}

interface VolumeLandmark {
  mev: number;
  mavLow: number;
  mavHigh: number;
  mrv: number;
}

// ── Shared helpers (extracted from ProgressView) ────────────────────────────

export function sessionTagToCategory(
  sessionTag: string | undefined,
  exTag: string | undefined,
): string | undefined {
  if (sessionTag === 'UPPER' || sessionTag === 'LOWER' || sessionTag === 'FULL') return exTag;
  return sessionTag;
}

export function flattenMuscleSets(byTag: Record<string, Record<string, number>>): Record<string, number> {
  const result: Record<string, number> = {};
  Object.values(byTag).forEach((muscleMap: Record<string, number>) => {
    Object.entries(muscleMap || {}).forEach(([muscle, sets]) => {
      result[muscle] = (result[muscle] || 0) + sets;
    });
  });
  return result;
}

/** 3-tier volume status: MV / Optimal / Exceeding */
export function getLandmarkStatus(
  sets: number,
  lm: VolumeLandmark | undefined,
): LandmarkStatus | null {
  if (!lm) return null;
  if (sets < lm.mev)
    return {
      label: 'MV',
      fill: '#8A6030',
      color: tokens.colors.gold,
      bg: 'rgba(138,96,48,0.12)',
      border: 'rgba(138,96,48,0.3)',
    };
  if (sets > lm.mrv)
    return {
      label: 'Exceeding',
      fill: '#c0392b',
      color: '#e07070',
      bg: 'rgba(192,57,43,0.12)',
      border: 'rgba(192,57,43,0.3)',
    };
  return {
    label: 'Optimal',
    fill: '#2dd4a8',
    color: 'var(--phase-accum)',
    bg: 'rgba(45,212,168,0.12)',
    border: 'rgba(45,212,168,0.3)',
  };
}

export function calcMuscleSetsByTag(
  activeDays: TrainingDay[],
  completedDays: Set<string>,
  weekFilter: number | null,
): Record<string, Record<string, number>> {
  const byTag: Record<string, Record<string, number>> = { PUSH: {}, PULL: {}, LEGS: {} };
  activeDays.forEach((day: TrainingDay, dayIdx: number) => {
    for (let w = 0; w < getMeso().totalWeeks; w++) {
      if (weekFilter !== null && w !== weekFilter) continue;
      if (!completedDays.has(`${dayIdx}:${w}`)) continue;
      const raw = store.get(`foundry:day${dayIdx}:week${w}`);
      const wd: DayData = raw ? validateDayData(JSON.parse(raw)) : {};
      day.exercises.forEach((ex: Exercise, exIdx: number) => {
        const exData = wd[exIdx] || {};
        const filledSets = Object.values(exData).filter(
          (s: WorkoutSet) => s && s.reps && s.reps !== '',
        ).length;
        if (filledSets === 0) return;
        const cat = sessionTagToCategory(day.tag, ex.tag) || 'OTHER';
        if (!byTag[cat]) byTag[cat] = {};
        let primaryMuscle = ex.muscle || (ex.muscles && ex.muscles[0]);
        if (primaryMuscle === 'Lats') primaryMuscle = 'Back';
        if (primaryMuscle === 'Abductors') primaryMuscle = 'Glutes';
        if (primaryMuscle === 'Adductors') return;
        if (primaryMuscle) {
          byTag[cat][primaryMuscle] = (byTag[cat][primaryMuscle] || 0) + filledSets;
        }
      });
    }
  });
  return byTag;
}

// ── Session stats ───────────────────────────────────────────────────────────

export interface SessionStats {
  tonnage: number;
  completionRate: number;
  completedSessions: number;
  totalSessions: number;
  avgDuration: number | null;
  totalSets: number;
}

export function calcSessionStats(
  activeDays: TrainingDay[],
  completedDays: Set<string>,
): SessionStats {
  const meso = getMeso();
  const mesoWeeks = meso.totalWeeks;
  let tonnage = 0;
  let totalSets = 0;

  for (let w = 0; w <= mesoWeeks; w++) {
    for (let d = 0; d < activeDays.length; d++) {
      if (!completedDays.has(`${d}:${w}`)) continue;
      const raw = store.get(`foundry:day${d}:week${w}`);
      if (!raw) continue;
      try {
        const dayData = validateDayData(JSON.parse(raw));
        Object.values(dayData).forEach((exData) => {
          Object.values(exData).forEach((s: WorkoutSet) => {
            if (!s || s.warmup) return;
            const wt = parseFloat(String(s.weight)) || 0;
            const rp = parseInt(String(s.reps)) || 0;
            if (wt > 0 && rp > 0) {
              tonnage += wt * rp;
              totalSets++;
            } else if (rp > 0) {
              totalSets++;
            }
          });
        });
      } catch {
        /* skip corrupt data */
      }
    }
  }

  const durations: number[] = [];
  for (let w = 0; w <= mesoWeeks; w++) {
    for (let d = 0; d < activeDays.length; d++) {
      const dur = loadSessionDuration(d, w);
      if (dur !== null) durations.push(dur);
    }
  }

  const totalPossible = activeDays.length * (mesoWeeks + 1);
  return {
    tonnage: Math.round(tonnage),
    completionRate: totalPossible > 0 ? completedDays.size / totalPossible : 0,
    completedSessions: completedDays.size,
    totalSessions: totalPossible,
    avgDuration: durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null,
    totalSets,
  };
}

// ── PR Timeline ─────────────────────────────────────────────────────────────

export interface PRTimelineEntry {
  week: number;
  exerciseName: string;
  weight: number;
  prevBest: number;
  delta: number;
  tag: string | undefined;
}

export function buildPRTimeline(
  activeDays: TrainingDay[],
): PRTimelineEntry[] {
  const meso = getMeso();
  const mesoWeeks = meso.totalWeeks;
  const entries: PRTimelineEntry[] = [];

  activeDays.forEach((day, dayIdx) => {
    day.exercises.forEach((ex, exIdx) => {
      if (!ex.anchor) return;
      const pts = loadSparklineData(dayIdx, exIdx, mesoWeeks + 1);
      if (pts.length < 2) return;

      let bestSoFar = 0;
      pts.forEach((pt) => {
        if (bestSoFar > 0 && pt.bestWeight > bestSoFar) {
          entries.push({
            week: pt.week,
            exerciseName: ex.name,
            weight: pt.bestWeight,
            prevBest: bestSoFar,
            delta: pt.bestWeight - bestSoFar,
            tag: day.tag,
          });
        }
        if (pt.bestWeight > bestSoFar) bestSoFar = pt.bestWeight;
      });
    });
  });

  return entries.sort((a, b) => b.week - a.week);
}

// ── Anchor chart data ───────────────────────────────────────────────────────

export interface AnchorChartData {
  name: string;
  tag: string | undefined;
  points: { week: number; e1rm: number }[];
  allTimeBest: number;
  current: number;
  isPR: boolean;
  isStalling: boolean;
}

export function loadAnchorCharts(activeDays: TrainingDay[]): AnchorChartData[] {
  const meso = getMeso();
  const charts: AnchorChartData[] = [];

  activeDays.forEach((day, dayIdx) => {
    day.exercises.forEach((ex, exIdx) => {
      if (!ex.anchor) return;
      const pts = loadSparklineData(dayIdx, exIdx, meso.totalWeeks);
      if (!pts.length) return;
      const best = pts.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), pts[0]);
      const latest = pts[pts.length - 1];
      let isStalling = false;
      if (pts.length >= 3) {
        const p1 = pts[pts.length - 1].e1rm;
        const p2 = pts[pts.length - 2].e1rm;
        const p3 = pts[pts.length - 3].e1rm;
        isStalling = p1 <= p2 && p2 <= p3;
      }
      charts.push({
        name: ex.name,
        tag: day.tag,
        points: pts.map((p) => ({ week: p.week, e1rm: p.e1rm })),
        allTimeBest: best.e1rm,
        current: latest.e1rm,
        isPR: latest.e1rm >= best.e1rm && pts.length > 1,
        isStalling,
      });
    });
  });

  return charts;
}

// ── Volume tier legend (3-tier) ─────────────────────────────────────────────

export const VOLUME_LEGEND: [string, string][] = [
  ['#8A6030', 'MV'],
  ['#2dd4a8', 'Optimal'],
  ['#c0392b', 'Exceeding'],
];

// ── Volume bar band colors ──────────────────────────────────────────────────

export const BAND_MV = 'rgba(138,96,48,0.20)';
export const BAND_OPT = 'rgba(45,212,168,0.22)';
export const BAND_EXCEED = 'rgba(192,57,43,0.20)';
export const TICK_COLOR = 'rgba(255,255,255,0.22)';
