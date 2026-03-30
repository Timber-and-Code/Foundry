# The Foundry — Project Synopsis

## What It Is
A structured strength training system for serious lifters. Not a wellness app. Not motivation. A periodized mesocycle engine with progressive overload, RIR-based progression, phase tracking, and measurable improvement over time.

**Brand position:** The Foundry is the system that makes strength inevitable. Process-driven. Gender-neutral. Engineered, not decorated.

**Vision:** Paid app ($15–20/month or ~$99/year) targeting $5–10k/month. Monolith → Vite + React → Capacitor (iOS + Android) → Supabase + Stripe.

---

## Current File
`Foundry_1_8.html` — ~8,200 lines. React via CDN + Babel. localStorage under `ppl:` namespace. No backend, no auth, no network.

---

## Brand & Design System

### Identity
- Rebranded from Iron Oak → **The Foundry**
- Philosophy: process-driven strength. "Follow the structure. Strength follows."

### Design Language (v1.5)
- **Font:** Inter (400/500/600/700/800)
- **Backgrounds:** `#080808` root, `#1e2124` cards
- **Primary accent:** Slate Blue `#2f4f6f`
- **Tag colors:** Push `#3a5878`, Pull `#2e6f73`, Legs `#4a5a6a`
- **Phase colors:** Accumulation teal, Intensification slate, Peak steel, Deload dark slate
- No gradients. No glows. No metallic textures. No decorative elements.
- **Banner:** Flat black, 3px slate-blue left bar, "THE FOUNDRY" Inter 800

### Design Tokens (locked)
- **Type scale floor:** 10px min. Zero sub-10px text anywhere.
- **Border radius:** 6px buttons/icons → 8px cards/dialogs → 99px pills
- **Colors:** All borders `var(--border)`. All CTAs `var(--btn-primary-*)`. Zero hardcoded colors.
- **Spacing:** 8px base grid.

### App Icon
- Canvas-drawn crucible: charcoal rounded square, steel-grey ring with handles, radial gradient molten core (gold → orange → deep red), gold pour stream. Renders at all sizes via `<head>` canvas script.

---

## Architecture
- Single monolithic HTML file
- React via CDN + Babel in-browser transpilation
- localStorage persistence (`ppl:` namespace)
- No backend, no auth, no network calls
- `generateProgram(profile)` is the core engine
- `profile.aiDays` short-circuits to AI-built days

**Migration path (planned):**
1. Monolith → Vite + React (component files, ES modules)
2. Capacitor (`npx cap add ios` / `npx cap add android`)
3. Supabase for auth + persistence
4. Stripe for subscriptions
5. App Store + Play Store

Note: Next.js is not in the stack — SSR conflicts with Capacitor's static build requirement.

---

## Features Built

### Meso Builder — Two Paths
- **The Foundry Builds It:** experience + split + days + length → algorithmic generation, `diff` filtering (1/2/3)
- **I'll Build My Own:** split → day count → per-day exercise picker → `manualDayExercises` short-circuit in `generateProgram`
- **Split support:** PPL (3/5/6d), Upper/Lower (2/4d), Full Body (2/3d), Push/Pull (4d)
- `SPLIT_CONFIG` is single source of truth for valid day counts

### Exercise Database
- 125 exercises across PUSH / PULL / LEGS / CORE
- Fields: `id`, `name`, `muscle`, `muscles[]`, `tag`, `splits[]`, `equipment`, `pattern`, `fatigue`, `anchor`, `diff`, `sets`, `reps`, `rest`, `warmup`, `description`
- All 125 exercises have `description` — trainer POV, 9th-grade reading level, setup/execution/cue/mistake
- All 125 exercises have `warmup` — no `—` entries remain. 83 previously blank entries filled in 1.8b.

### Warmup System
- Warmup types: `Full protocol`, `1 feeler set`, `1 light feeler set`, `BW ramp: X`, movement-specific prep, `None needed — go straight in`
- `getWarmupDetail(warmupStr, exerciseName)` → `{ title, rationale, steps[] }` for every type
- **WARM UP button** in ExerciseCard (identical style to HOW TO) → bottom-sheet modal with rationale + numbered expert steps
- Warmup nav item removed from dashboard — lives inline at each exercise

### Workout Logging
- Per-set weight + reps, auto-fill across sets on weight blur
- Carryover: last week's weights pre-fill next session
- **Set completion:** checkmark button per set → row grays out, inputs dim. Tap again to uncheck and re-enable editing
- **State rehydration (1.8c):** `doneSets` and `doneExercises` rehydrate from localStorage on every mount
- Exercise history modal: all logged sets across all weeks
- Session lock: prior days must be complete before unlocking next

### Session Start Overlay (1.8b)
- Opens on fresh unlocked days. Shows: phase, week, RIR target, week focus note from `MESO.mesoRows`
- Phase-colored left-border accent. "Let's work" dismiss. Backdrop tap also dismisses.
- Skipped on completed or locked days.

