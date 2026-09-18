// App Store screenshot capture — raw app screens at Apple's exact sizes.
// node shots.mjs <outDir> <device: iphone|ipad> [onlyName]
import { chromium } from '/Users/tnc3/Desktop/Foundry/foundry-app/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';

const OUT = process.argv[2];
const DEVICE = process.argv[3] || 'iphone';
const ONLY = process.argv[4];
const VIEW = DEVICE === 'ipad' ? { width: 1032, height: 1376, dsf: 2 } : { width: 440, height: 956, dsf: 3 };
const URL = 'http://127.0.0.1:3000/';
mkdirSync(`${OUT}/${DEVICE}`, { recursive: true });

// ── Seed (runs in the page). kind: 'mid' = week 3 in progress; 'done' = finished block.
async function seed(kind) {
  const { EXERCISE_DB } = await import('/src/data/exercises.js');
  const byId = Object.fromEntries(EXERCISE_DB.map((e) => [e.id, e]));
  const ex = (id, anchor, sets, reps, rest, start, step) => ({
    ...byId[id], id, anchor, sets, reps, rest,
    warmup: anchor ? 'Full protocol' : '1 feeler set',
    progression: anchor ? 'weight' : (byId[id].pattern === 'isolation' ? 'reps' : 'weight'),
    _start: start, _step: step,
  });
  const days = [
    { label: 'Upper A', tag: 'UPPER', muscles: 'Chest, Back, Shoulders', ex: [
      ex('bb_flat_bench', true, 4, '5-8', '3 min', 185, 5), ex('chest_supported_db_row', true, 4, '8-10', '2 min', 60, 5),
      ex('db_ohp', false, 3, '8-10', '2 min', 50, 2.5), ex('cable_lat_pulldown', false, 3, '10-12', '90 sec', 140, 5),
      ex('db_lateral_raise', false, 3, '12-15', '60 sec', 20, 0), ex('cable_pushdown_bar', false, 3, '10-12', '60 sec', 60, 5) ] },
    { label: 'Lower A', tag: 'LOWER', muscles: 'Quads, Hamstrings', ex: [
      ex('bb_back_squat', true, 4, '5-8', '3 min', 245, 5), ex('bb_rdl', false, 3, '8-10', '2 min', 205, 5),
      ex('leg_press', false, 3, '10-12', '2 min', 360, 10), ex('machine_leg_curl_seated', false, 3, '10-12', '90 sec', 100, 5),
      ex('machine_calf_raise_standing', false, 3, '12-15', '60 sec', 160, 10) ] },
    { label: 'Upper B', tag: 'UPPER', muscles: 'Shoulders, Back, Arms', ex: [
      ex('bb_ohp', true, 4, '5-8', '3 min', 115, 2.5), ex('pullups_weighted', true, 4, '6-8', '2 min', 25, 5),
      ex('bb_incline_bench', false, 3, '8-10', '2 min', 155, 5), ex('seated_cable_row', false, 3, '10-12', '90 sec', 150, 5),
      ex('cable_fly_mid', false, 3, '12-15', '60 sec', 35, 2.5), ex('cable_curl_ez', false, 3, '10-12', '60 sec', 70, 5) ] },
    { label: 'Lower B', tag: 'LOWER', muscles: 'Glutes, Quads, Hamstrings', ex: [
      ex('bb_hip_thrust', true, 4, '8-10', '2 min', 275, 10), ex('db_bulgarian_split_squat', false, 3, '8-10', '2 min', 45, 5),
      ex('machine_leg_extension', false, 3, '12-15', '90 sec', 120, 5), ex('machine_leg_curl_lying', false, 3, '10-12', '90 sec', 90, 5),
      ex('db_calf_raise', false, 3, '12-15', '60 sec', 50, 5) ] },
  ];
  const program = days.map((d, i) => ({ dayNum: i + 1, label: d.label, tag: d.tag, muscles: d.muscles, note: '', cardio: null,
    exercises: d.ex.map(({ _start, _step, ...e }) => e) }));

  localStorage.clear();
  const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  ['welcomed', 'onboarded', 'toured', 'welcome_ribbon_dismissed', 'anon_banner_dismissed', 'first_set_emitted',
    'first_week_done_emitted', 'coach_marks_done'].forEach((k) => set(`foundry:${k}`, '1'));
  ['phase-bar','establish','anchor','rpe','rest-timer','weight-progression','rep-progression','stall','deload','carryover','schedule']
    .forEach((id) => set(`foundry:coach:${id}`, '1'));

  const today = new Date(); today.setHours(12, 0, 0, 0);
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weeksBack = kind === 'done' ? 6 : 2;
  const start = new Date(monday); start.setDate(monday.getDate() - 7 * weeksBack);
  const iso = (d) => d.toISOString().slice(0, 10);

  const mesoLength = 5; // + deload
  set('foundry:profile', { name: 'Alex', experience: 'intermediate', gender: 'male', goal: 'build_muscle',
    splitType: 'upper_lower', workoutDays: [1, 2, 4, 5], daysPerWeek: 4, mesoLength, startDate: iso(start),
    weight: 186, sessionDuration: 60, equipment: ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'], aiDays: program });
  set('foundry:storedProgram', program);

  // Top of the range on the first sets, one less on the last — weight climbs week to week.
  const repsFor = (range, w, i) => { const [lo, hi] = range.split('-').map(Number); return Math.max(lo, hi - 1 - (i > 1 ? 1 : 0)); };
  const blob = (d, w, deload, partial) => {
    const out = {};
    days[d].ex.forEach((e, i) => {
      if (partial != null && i >= partial) return;
      const wt = deload ? Math.round(e._start * 0.9 / 5) * 5 || e._start : e._start + e._step * w;
      const n = deload ? Math.max(2, e.sets - 1) : e.sets;
      const slice = { _exId: e.id };
      for (let s = 0; s < n; s++) slice[s] = { weight: wt, reps: repsFor(e.reps, w, s), confirmed: true };
      out[i] = slice;
    });
    return out;
  };
  const doneWeeks = kind === 'done' ? mesoLength + 1 : 2;
  for (let w = 0; w < doneWeeks; w++) for (let d = 0; d < 4; d++) {
    set(`foundry:day${d}:week${w}`, blob(d, w, w === mesoLength));
    set(`foundry:done:d${d}:w${w}`, '1');
  }
  if (kind === 'mid') {
    // Week 3: first three days done, today (Lower B) in progress — 2 exercises logged.
    for (let d = 0; d < 3; d++) { set(`foundry:day${d}:week2`, blob(d, 2)); set(`foundry:done:d${d}:w2`, '1'); }
    set('foundry:day3:week2', blob(3, 2, false, 1));
    set('foundry:currentWeek', '2');
  } else {
    set('foundry:currentWeek', String(mesoLength + 1));
    set('foundry:meso_complete_shown', '1'); set('foundry:meso_complete_emitted', '1');
  }

  // Today's readiness, so the workout opens on the session rather than the check-in.
  const t = new Date();
  set(`foundry:readiness:${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
    { sleep: 'good', soreness: 'low', energy: 'high' });

  // Body weight, newest first (how the app stores it).
  const bw = [];
  for (let i = 0; i < 8; i++) { const dd = new Date(today); dd.setDate(today.getDate() - i * 4); bw.push({ date: iso(dd), weight: +(186 - i * 0.6).toFixed(1) }); }
  set('foundry:bwlog', bw);

  // A previous, completed block for Previous Meso Cycles / Lifts by Muscle.
  const prevStart = new Date(start); prevStart.setDate(start.getDate() - 7 * 7);
  const sessions = [];
  for (let w = 0; w < 6; w++) for (let d = 0; d < 4; d++) {
    const data = {};
    days[d].ex.forEach((e, i) => { const wt = Math.round((e._start * 0.88 + (e._step || 2.5) * w * 0.8) / 2.5) * 2.5; const slice = {};
      for (let s = 0; s < e.sets; s++) slice[s] = { weight: Math.max(5, wt), reps: repsFor(e.reps, w, s), _exId: e.id }; data[i] = slice; });
    sessions.push({ d, w, data, exOvs: {}, done: true, cardioLog: null });
  }
  const prevEnd = new Date(start); prevEnd.setDate(start.getDate() - 7);
  set('foundry:archive', [{ id: 'prev-meso', status: 'completed', archivedAt: prevEnd.toISOString(), mesoWeeks: 6, mesoDays: 4,
    totalSessions: 24, completedSessions: 24, profile: { splitType: 'upper_lower', mesoLength: 5, startDate: iso(prevStart), goal: 'build_muscle' }, sessions }]);
  return { start: iso(start) };
}

const COACHED = { coachNote: 'Upper/lower.', days: [
  { dayNum: 1, label: 'Upper — Strength', tag: 'UPPER', muscles: 'Chest, Back', note: '', exercises: [
    { id: 'bb_flat_bench', name: 'Barbell Flat Bench Press', muscle: 'chest', anchor: true, sets: 4, reps: '5-8', rest: '3 min' },
    { id: 'chest_supported_db_row', name: 'Chest-Supported DB Row', muscle: 'back', anchor: true, sets: 4, reps: '6-10', rest: '2 min' },
    { id: 'db_incline_bench', name: 'DB Incline Bench Press', muscle: 'chest', anchor: false, sets: 3, reps: '8-12', rest: '2 min' },
    { id: 'cable_lat_pulldown', name: 'Cable Lat Pulldown', muscle: 'back', anchor: false, sets: 3, reps: '8-12', rest: '2 min' },
    { id: 'db_lateral_raise', name: 'DB Lateral Raise', muscle: 'shoulders', anchor: false, sets: 3, reps: '12-15', rest: '90 s' } ] },
  { dayNum: 2, label: 'Lower — Squat', tag: 'LOWER', muscles: 'Quads, Hamstrings', note: '', exercises: [
    { id: 'bb_back_squat', name: 'Barbell Back Squat', muscle: 'quads', anchor: true, sets: 4, reps: '5-8', rest: '3 min' },
    { id: 'bb_rdl', name: 'Barbell RDL', muscle: 'hamstrings', anchor: false, sets: 3, reps: '8-10', rest: '2 min' },
    { id: 'leg_press', name: 'Leg Press', muscle: 'quads', anchor: false, sets: 3, reps: '10-12', rest: '2 min' },
    { id: 'machine_leg_curl_seated', name: 'Seated Leg Curl', muscle: 'hamstrings', anchor: false, sets: 3, reps: '10-12', rest: '90 s' },
    { id: 'machine_calf_raise_standing', name: 'Standing Calf Raise', muscle: 'calves', anchor: false, sets: 3, reps: '10-15', rest: '60 s' } ] },
  { dayNum: 3, label: 'Upper — Volume', tag: 'UPPER', muscles: 'Shoulders, Back', note: '', exercises: [
    { id: 'bb_ohp', name: 'Barbell Overhead Press', muscle: 'shoulders', anchor: true, sets: 4, reps: '6-8', rest: '3 min' },
    { id: 'seated_cable_row', name: 'Seated Cable Row', muscle: 'back', anchor: false, sets: 3, reps: '10-12', rest: '2 min' },
    { id: 'cable_fly_mid', name: 'Cable Chest Fly (mid)', muscle: 'chest', anchor: false, sets: 3, reps: '12-15', rest: '90 s' },
    { id: 'cable_curl_ez', name: 'EZ-Bar Cable Curl', muscle: 'biceps', anchor: false, sets: 3, reps: '10-12', rest: '90 s' },
    { id: 'cable_pushdown_bar', name: 'Cable Pushdown (bar)', muscle: 'triceps', anchor: false, sets: 3, reps: '10-12', rest: '90 s' } ] },
  { dayNum: 4, label: 'Lower — Hinge', tag: 'LOWER', muscles: 'Glutes, Hamstrings', note: '', exercises: [
    { id: 'bb_hip_thrust', name: 'Barbell Hip Thrust', muscle: 'glutes', anchor: true, sets: 4, reps: '6-10', rest: '2 min' },
    { id: 'db_bulgarian_split_squat', name: 'DB Bulgarian Split Squat', muscle: 'quads', anchor: false, sets: 3, reps: '8-10', rest: '2 min' },
    { id: 'machine_leg_curl_lying', name: 'Lying Leg Curl', muscle: 'hamstrings', anchor: false, sets: 3, reps: '10-12', rest: '90 s' },
    { id: 'machine_leg_extension', name: 'Leg Extension', muscle: 'quads', anchor: false, sets: 3, reps: '12-15', rest: '90 s' },
    { id: 'db_calf_raise', name: 'DB Calf Raise', muscle: 'calves', anchor: false, sets: 3, reps: '12-15', rest: '60 s' } ] } ] };

async function launch(name) {
  const ctx = await chromium.launchPersistentContext(`/tmp/foundry-shots/${DEVICE}-${name}`, {
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true,
    viewport: { width: VIEW.width, height: VIEW.height }, deviceScaleFactor: VIEW.dsf });
  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', name, e.message));
  await page.goto(URL);
  return { ctx, page };
}
const snap = async (page, name) => { await page.waitForTimeout(900); await page.screenshot({ path: `${OUT}/${DEVICE}/${name}.png` }); console.log('shot', DEVICE, name); };
const tab = (page, label) => page.getByRole('tab', { name: label }).click();

const SCENES = {
  async '01-home'(page) { await page.evaluate(seed, 'mid'); await page.reload(); await page.waitForTimeout(2500); await snap(page, '01-home'); },
  async '02-workout'(page) {
    await page.evaluate(seed, 'mid');
    await page.evaluate(() => localStorage.setItem('foundry:sessionStart:d3:w2', String(Date.now() - 23 * 60 * 1000)));
    await page.goto(URL + 'day/3/2'); await page.waitForTimeout(2500);
    await page.evaluate(() => { const el = [...document.querySelectorAll('*')].find((n) => n.childElementCount === 0 && /^EXERCISE 1 OF/i.test(n.textContent.trim()));
      if (el) window.scrollBy(0, el.getBoundingClientRect().top - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-header-bottom')) || 140) - 70); });
    await snap(page, '02-workout');
  },
  async '03-history'(page) {
    await page.evaluate(seed, 'mid'); await page.goto(URL + 'day/0/2'); await page.waitForTimeout(2500);
    await page.locator('button[aria-label^="View "][aria-label$=" history"]').first().click(); await snap(page, '03-history');
  },
  async '04-review'(page) {
    // generateProgram shuffles; a fixed seed makes the shot repeatable.
    await page.addInitScript((sd) => { let x = sd; Math.random = () => { x = (x * 1664525 + 1013904223) % 4294967296; return x / 4294967296; }; }, Number(process.env.SEED || 7));
    await page.evaluate(seed, 'done'); await page.reload(); await page.waitForTimeout(2500);
    await page.getByText('Repeat this meso').click(); await page.waitForTimeout(600);
    await page.getByText('The Foundry builds my meso').click(); await page.waitForTimeout(500);
    await page.getByText('UPPER / LOWER').first().click();
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')]; const f = (t) => b.find((x) => x.innerText.trim() === t); ['4', '6 wk', '60m'].forEach((t) => f(t)?.click()); });
    await page.getByRole('button', { name: /all equipment/i }).click();
    await page.getByText('Build My Meso').click(); await page.waitForTimeout(3500);
    await page.evaluate(() => window.scrollTo(0, 0)); await snap(page, '04-review');
  },
  async '05-coach'(page) {
    await page.route(/foundry-ai/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(COACHED) }] }) }));
    await page.evaluate(() => { localStorage.clear(); ['welcomed', 'onboarded'].forEach((k) => localStorage.setItem('foundry:' + k, '1'));
      localStorage.setItem('foundry:onboarding_data', JSON.stringify({ name: 'Sam', experience: 'intermediate', gender: 'female' })); localStorage.setItem('foundry:onboarding_goal', 'build_muscle'); });
    await page.reload(); await page.waitForTimeout(2500);
    await page.getByText('Full gym').click(); await page.getByText('SEE MY PROGRAM').click(); await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /coach-tune my program/i }).click(); await page.waitForTimeout(2500);
    const banner = page.getByText('COACH-TUNED').first(); await banner.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -140));
    await snap(page, '05-coach');
  },
  async '06-schedule'(page) { await page.evaluate(seed, 'mid'); await page.reload(); await page.waitForTimeout(2500); await tab(page, 'Schedule'); await snap(page, '06-schedule'); },
  async '07-progress'(page) {
    await page.evaluate(seed, 'mid'); await page.reload(); await page.waitForTimeout(2500); await tab(page, 'Progress');
    const h = page.getByText('Meso History').first(); if (await h.count()) await h.click(); await snap(page, '07-progress');
  },
  async '08-recap'(page) {
    await page.evaluate(seed, 'done'); await page.reload(); await page.waitForTimeout(2500);
    await page.getByRole('button', { name: /view meso summary/i }).click(); await snap(page, '08-recap');
  },
  async '09-next'(page) { await page.evaluate(seed, 'done'); await page.reload(); await page.waitForTimeout(2500); await snap(page, '09-next'); },
  async '10-previous'(page) {
    await page.evaluate(seed, 'mid'); await page.reload(); await page.waitForTimeout(2500); await tab(page, 'Progress');
    const h = page.getByText('Meso History').first(); if (await h.count()) await h.click(); await page.waitForTimeout(500);
    await page.getByText(/Previous Meso Cycles/).last().click(); await page.waitForTimeout(800);
    const view = page.getByText(/^view$/i).first(); if (await view.count()) await view.click().catch(() => {});
    await snap(page, '10-previous');
  },
  async '11-cardio'(page) {
    await page.evaluate(seed, 'mid'); await page.reload(); await page.waitForTimeout(2500); await tab(page, 'Explore'); await page.waitForTimeout(500);
    await page.getByText(/^cardio$/i).first().click(); await snap(page, '11-cardio');
  },
  async '12-mobility'(page) {
    await page.evaluate(seed, 'mid'); await page.reload(); await page.waitForTimeout(2500); await tab(page, 'Explore'); await page.waitForTimeout(500);
    await page.getByText(/^mobility$/i).first().click(); await snap(page, '12-mobility');
  },
};

for (const [name, fn] of Object.entries(SCENES)) {
  if (ONLY && !name.startsWith(ONLY)) continue;
  const { ctx, page } = await launch(name);
  try { await fn(page); } catch (e) { console.log('FAIL', DEVICE, name, String(e).split('\n')[0]); await page.screenshot({ path: `${OUT}/${DEVICE}/${name}-FAILED.png` }).catch(() => {}); }
  await ctx.close();
}
