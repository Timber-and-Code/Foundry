# THE FOUNDRY — Project Synopsis
**Fitness PWA · v1.19.0 · March 2026**

> Single-file React PWA. No bundler. All state in localStorage. Built session by session.

---

## 1 · Mission & Revenue Objective

The Foundry is a periodized strength training PWA built for serious athletes and committed beginners. It generates personalized mesocycles, auto-progresses weights, tracks volume landmarks, and delivers what a $200/month personal trainer would give you — for the price of a streaming subscription.

**PRIMARY OBJECTIVE: $100,000 in revenue within 12 months of launch.**

---

## 2 · Pricing Model & Path to $100K

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0 — permanently free for: Under 18 · Adults 62+ | Manual program builder, full tracking, exercise library, warmup guides |
| **Pro** | $12/mo · $99/yr (save 2 months) | AI program builder, full history, sparklines, e1RM, all advanced features |
| **Trainer / Coach** | $29/mo · $249/yr — post-Capacitor | Client management, shared programs, coach dashboard |

### The Math to $100K
- 700 active Pro subscribers at $12/mo = $100,800 ARR
- Or: 850 annual at $99 + ~200 monthly = $102,550
- Tyler (James's wife, works in business banking) and James are active beta testers — currently mid-mesocycle
- Tyler's business banking network is the primary warm acquisition channel
- James's daughter and a friend are also beta testing
- Sydney (works at a gym) = target pilot for the Trainer tier
- Every trainer using the app is a distribution node — 10 trainers × 20 clients = 200 users from 10 conversations

### Revenue Opportunities (Surfaced & Standing)
- **AI builder paywall** — Free tier gets static generator, Pro gets AI. Clearest monetization lever. Deferred until post-Vite migration; beta testers remain ungated. `ppl:pro` localStorage key reserved.
- **Rest day "Next Session" preview as Pro gate** — free users see session label only; Pro users see full exercise list, prescribed weights, and volume targets.
- **Sample programs as a conversion funnel** — "Start this program" is the highest-intent free-user moment. Prime candidate for a Pro interstitial: "Get the AI-personalized version with Pro."
- **Free tier for Under 18 / 62+** — young users become paying adults; older users convert adult children; both demographics are underserved by mainstream fitness apps.

---

## 3 · Architecture

| Item | Detail |
|------|--------|
| Format | Single HTML file (~15,100 lines) |
| Framework | React 18 (CDN), no bundler, no build step |
| State | localStorage under `ppl:` namespace |
| AI Backend | Cloudflare Worker → `https://foundry-ai.timberandcode3.workers.dev` |
| AI Key | Stored as Cloudflare Worker secret `ANTHROPIC_API_KEY` — never in source |
| Hosting | GitHub Pages — `https://timber-and-code.github.io/Foundry` |
| Versioning | Semantic: Major = architecture rebuild, Minor = new features, Patch = fixes/polish |
| Worker Files | `~/foundry-worker/worker.js` + `wrangler.toml` on James's WSL2 machine |

**Critical invariant:** The `exercises` useState hook MUST be declared before the `prevWeekNotes` useMemo (~line 8285). Reversing this order causes a black screen on Week 2+ (useMemo fires before the hook is initialized; Babel's `var` hoisting makes it undefined).

**Vite/Capacitor migration:** Deferred to v2.0 sprint. Triggers: Pro paywall activation, App Store distribution, Trainer tier.

---

## 4 · Version History

### v1.19.0 — Polish & Visual Systems
**Typography / Color sweep**
- 12px type floor enforced across all components — no text renders below this size
- Dark/light mode CSS variables audited and corrected for contrast compliance
- Consistent use of design tokens throughout; reduces drift across future edits

**PR Tracker redesign**
- Compact single-row cards replace the previous verbose layout
- Tap-through opens a bottom sheet with full PR detail
- Substantially reduces vertical space on the home tab

**Minimized rest timer redesign**
- More visible in the minimized state — previously easy to miss
- Ring color tinted to match phase color
- 24px countdown display; cleaner and more scannable mid-workout

**Volume Check — landmark label rewrite**
- MEV / MAV / MRV labels replaced with plain-language equivalents
- Removes jargon barrier for intermediate and new users without losing precision for advanced users

**Home tab cleanup**
- Redundant "Sets Logged" bar chart removed from home tab
- Chart duplicated information already visible in session detail; removal reduces cognitive load

---

### v1.18.0 — Explore Launch + CompleteDialog Overhaul
**Bug fixes**
- DayView workout-load failure (truncated AddExerciseModal JSX block) — restored, brace balance = 0
- Black screen on Week 2+ (exercises useState declared after prevWeekNotes useMemo) — order fixed; `(day.exercises || [])` defensive fallback added
- iOS PWA serving stale cached HTML — cache-busting meta tags added (`Cache-Control: no-cache`, `Pragma: no-cache`, `Expires: 0`)

**ErrorBoundary**
- Class component wrapping `<App />` at root render
- Unhandled React render errors now show: error message, stack trace, component stack, Reload + Try Again buttons

**#20 — Explore: "Start this program" CTA**
- All 10 sample programs fully wired with launch flow
- `buildAiDaysFromSample()` maps exercise name strings to full EXERCISE_DB objects
- `StartSampleProgramModal` — bottom sheet with name, metadata badges, attribution line for classic programs, start date picker
- Active meso guard: two-tap confirm with red button escalation on second tap

**CompleteDialog overhaul**
- RPE colors: full neon → muted steel blue / teal-green / amber with single soft halo glow
- No/YES → solid Not yet / Done ✓
- "Exercise complete?" and "How was the exertion?" unified visual weight

**+ Add a Set in CompleteDialog**
- Always visible above Not yet / Done ✓
- Phase-gated: Deload → replaced with explanation. Peak → amber border + warning note. Accumulation/Intensification → clean ghost button.
- On tap: increments sets by 1, copies last logged weight, clears dialogShownRef so dialog re-fires on new set

**Last-set timer sequencing**
- Last-set checkmark now fires DONE? dialog only — rest timer deferred until Done ✓
- Non-last sets: timer still fires immediately on checkmark

---

### v1.17.0 and earlier — see archived sessions

---

## 5 · Onboarding Rewrite (#21) — Designed, Not Yet Built

Full design approved. Ready for implementation. Do not build without explicit session kickoff.

| Screen | Content |
|--------|---------|
| Screen 0 | Problem/solution framing — "Most apps give you a log. The Foundry gives you a plan." |
| Screen 1 | Guesswork-removal messaging + progression visualization (weight increase animation) |
| Screen 2 | Experience level selector with dynamic subtext per selection |
| Tutorial | Option B — first-use coach overlay on the home screen (not additional onboarding screens) |

---

## 6 · Storage Key Reference

| Key Pattern | Purpose |
|-------------|---------|
| ppl:profile | User profile JSON (includes workoutDaysHistory) |
| ppl:done:d{d}:w{w} | Meso session completion flag |
| ppl:day{d}:week{w} | Set/rep data for meso session |
| ppl:sess:lift:d{d}:w{w} | Session duration (minutes) |
| ppl:sessionStart:d{d}:w{w} | Session start timestamp (ms) |
| ppl:strengthEnd:d{d}:w{w} | Strength phase end timestamp (ms) |
| ppl:extra:YYYY-MM-DD | Extra session day object JSON |
| ppl:extra:done:YYYY-MM-DD | Extra session completion flag |
| ppl:extra:start:YYYY-MM-DD | Extra session start timestamp |
| ppl:extra:end:YYYY-MM-DD | Extra session strength end timestamp |
| ppl:extra:data:YYYY-MM-DD | Extra session set/rep data |
| ppl:bwlog | Bodyweight log array JSON |
| ppl:bwPromptSunday | BW check-in shown-flag (resets weekly) |
| ppl:bwGoal | Body weight goal (lbs, string) |
| ppl:skip:d{d}:w{w} | Skip flag for future meso day slot |
| ppl:currentWeek | Current meso week index |
| ppl:theme | Dark/light theme preference |
| ppl:archive | Completed meso archive array (max 10) |
| ppl:exov:d{d}:ex{i} | Exercise override (swap) for slot |
| ppl:notes:d{d}:w{w} | Session-level note text |
| ppl:exnotes:d{d}:w{w} | Per-exercise notes JSON |
| ppl:cardio:d{d}:w{w} | Cardio log for session |
| ppl:extra:notes:YYYY-MM-DD | Extra session session-level note |
| ppl:extra:exnotes:YYYY-MM-DD | Extra session per-exercise notes JSON |
| ppl:pro | Reserved — Pro tier flag (not yet active; gated behind Vite migration) |

---

## 7 · Key Code Locations (v1.19.0)

| Item | Location |
|------|---------|
| FOUNDRY_AI_WORKER_URL | ~line 4475 |
| PHASE_COLOR JS constant | ~line 3029 |
| QUOTES array (233 quotes) | ~line 3416 |
| loadExerciseHistory() | ~line 453 |
| detectSessionPRs() | ~line 469 |
| haptic() + HAPTIC patterns | ~line 580 |
| isSkipped() / setSkipped() / clearAllSkips() | ~line 675 |
| getWorkoutDaysForWeek() / ensureWorkoutDaysHistory() | ~line 691 |
| buildAiDaysFromSample() | ~line 10860 |
| StartSampleProgramModal | ~line 10897 |
| RPE_OPTS + CompleteDialog | ~line 6483 |
| ExerciseCard (last-set timer deferral, handleSetCheckmark) | ~line 7005 |
| WorkoutCompleteModal (PR callout) | ~line 6200 |
| ExtraDayView | ~line 7515 |
| DayView | ~line 8135 |
| exercises useState (MUST stay before prevWeekNotes useMemo) | ~line 8285 |
| handleLastSetFilled / handleDialogYes / handleDialogNo / handleAddSet | ~line 8555 |
| AddExerciseModal in DayView | ~line 9083 |
| WeekSection (skip toggle) | ~line 10100 |
| BwChart (goal weight + history) | ~line 9630 |
| ExplorePage (onStartProgram wired) | ~line 11002 |
| NoMesoShell (onStartProgram threaded) | ~line 14535 |
| ErrorBoundary | ~line 14911 |
| App render (wrapped in ErrorBoundary) | ~line 14998 |

---

## 8 · QA Tracker

### Resolved
| # | Issue |
|---|-------|
| 1 | AI Worker URL was placeholder — now live |
| 2 | Day locking blocked out-of-order logging — removed |
| 3 | Leave prompt 6-quote hardcoded array — now uses full 233-quote library |
| 4 | Rest timer skipped last set — fixed |
| 5 | Meso History header small/dimmed — fixed |
| 7 | No in-progress indicator on bottom nav — pulsing dot added |
| 8 | BW check-in fired on exercise expand — moved to beginWorkout() |
| 9 | Edit Workout button disappears — confirmed fixed |
| 10 | Session notes buried — per-exercise strips + post-session review + calendar badge |
| 11 | Week Complete modal underutilized — redesigned with stat row + primary CTA |
| 12 | Calendar navigated infinitely past — clamped to meso date range |
| 13 | Swap UI didn't confirm week — Week N Only label added |
| 15 | No PR callout in workout complete modal — detectSessionPRs() + gold trophy callout |
| 16 | BW trend not visualized — goal weight, history list, single-entry state |
| 18 | Exercise history no week context — Phase + RIR shown, most recent first |
| 19 | No haptic feedback — haptic() wired to 5 key moments |
| 20 | Explore sample programs: no Start CTA — buildAiDaysFromSample + StartSampleProgramModal fully wired |
| 22 | No way to update schedule mid-meso — skip toggle + Edit Schedule with history model |
| 23 | No rest day content — bottom sheet with quotes, recovery, mobility, next session |
| 24 | font-weight 900 not loaded — Google Fonts subset updated |
| — | DayView AddExerciseModal JSX truncation → workout load failure — restored |
| — | exercises useState after prevWeekNotes useMemo → black screen Week 2+ — order fixed, ErrorBoundary added |
| — | iOS PWA cache serving stale HTML — cache-busting meta tags added |
| — | CompleteDialog RPE buttons neon / hard to read — colors muted, glow reduced |
| — | No/YES buttons low contrast — replaced with Not yet / Done ✓ |
| — | "Not yet" left exercise with no re-fire path — clears last set reps + removes from dialogShownRef |
| — | No way to add sets mid-exercise — + Add a Set in CompleteDialog, phase-gated |
| — | Last-set timer fired simultaneously with DONE? dialog — timer deferred to after Done ✓ |
| — | Last-set DONE? showed "Not yet" unnecessarily — hidden on isLastSet dialogs |
| — | Typography inconsistency / sub-12px text throughout — 12px floor + CSS variable audit sweep |
| — | PR Tracker verbose and space-inefficient — compact single-row cards + tap-through bottom sheet |
| — | Rest timer minimized state hard to see — larger countdown, ring-color tint |
| — | Volume Check landmark labels jargon-heavy — rewritten in plain language |
| — | "Sets Logged" bar chart redundant on home tab — removed |

### Open / Unconfirmed
| # | Issue | Notes |
|---|-------|-------|
| 17 | Verify past sessions open in editable DayView | Likely already works — needs manual confirmation |
| 21 | Onboarding rewrite | Design approved, not yet built — next major build item |

---

## 9 · Product Roadmap (Priority Order)

1. **Onboarding rewrite (#21)** — Design is fully approved. The value prop needs to land in the first 60 seconds. Highest-leverage item before any acquisition push.
2. **Vite + Capacitor migration (v2.0)** — Unlocks Pro paywall, app store distribution, push notifications, Trainer tier. Trigger: when starting App Store push.
3. **AI builder paywall** — Hard block at path selection; PRO badge on AI card (Option A). Explicitly deferred until post-Vite. `ppl:pro` key reserved.
4. **Trainer tier pilot** — Sydney's gym. Async program delivery, client management dashboard.
5. **Rest day Next Session detail as Pro gate** — Free: session label only. Pro: full exercise list + weights.
6. **Sample program Pro upsell** — "Start this program" → "Get the AI-personalized version with Pro."
7. **In-app referral** — Give a friend 30 days free, get 30 days free.
8. **Progress photos** — Camera upload pinned to date. Retention driver.
9. **Recovery & Readiness section** — Sleep, stress, HRV. Lowest-risk near-term bridge to Foundry Whole Health.
10. **Body weight benchmarks** — Entry point for users without working weights.
11. **Push notifications** — Requires Capacitor.
12. **"Foundry Whole Health" brand direction** — Nutrition, recovery, readiness. Revisit at ~$30K ARR.

---

## 10 · Architectural Principles & Hard-Won Lessons

- Pure-data arrays (`EXERCISE_DB`, `QUOTES`, `SAMPLE_PROGRAMS`, etc.) must live in a plain `<script>` tag, not the Babel block — mixing caused parse overhead and silent crashes
- `const` redeclaration across script tags is a hard JS error that silently crashes the entire app
- `ProgramCard` and similar components must be proper top-level named function components — not inline conditional definitions
- Template-started programs should bypass algorithmic generation via a `templateDays` short-circuit while still using the full progression engine
- `exercises` useState MUST be declared before `prevWeekNotes` useMemo — this is a permanent invariant, not to be disturbed
- The real moat is coaching intelligence: stalling detection, phase-aware progression, RIR targets, coherent session flows

---

## 11 · Standing Instructions

- **Discuss and confirm before any implementation** — no code until explicitly approved
- Deliver updated SYNOPSIS.md at end of every build session
- Proactively surface $100K revenue ideas each session
- Work section by section with clear status tracking after each item
- index.html on GitHub = live app — James deploys manually
- GitHub upload: https://github.com/Timber-and-Code/Foundry/upload/main
- Files follow semantic versioning (`Foundry_1_19_0.html`)
- Outputs always copied to `/mnt/user-data/outputs/`
- Tyler = James's wife, works in business banking, active beta tester mid-mesocycle (she/her)
- James's daughter and a friend are also beta testing