### HOW TO Modal
- HOW TO button in expanded ExerciseCard → bottom-sheet with full exercise description
- Four hydration paths carry `description`: generateProgram, AI path, swap override, swap apply

### Swap System
- Grouped by muscle, scope week or meso
- UPPER/LOWER/FULL days match by exercise `.tag` (not `dayTag`)

### Home Dashboard
- **Meso progress ring:** animated SVG, % complete + session count
- **Current week card:** phase pill (12px), RIR label (12px), tappable day pills, progress bar
- **Next session card:** Day/Week, split label, first 3 exercises + last week's weights
- **This Week Volume card:** Push/Pull/Legs bars → taps to Weekly Summary

### Profile / Settings (1.8b)
- `ProfilePage` component (proper function component, hooks-safe)
- Accessible from bottom strip. Edits: name, age, body weight (lbs), gender
- Writes to `ppl:profile`. "✓ Saved" confirmation. Split/schedule locked note.

### Navigation
- 3×2 grid: Schedule, Meso Overview, Progress, PR Tracker, Meso History, Weekly Summary
- Bottom strip: **Profile · Data · Theme** (3-column)
- Warm-up removed from nav

### Weekly Summary
- Week picker, compliance ring, PRs hit (e1RM comparison), volume by muscle, session log

### PR Tracker
- Epley 1RM: `weight × (1 + reps/30)`. Filter by tag, trend arrows, mini bar chart per lift.

### Meso History
- Auto-archives on reset (max 10). Per-archive: completion %, split, equipment, per-exercise PRs.

### Progress View
- Week + meso-wide sets by muscle, expandable by tag. PR card per exercise.

### Streak & Discipline Metric (1.2)
- STREAK / BEST / COMPLIANCE — display-only, no gamification

### Onboarding (1.3)
- 3 screens: mesocycle, RIR, how it works. Skip available. Sets `ppl:onboarded = "1"`.

### End-of-Week Modal (1.4)
- Fires on last session of week. Normal: "Week N Complete". Final: "Meso Complete" + archive CTA.

### UI Overhaul (1.5)
- Type scale floor, radius system, color token enforcement — all violations resolved.

### Manual Builder (1.6)
- Direct exercise picker per day. ORDER strip. Min 3 enforcement. `generateProgram` short-circuit.

### Exercise Descriptions (1.7)
- `description` on all 125 exercises. All hydration paths carry it through.

---

## Storage Keys
- `ppl:day{d}:week{w}` → `{ [exIdx]: { [setIdx]: { weight, reps } } }`
- `ppl:notes:d{d}:w{w}` → session notes string
- `ppl:done:d{d}:w{w}` → completion flag ("1")
- `ppl:exov:d{d}:w{w}:ex{ex}` → week-specific exercise override
- `ppl:exov:d{d}:ex{ex}` → meso-wide exercise override
- `ppl:profile` → JSON: name, age, weight, gender, split, equipment, manualDayExercises, etc.
- `ppl:currentWeek` → active week index
- `ppl:archive` → archived meso records (max 10)
- `ppl:backup:0/1/2` → rolling auto-backup snapshots

---

## Foundry 1.8 — Change Log

### 1.8a — Quick Wins
1. Phase pill + RIR label: 10px → 12px on home dashboard
2. Set completion: checkmark button per set, gray-out on confirm, uncheck to re-edit
3. End-of-session modal: fires only on explicit final-set checkmark tap (not on reps input)

### 1.8b — Medium Complexity
4. Profile page: name / age / weight / gender edit post-onboarding
5. Warmup audit: all 83 `—` entries filled with appropriate expert protocols
6. Meso overview popup: phase + RIR + focus note on session open

### 1.8c — State/Persistence
7. Mid-session gray state rehydration: both `doneExercises` and `doneSets` now initialize from localStorage

### 1.8 UX Polish
8. Set uncheck: tapping checked set re-enables editing
9. WARM UP button: matches HOW TO style, opens warmup guide modal
10. Warm-up nav item removed from dashboard

---

## Current Status
**Active mobile testing.** Real-world gym use, two testers. Logging bugs and friction as found. No architectural changes until testing complete and feature set is stable.

**Pending (last session, environment failure):**
- WARM UP button needs one final pass: the invisible outer-button wrapper around the warmup row should be removed, and the WARM UP button should be the sole tap target (currently partially done — WARM UP button exists but outer wrapper may still be present)

---

## Roadmap

1. ~~Streak metric~~ ✓ 1.2
2. ~~Onboarding~~ ✓ 1.3
3. ~~End-of-week trigger~~ ✓ 1.4
4. ~~UI overhaul~~ ✓ 1.5
5. ~~Manual Builder~~ ✓ 1.6
6. ~~Exercise descriptions~~ ✓ 1.7
7. ~~Day 1 test fixes + mobile polish~~ ✓ 1.8
8. **Mobile testing** — in progress
9. **Vite + React migration**
10. **Capacitor** — iOS + Android
11. **Supabase + Stripe**
12. **Ship**