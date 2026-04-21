/**
 * Coach mark definitions. Each concept fires once per user (gated by
 * foundry:coach:{id}) on a real in-app trigger event. Copy is capped at
 * 20 words per mark.
 *
 * New marks should append here; the orchestrator is a dumb router.
 */
export interface CoachMarkDef {
  id: string;
  trigger: CoachTrigger;
  anchor: string; // CSS selector — must match a [data-coach="..."] on a mounted element
  copy: string;
  title?: string;
}

export type CoachTrigger =
  | { type: 'event'; name: string } // fires on a window event (payload ignored)
  | { type: 'dwell'; name: string; ms: number } // anchor visible for ms without a tap on page
  | { type: 'manual' }; // fires via explicit orchestrator call (e.g. user taps anchor)

export const COACH_MARKS: CoachMarkDef[] = [
  {
    id: 'phase-bar',
    trigger: { type: 'dwell', name: 'foundry:home-mounted', ms: 2000 },
    anchor: '[data-coach="phase-bar"]',
    title: 'Five phases',
    copy: 'Your program moves through 5 phases. Tap to see what each does.',
  },
  {
    id: 'establish',
    trigger: { type: 'event', name: 'foundry:first-day1-week1-open' },
    anchor: '[data-coach="phase-bar"]',
    title: 'Establish',
    copy: 'Establish week: dial in form and baseline loads. Volume climbs next week.',
  },
  {
    id: 'anchor',
    trigger: { type: 'event', name: 'foundry:first-anchor-visible' },
    anchor: '[data-coach="anchor-hammer"]',
    title: 'Anchor lifts',
    copy: 'The hammer marks anchor lifts. Strength here drives the whole mesocycle.',
  },
  {
    id: 'rpe',
    trigger: { type: 'event', name: 'foundry:first-rpe-prompt' },
    anchor: '[data-coach="rpe-prompt"]',
    title: 'How hard was that?',
    copy: 'Easy means we push more. Hard means we hold. Good is the sweet spot.',
  },
  {
    id: 'rest-timer',
    trigger: { type: 'event', name: 'foundry:first-rest-timer' },
    anchor: '[data-coach="rest-timer"]',
    title: 'Rest timer',
    copy: 'Rest timer runs between sets so fatigue stays honest.',
  },
  {
    id: 'weight-progression',
    trigger: { type: 'event', name: 'foundry:first-all-reps-hit' },
    anchor: '[data-coach="anchor-row"]',
    title: 'All reps hit',
    copy: 'All reps hit. Next week adds weight to your anchor.',
  },
  {
    id: 'rep-progression',
    trigger: { type: 'event', name: 'foundry:first-miss' },
    anchor: '[data-coach="missed-row"]',
    title: 'Missed reps',
    copy: 'Missed reps stay at the same weight. Next week asks for the reps back.',
  },
  {
    id: 'stall',
    trigger: { type: 'event', name: 'foundry:first-stall' },
    anchor: '[data-coach="stall-chip"]',
    title: 'Stall detected',
    copy: 'Stall detected. The Foundry will ease off next week so you can recover and push again.',
  },
  {
    id: 'deload',
    trigger: { type: 'event', name: 'foundry:first-deload-week' },
    anchor: '[data-coach="phase-bar"]',
    title: 'Deload week',
    copy: 'Deload week. Lighter loads, fewer sets. Recovery is the reason training works.',
  },
  {
    id: 'carryover',
    trigger: { type: 'event', name: 'foundry:first-meso-carryover' },
    anchor: '[data-coach="meso-overview"]',
    title: 'Your next meso',
    copy: 'Your new meso starts heavier — because you did. Every block builds on the last.',
  },
  {
    id: 'schedule',
    trigger: { type: 'event', name: 'foundry:schedule-tab-opened' },
    anchor: '[data-coach="schedule-calendar"]',
    title: 'Life happens',
    copy: 'Tap any day to move a workout, add one, or schedule cardio.',
  },
];

export const coachFlagKey = (id: string) => `foundry:coach:${id}`;
